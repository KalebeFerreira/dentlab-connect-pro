import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Simulates a Mercado Pago payment for diagnostic purposes.
 * Creates a real PIX payment of R$ 0.01 (1 cent) and lets the user pay it,
 * OR fetches an existing payment status by ID without creating a new one.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) throw new Error("User not authenticated");
    const user = userData.user;

    const { action, paymentId } = await req.json();
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");

    // ACTION: check status of an existing payment
    if (action === "check_status" && paymentId) {
      const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await resp.json();
      return new Response(JSON.stringify({ ok: resp.ok, payment: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ACTION: trigger webhook simulation (sends test event to our own webhook)
    if (action === "trigger_webhook" && paymentId) {
      const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook?data.id=${paymentId}&type=payment`;
      const resp = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "payment", action: "payment.updated", data: { id: paymentId } }),
      });
      const text = await resp.text();
      return new Response(
        JSON.stringify({ ok: resp.ok, webhook_status: resp.status, webhook_response: text }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // DEFAULT ACTION: create a 1-cent PIX test payment
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const idempotencyKey = crypto.randomUUID();

    const mpResp = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: 0.01,
        description: "Teste de diagnóstico - Webhook MP",
        payment_method_id: "pix",
        date_of_expiration: expiresAt.toISOString(),
        payer: { email: user.email, first_name: "Diagnostico" },
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
        external_reference: user.id,
        metadata: { user_id: user.id, diagnostic: true },
      }),
    });

    const mpData = await mpResp.json();
    if (!mpResp.ok) throw new Error(mpData.message || "Erro ao criar pagamento de teste");

    return new Response(
      JSON.stringify({
        payment_id: mpData.id,
        status: mpData.status,
        qr_code: mpData.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: mpData.point_of_interaction?.transaction_data?.qr_code_base64,
        ticket_url: mpData.point_of_interaction?.transaction_data?.ticket_url,
        amount: 0.01,
        expires_at: expiresAt.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("simulate-mp-payment error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
