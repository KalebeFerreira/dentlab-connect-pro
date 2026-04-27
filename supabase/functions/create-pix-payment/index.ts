import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapping price_id -> plan info (mirror of src/hooks/useSubscription.ts)
const PLAN_MAP: Record<string, { name: string; key: string; cycle: "monthly" | "annual"; price: number }> = {
  "price_1SYVOhF2249riykhzMKCVXNw": { name: "Plano Básico", key: "basic", cycle: "monthly", price: 44.0 },
  "price_1SYVOhF2249riykh1HAwzkce": { name: "Plano Básico Anual", key: "basic", cycle: "annual", price: 396.0 },
  "price_1SYVOiF2249riykhLo07A0Lx": { name: "Plano Profissional", key: "professional", cycle: "monthly", price: 84.0 },
  "price_1SYVOiF2249riykhphMkNE0w": { name: "Plano Profissional Anual", key: "professional", cycle: "annual", price: 756.0 },
  "price_1SYVOjF2249riykhJmw4RoVM": { name: "Plano Premium", key: "premium", cycle: "monthly", price: 140.0 },
  "price_1SYVOjF2249riykhi2o98hEf": { name: "Plano Premium Anual", key: "premium", cycle: "annual", price: 1260.0 },
  "price_1Sq1xDF2249riykhpt3dJbLS": { name: "Plano Super Premium", key: "super_premium", cycle: "monthly", price: 199.0 },
  "price_1Sq1xZF2249riykhmTrDAtsF": { name: "Plano Super Premium Anual", key: "super_premium", cycle: "annual", price: 1790.0 },
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

    const { priceId } = await req.json();
    if (!priceId) throw new Error("priceId is required");

    const plan = PLAN_MAP[priceId];
    if (!plan) throw new Error(`Unknown priceId: ${priceId}`);

    // 10% discount for PIX
    const discountedAmount = Math.round(plan.price * 0.9 * 100) / 100;

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");

    // Create PIX payment in Mercado Pago
    const idempotencyKey = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: discountedAmount,
        description: `${plan.name} (${plan.cycle === "annual" ? "Anual" : "Mensal"}) - 10% OFF PIX`,
        payment_method_id: "pix",
        date_of_expiration: expiresAt.toISOString(),
        payer: {
          email: user.email,
          first_name: user.user_metadata?.name ?? "Cliente",
        },
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
        external_reference: user.id,
        metadata: {
          user_id: user.id,
          price_id: priceId,
          plan_key: plan.key,
          billing_cycle: plan.cycle,
        },
      }),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago error:", mpData);
      throw new Error(mpData.message || "Erro ao criar pagamento no Mercado Pago");
    }

    const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64;
    const ticketUrl = mpData.point_of_interaction?.transaction_data?.ticket_url;

    // Save in DB using service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { error: dbError } = await supabaseAdmin.from("pix_payments").insert({
      user_id: user.id,
      plan_key: plan.key,
      price_id: priceId,
      billing_cycle: plan.cycle,
      original_amount: plan.price,
      discounted_amount: discountedAmount,
      mercadopago_payment_id: String(mpData.id),
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      ticket_url: ticketUrl,
      status: "pending",
      expires_at: expiresAt.toISOString(),
      payer_email: user.email,
    });

    if (dbError) console.error("DB insert error:", dbError);

    return new Response(
      JSON.stringify({
        payment_id: mpData.id,
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        ticket_url: ticketUrl,
        amount: discountedAmount,
        original_amount: plan.price,
        expires_at: expiresAt.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("create-pix-payment error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
