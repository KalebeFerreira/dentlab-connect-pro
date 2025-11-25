import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pickup_address, delivery_address, city, state } = await req.json();

    console.log("Calculating delivery fee for:", {
      pickup_address,
      delivery_address,
      city,
      state
    });

    // Format addresses with city and state for better geocoding
    const pickupQuery = city && state 
      ? `${pickup_address}, ${city}, ${state}, Brazil`
      : `${pickup_address}, Brazil`;
    
    const deliveryQuery = city && state
      ? `${delivery_address}, ${city}, ${state}, Brazil`
      : `${delivery_address}, Brazil`;

    // Geocode pickup address using Nominatim (OpenStreetMap)
    const pickupGeocode = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pickupQuery)}&limit=3&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'DentalLabDelivery/1.0'
        }
      }
    );
    const pickupData = await pickupGeocode.json();
    
    console.log("Pickup geocoding results:", pickupData.length);
    
    if (!pickupData || pickupData.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Endereço de origem não encontrado. Tente adicionar mais detalhes como CEP, cidade ou estado.',
          suggestions: 'Exemplo: Rua X, 123, Bairro Y, Cidade - Estado'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const pickupLat = parseFloat(pickupData[0].lat);
    const pickupLng = parseFloat(pickupData[0].lon);

    // Add delay to respect Nominatim rate limits (1 request per second)
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Geocode delivery address
    const deliveryGeocode = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(deliveryQuery)}&limit=3&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'DentalLabDelivery/1.0'
        }
      }
    );
    const deliveryData = await deliveryGeocode.json();

    console.log("Delivery geocoding results:", deliveryData.length);

    if (!deliveryData || deliveryData.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Endereço de destino não encontrado. Tente adicionar mais detalhes como CEP, cidade ou estado.',
          suggestions: 'Exemplo: Rua X, 123, Bairro Y, Cidade - Estado'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const deliveryLat = parseFloat(deliveryData[0].lat);
    const deliveryLng = parseFloat(deliveryData[0].lon);

    // Calculate distance using Haversine formula
    const distance_km = calculateDistance(pickupLat, pickupLng, deliveryLat, deliveryLng);

    // Calculate delivery fee based on distance
    // Base fee: R$ 10.00
    // Additional: R$ 2.50 per km
    const base_fee = 10.00;
    const per_km_rate = 2.50;
    const delivery_fee = base_fee + (distance_km * per_km_rate);

    console.log("Calculated:", {
      distance_km: distance_km.toFixed(2),
      delivery_fee: delivery_fee.toFixed(2),
      pickup_coords: [pickupLat, pickupLng],
      delivery_coords: [deliveryLat, deliveryLng]
    });

    return new Response(
      JSON.stringify({
        distance_km: parseFloat(distance_km.toFixed(2)),
        delivery_fee: parseFloat(delivery_fee.toFixed(2)),
        base_fee,
        per_km_rate,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng
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