import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pickup_address, delivery_address } = await req.json();

    console.log("Calculating delivery fee for:", {
      pickup_address,
      delivery_address
    });

    // Simulated distance calculation (in a real app, you would use Google Maps API or similar)
    // For now, we'll calculate a random distance between 1 and 50 km
    const distance_km = Math.random() * 49 + 1;

    // Calculate delivery fee based on distance
    // Base fee: R$ 10.00
    // Additional: R$ 2.50 per km
    const base_fee = 10.00;
    const per_km_rate = 2.50;
    const delivery_fee = base_fee + (distance_km * per_km_rate);

    console.log("Calculated:", {
      distance_km: distance_km.toFixed(2),
      delivery_fee: delivery_fee.toFixed(2)
    });

    return new Response(
      JSON.stringify({
        distance_km: parseFloat(distance_km.toFixed(2)),
        delivery_fee: parseFloat(delivery_fee.toFixed(2)),
        base_fee,
        per_km_rate
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error("Error calculating delivery fee:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});