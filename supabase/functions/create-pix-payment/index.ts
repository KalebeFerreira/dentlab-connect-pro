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

    // Build payer with proper first/last name split (MP requires both for Pix in many accounts)
    const fullName: string = (user.user_metadata?.name ?? "Cliente Lovable").toString().trim();
    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0] || "Cliente";
    const lastName = nameParts.slice(1).join(" ") || "Lovable";

    // MP doesn't allow paying yourself. If payer email matches the receiver account,
    // use a generic payer email (real email is preserved in metadata + external_reference).
    const RECEIVER_EMAILS = new Set([
      "joseedimilsonmessiaspassos@gmail.com",
      "joseedimilsonmessiaspassos80@gmail.com",
    ]);
    const payerEmail = RECEIVER_EMAILS.has(user.email.toLowerCase())
      ? `pagador+${user.id.slice(0, 8)}@dentlab.app`
      : user.email;

    const payerBody: Record<string, unknown> = {
      email: payerEmail,
      first_name: firstName,
      last_name: lastName,
    };

    // If CPF is stored in user_metadata, include it (MP requires identification in some flows)
    const cpf = (user.user_metadata?.cpf ?? user.user_metadata?.document ?? "")
      .toString()
      .replace(/\D/g, "");
    if (cpf.length === 11) {
      payerBody.identification = { type: "CPF", number: cpf };
    }

    const mpPayload = {
      transaction_amount: discountedAmount,
      description: `${plan.name} (${plan.cycle === "annual" ? "Anual" : "Mensal"}) - 10% OFF PIX`,
      payment_method_id: "pix",
      date_of_expiration: expiresAt.toISOString(),
      payer: payerBody,
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
      external_reference: user.id,
      metadata: {
        user_id: user.id,
        price_id: priceId,
        plan_key: plan.key,
        billing_cycle: plan.cycle,
      },
    };

    console.log("MP request payload:", JSON.stringify(mpPayload));

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(mpPayload),
    });

    const rawText = await mpResponse.text();
    let mpData: any;
    try {
      mpData = JSON.parse(rawText);
    } catch {
      mpData = { raw: rawText };
    }

    if (!mpResponse.ok) {
      console.error("Mercado Pago error - status:", mpResponse.status, "body:", rawText);
      const detail =
        mpData?.cause?.[0]?.description ||
        mpData?.cause?.[0]?.code ||
        mpData?.message ||
        rawText ||
        "Erro ao criar pagamento no Mercado Pago";
      throw new Error(`MP ${mpResponse.status}: ${detail}`);
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
