import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    const products = [];

    // Plano Básico - Mensal (R$ 44)
    const basicMonthly = await stripe.products.create({
      name: "Plano Básico - Mensal",
      description: "200 pedidos/mês, 200 pacientes, 70 gerações de imagem IA, 150 PDFs, tabelas ilimitadas, 40 relatórios mensais",
    });
    const basicMonthlyPrice = await stripe.prices.create({
      product: basicMonthly.id,
      unit_amount: 4400,
      currency: "brl",
      recurring: { interval: "month" },
    });
    products.push({ name: basicMonthly.name, product_id: basicMonthly.id, price_id: basicMonthlyPrice.id });

    // Plano Básico - Anual (R$ 396 = 12 meses com desconto)
    const basicAnnual = await stripe.products.create({
      name: "Plano Básico - Anual",
      description: "200 pedidos/mês, 200 pacientes, 70 gerações de imagem IA, 150 PDFs, tabelas ilimitadas, 40 relatórios mensais",
    });
    const basicAnnualPrice = await stripe.prices.create({
      product: basicAnnual.id,
      unit_amount: 39600,
      currency: "brl",
      recurring: { interval: "year" },
    });
    products.push({ name: basicAnnual.name, product_id: basicAnnual.id, price_id: basicAnnualPrice.id });

    // Plano Profissional - Mensal (R$ 84)
    const proMonthly = await stripe.products.create({
      name: "Plano Profissional - Mensal",
      description: "Pedidos ilimitados, pacientes ilimitados, 150 gerações de imagem IA, 300 PDFs, tabelas ilimitadas, relatórios ilimitados",
    });
    const proMonthlyPrice = await stripe.prices.create({
      product: proMonthly.id,
      unit_amount: 8400,
      currency: "brl",
      recurring: { interval: "month" },
    });
    products.push({ name: proMonthly.name, product_id: proMonthly.id, price_id: proMonthlyPrice.id });

    // Plano Profissional - Anual (R$ 756 = 12 meses com desconto)
    const proAnnual = await stripe.products.create({
      name: "Plano Profissional - Anual",
      description: "Pedidos ilimitados, pacientes ilimitados, 150 gerações de imagem IA, 300 PDFs, tabelas ilimitadas, relatórios ilimitados",
    });
    const proAnnualPrice = await stripe.prices.create({
      product: proAnnual.id,
      unit_amount: 75600,
      currency: "brl",
      recurring: { interval: "year" },
    });
    products.push({ name: proAnnual.name, product_id: proAnnual.id, price_id: proAnnualPrice.id });

    // Plano Premium - Mensal (R$ 140)
    const premiumMonthly = await stripe.products.create({
      name: "Plano Premium - Mensal",
      description: "Tudo ilimitado: pedidos, pacientes, imagens IA, PDFs, tabelas, relatórios, suporte prioritário",
    });
    const premiumMonthlyPrice = await stripe.prices.create({
      product: premiumMonthly.id,
      unit_amount: 14000,
      currency: "brl",
      recurring: { interval: "month" },
    });
    products.push({ name: premiumMonthly.name, product_id: premiumMonthly.id, price_id: premiumMonthlyPrice.id });

    // Plano Premium - Anual (R$ 1260 = 12 meses com desconto)
    const premiumAnnual = await stripe.products.create({
      name: "Plano Premium - Anual",
      description: "Tudo ilimitado: pedidos, pacientes, imagens IA, PDFs, tabelas, relatórios, suporte prioritário",
    });
    const premiumAnnualPrice = await stripe.prices.create({
      product: premiumAnnual.id,
      unit_amount: 126000,
      currency: "brl",
      recurring: { interval: "year" },
    });
    products.push({ name: premiumAnnual.name, product_id: premiumAnnual.id, price_id: premiumAnnualPrice.id });

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Produtos criados com sucesso!",
      products 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Erro ao criar produtos:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
