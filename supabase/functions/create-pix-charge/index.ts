import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const body = await req.json();
    const amount = Number(body.amount);
    const description = String(body.description ?? "Cobrança PIX").slice(0, 200);
    const payerName = String(body.payer_name ?? user.user_metadata?.name ?? "Cliente").slice(0, 100);

    if (!amount || isNaN(amount) || amount <= 0) {
      throw new Error("Valor inválido");
    }
    if (amount > 50000) {
      throw new Error("Valor máximo é R$ 50.000,00");
    }

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");

    const idempotencyKey = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: Math.round(amount * 100) / 100,
        description,
        payment_method_id: "pix",
        date_of_expiration: expiresAt.toISOString(),
        payer: {
          email: user.email,
          first_name: payerName,
        },
        external_reference: `charge_${user.id}`,
      }),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago error:", mpData);
      throw new Error(mpData.message || "Erro ao criar cobrança no Mercado Pago");
    }

    const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64;
    const ticketUrl = mpData.point_of_interaction?.transaction_data?.ticket_url;

    return new Response(
      JSON.stringify({
        payment_id: mpData.id,
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        ticket_url: ticketUrl,
        amount,
        description,
        expires_at: expiresAt.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("create-pix-charge error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
