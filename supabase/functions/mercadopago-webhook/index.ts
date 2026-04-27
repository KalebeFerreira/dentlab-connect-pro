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

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature") ?? "";
    const requestId = req.headers.get("x-request-id") ?? "";
    const url = new URL(req.url);
    const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "";

    const webhookSecret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");

    // Validate signature (https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks)
    if (webhookSecret && signature) {
      const parts = Object.fromEntries(
        signature.split(",").map((s) => s.trim().split("=").map((p) => p.trim()))
      );
      const ts = parts["ts"];
      const v1 = parts["v1"];

      if (ts && v1 && dataId) {
        const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
        const hmac = createHmac("sha256", webhookSecret).update(manifest).digest("hex");
        if (hmac !== v1) {
          console.error("Invalid signature", { expected: hmac, got: v1 });
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const body = rawBody ? JSON.parse(rawBody) : {};
    const type = body.type ?? body.action;
    const paymentId = body.data?.id ?? dataId;

    console.log("Webhook received:", { type, paymentId });

    if (!paymentId || (type && !String(type).includes("payment"))) {
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
      throw new Error("Failed to fetch payment from Mercado Pago");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const status = payment.status; // approved, pending, rejected, cancelled
    const userId = payment.metadata?.user_id ?? payment.external_reference;
    const billingCycle = payment.metadata?.billing_cycle ?? "monthly";

    let subscriptionStart: string | null = null;
    let subscriptionEnd: string | null = null;
    let paidAt: string | null = null;

    if (status === "approved") {
      paidAt = new Date().toISOString();
      const start = new Date();
      const end = new Date(start);
      if (billingCycle === "annual") {
        end.setFullYear(end.getFullYear() + 1);
      } else {
        end.setMonth(end.getMonth() + 1);
      }
      subscriptionStart = start.toISOString();
      subscriptionEnd = end.toISOString();
    }

    // Update pix_payments
    const { error: updateError } = await supabaseAdmin
      .from("pix_payments")
      .update({
        status,
        paid_at: paidAt,
        subscription_start: subscriptionStart,
        subscription_end: subscriptionEnd,
      })
      .eq("mercadopago_payment_id", String(paymentId));

    if (updateError) console.error("Update pix_payments error:", updateError);

    // Activate subscription on user_subscriptions
    if (status === "approved" && userId && subscriptionEnd) {
      const { error: subError } = await supabaseAdmin
        .from("user_subscriptions")
        .upsert(
          {
            user_id: userId,
            status: "active",
            current_period_end: subscriptionEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      if (subError) console.error("Subscription upsert error:", subError);
      console.log("Subscription activated for user:", userId, "until", subscriptionEnd);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("mercadopago-webhook error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
