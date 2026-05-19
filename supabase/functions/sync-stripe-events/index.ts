import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);

const log = (step: string, data?: any) =>
  console.log(`[SYNC-STRIPE-EVENTS] ${step}${data ? " " + JSON.stringify(data) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Pega o created_at do evento mais recente que já temos
    const { data: latest } = await supabaseAdmin
      .from("stripe_event_logs")
      .select("stripe_created_at")
      .order("stripe_created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const since = latest?.stripe_created_at
      ? Math.floor(new Date(latest.stripe_created_at).getTime() / 1000)
      : Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 7; // 7 dias se vazio

    log("Fetching events", { since });

    const events = await stripe.events.list({
      created: { gt: since },
      limit: 100,
    });

    log("Events fetched", { count: events.data.length });

    let inserted = 0;
    for (const ev of events.data) {
      const { error } = await supabaseAdmin.from("stripe_event_logs").upsert(
        {
          stripe_event_id: ev.id,
          type: ev.type,
          status: "received",
          livemode: ev.livemode,
          api_version: ev.api_version,
          payload: ev as any,
          stripe_created_at: new Date(ev.created * 1000).toISOString(),
          processed_at: new Date().toISOString(),
        },
        { onConflict: "stripe_event_id" }
      );
      if (!error) inserted++;
      else log("Insert error", { id: ev.id, err: error.message });
    }

    return new Response(
      JSON.stringify({ ok: true, fetched: events.data.length, inserted }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const e = err as Error;
    log("ERROR", { message: e.message });
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
