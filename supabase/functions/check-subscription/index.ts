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

function safeParseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  try {
    if (typeof value === 'number') {
      // Stripe envia timestamps Unix em segundos; valores já em ms são preservados.
      const ms = value < 1e10 ? value * 1000 : value;
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : d;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;

      // ISO / RFC (inclui strings com timezone)
      const iso = new Date(trimmed);
      if (!isNaN(iso.getTime())) return iso;

      // DD/MM/YYYY ou DD-MM-YYYY
      const dmy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (dmy) {
        let [, d, m, y] = dmy;
        let yearNum = parseInt(y);
        if (yearNum < 100) yearNum += 2000;
        const dayNum = parseInt(d);
        const monthNum = parseInt(m);
        if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;
        const result = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
        if (result.getUTCDate() !== dayNum || result.getUTCMonth() !== monthNum - 1) return null;
        return result;
      }
    }
  } catch (err) {
    // qualquer exceção no parse retorna null
  }

  return null;
}

function isDateAfter(value: unknown, reference: Date = new Date()): boolean {
  const d = safeParseDate(value);
  if (!d) return false;
  return d.getTime() > reference.getTime();
}

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

    // Helper: return DB-stored subscription (manual liberation fallback)
    const returnFromDb = async (reason: string) => {
      const { data: dbSub } = await supabaseClient
        .from("user_subscriptions")
        .select("plan_name, status, stripe_price_id, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle();

      const isActive = dbSub && (
        dbSub.status === "active" ||
        dbSub.status === "trialing" ||
        (dbSub.status === "canceled" && isDateAfter(dbSub.current_period_end))
      );

      logStep("Returning from DB fallback", { reason, planName: dbSub?.plan_name, isActive });

      return new Response(JSON.stringify({
        subscribed: Boolean(isActive),
        product_id: null,
        price_id: dbSub?.stripe_price_id || null,
        plan_name: isActive ? (dbSub?.plan_name || "free") : "free",
        subscription_end: dbSub?.current_period_end || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    };

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      return await returnFromDb("no stripe customer");
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    const subscription = subscriptions.data
      .filter((sub) => ["active", "trialing"].includes(sub.status))
      .sort((a, b) => b.created - a.created)[0];
    const hasActiveSub = Boolean(subscription);
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
    if (hasActiveSub) {
      const endDate = safeParseDate(subscription.current_period_end);
      subscriptionEnd = endDate ? endDate.toISOString() : null;
      productId = subscription.items.data[0].price.product as string;
      priceId = subscription.items.data[0].price.id;
      planName = PRICE_TO_PLAN[priceId] || "basic";
      logStep("Valid subscription found", { subscriptionId: subscription.id, status: subscription.status, endDate: subscriptionEnd, priceId, planName });
    } else {
      logStep("No active or trialing subscription found");
    }

    // If Stripe has no active sub, fall back to DB record (preserves manual liberations)
    if (!hasActiveSub) {
      return await returnFromDb("no active stripe subscription");
    }

    // Upsert into user_subscriptions so backend PDF/feature checks recognize paid/trial users immediately
    try {
      const normalizedStatus = "active";


      await supabaseClient.from("user_subscriptions").upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription?.id || null,
        stripe_price_id: priceId,
        plan_name: planName,
        status: normalizedStatus,
        current_period_start: subscription ? (safeParseDate(subscription.current_period_start)?.toISOString() ?? null) : null,
        current_period_end: subscriptionEnd,
        cancel_at_period_end: subscription?.cancel_at_period_end || false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      logStep("user_subscriptions upserted", { planName, stripeStatus: subscription?.status || "none", storedStatus: normalizedStatus });
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
