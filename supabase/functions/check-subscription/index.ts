import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("No authorization header");
      return new Response(JSON.stringify({ 
        subscribed: false,
        product_id: null 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    
    // Validate token format
    if (!token || token === "undefined" || token === "null" || token.length < 20) {
      logStep("Invalid token format");
      return new Response(JSON.stringify({ 
        subscribed: false,
        product_id: null 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      logStep("Authentication failed", { error: userError?.message });
      return new Response(JSON.stringify({ 
        subscribed: false,
        product_id: null 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    const user = userData.user;
    if (!user?.email) {
      logStep("User email not available");
      return new Response(JSON.stringify({ 
        subscribed: false,
        product_id: null 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, updating unsubscribed state");
      return new Response(JSON.stringify({ subscribed: false, product_id: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    const hasActiveSub = subscriptions.data.length > 0;
    let productId = null;
    let subscriptionEnd = null;
    let priceId = null;

    // Map price_id -> plan_name (must match useSubscription PLANS)
    const PRICE_TO_PLAN: Record<string, string> = {
      "price_1SYVOhF2249riykhzMKCVXNw": "basic",
      "price_1SYVOhF2249riykh1HAwzkce": "basic",
      "price_1SYVOiF2249riykhLo07A0Lx": "professional",
      "price_1SYVOiF2249riykhphMkNE0w": "professional",
      "price_1SYVOjF2249riykhJmw4RoVM": "premium",
      "price_1SYVOjF2249riykhi2o98hEf": "premium",
      "price_1Sq1xDF2249riykhpt3dJbLS": "super_premium",
      "price_1Sq1xZF2249riykhmTrDAtsF": "super_premium",
    };

    let planName = "free";
    let subscription: any = null;

    if (hasActiveSub) {
      subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      productId = subscription.items.data[0].price.product as string;
      priceId = subscription.items.data[0].price.id;
      planName = PRICE_TO_PLAN[priceId] || "basic";
      logStep("Active subscription found", { subscriptionId: subscription.id, endDate: subscriptionEnd, priceId, planName });
    } else {
      logStep("No active subscription found");
    }

    // Upsert into user_subscriptions so backend PDF/feature checks recognize paid users immediately
    try {
      await supabaseClient.from("user_subscriptions").upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription?.id || null,
        stripe_price_id: priceId,
        plan_name: planName,
        status: hasActiveSub ? "active" : "canceled",
        current_period_start: subscription ? new Date(subscription.current_period_start * 1000).toISOString() : null,
        current_period_end: subscriptionEnd,
        cancel_at_period_end: subscription?.cancel_at_period_end || false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      logStep("user_subscriptions upserted", { planName, status: hasActiveSub ? "active" : "canceled" });
    } catch (upsertErr) {
      logStep("Failed to upsert user_subscriptions", { error: String(upsertErr) });
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      price_id: priceId,
      plan_name: planName,
      subscription_end: subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
