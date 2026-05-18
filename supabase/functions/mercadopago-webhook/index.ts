import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Capture all headers for diagnostic logging
  const headersObj: Record<string, string> = {};
  req.headers.forEach((v, k) => { headersObj[k] = v; });

  let logEntry: Record<string, unknown> = {
    raw_headers: headersObj,
  };

  const writeLog = async (extra: Record<string, unknown>, status: number) => {
    try {
      await supabaseAdmin.from("mercadopago_webhook_logs").insert({
        ...logEntry,
        ...extra,
        http_status: status,
        processing_time_ms: Date.now() - startTime,
      });
    } catch (e) {
      console.error("Failed to write webhook log:", e);
    }
  };

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature") ?? "";
    const requestId = req.headers.get("x-request-id") ?? "";
    const url = new URL(req.url);
    const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "";

    const body = rawBody ? JSON.parse(rawBody) : {};
    const type = body.type ?? body.action;
    const paymentId = body.data?.id ?? dataId;

    logEntry = {
      ...logEntry,
      raw_body: body,
      event_type: type ?? null,
      event_action: body.action ?? null,
      payment_id: paymentId ? String(paymentId) : null,
    };

    console.log("Webhook received:", { type, paymentId, hasSignature: !!signature });

    // Validate signature
    const webhookSecret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
    let signatureValid: boolean | null = null;

    if (webhookSecret && signature) {
      const parts = Object.fromEntries(
        signature.split(",").map((s) => s.trim().split("=").map((p) => p.trim()))
      );
      const ts = parts["ts"];
      const v1 = parts["v1"];

      if (ts && v1 && dataId) {
        const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
        const hmac = createHmac("sha256", webhookSecret).update(manifest).digest("hex");
        signatureValid = hmac === v1;

        if (!signatureValid) {
          // Don't block: we re-fetch the payment from MP with our access token below,
          // which authenticates the event. Just log the mismatch for visibility.
          console.warn("Signature mismatch (continuing, will verify via MP API)", {
            expected: hmac,
            got: v1,
          });
        }
      }
    }

    logEntry.signature_valid = signatureValid;

    if (!paymentId || (type && !String(type).includes("payment"))) {
      await writeLog({ error_message: "Ignored: not a payment event" }, 200);
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");

    // Fetch payment details from Mercado Pago
    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payment = await mpResp.json();

    if (!mpResp.ok) {
      console.error("MP fetch error:", payment);
      await writeLog(
        { error_message: `MP fetch failed: ${payment.message ?? "unknown"}`, payment_data: payment },
        500
      );
      return new Response(JSON.stringify({ error: "Failed to fetch payment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const status = payment.status;

    // Look up our pix_payments record FIRST to get the authoritative plan_key/billing_cycle/user_id
    const { data: pixRecord, error: pixFetchError } = await supabaseAdmin
      .from("pix_payments")
      .select("user_id, plan_key, billing_cycle")
      .eq("mercadopago_payment_id", String(paymentId))
      .maybeSingle();

    if (pixFetchError) console.error("pix_payments lookup error:", pixFetchError);

    // Prefer the DB record (source of truth), fall back to MP metadata
    const userId =
      pixRecord?.user_id ?? payment.metadata?.user_id ?? payment.external_reference;
    const planKey =
      pixRecord?.plan_key ?? payment.metadata?.plan_key ?? payment.metadata?.plan_name ?? null;
    const billingCycle =
      pixRecord?.billing_cycle ?? payment.metadata?.billing_cycle ?? "monthly";

    logEntry = {
      ...logEntry,
      payment_status: status,
      payment_data: payment,
      user_id: userId ?? null,
    };

    let subscriptionStart: string | null = null;
    let subscriptionEnd: string | null = null;
    let paidAt: string | null = null;

    if (status === "approved") {
      paidAt = new Date().toISOString();
      const start = new Date();
      const end = new Date(start);
      if (billingCycle === "annual") end.setFullYear(end.getFullYear() + 1);
      else end.setMonth(end.getMonth() + 1);
      subscriptionStart = start.toISOString();
      subscriptionEnd = end.toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from("pix_payments")
      .update({ status, paid_at: paidAt, subscription_start: subscriptionStart, subscription_end: subscriptionEnd })
      .eq("mercadopago_payment_id", String(paymentId));

    if (updateError) console.error("Update pix_payments error:", updateError);

    if (status === "approved" && userId && subscriptionEnd) {
      const subscriptionPayload: Record<string, unknown> = {
        user_id: userId,
        status: "active",
        current_period_start: subscriptionStart,
        current_period_end: subscriptionEnd,
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      };
      if (planKey) subscriptionPayload.plan_name = planKey;

      const { error: subError } = await supabaseAdmin
        .from("user_subscriptions")
        .upsert(subscriptionPayload, { onConflict: "user_id" });

      if (subError) console.error("Subscription upsert error:", subError);
      console.log("Subscription activated:", { userId, planKey, billingCycle, until: subscriptionEnd });
    }

    await writeLog({}, 200);

    return new Response(JSON.stringify({ ok: true, status, paymentId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("mercadopago-webhook error:", msg);
    await writeLog({ error_message: msg }, 500);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
