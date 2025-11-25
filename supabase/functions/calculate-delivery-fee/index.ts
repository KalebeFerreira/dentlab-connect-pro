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
    const { pickup_address, delivery_address } = await req.json();

    console.log("Calculating delivery fee for:", {
      pickup_address,
      delivery_address
    });

    // Geocode pickup address using Nominatim (OpenStreetMap)
    const pickupGeocode = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pickup_address)},Brazil&limit=1`,
      {
        headers: {
          'User-Agent': 'DentalLabDelivery/1.0'
        }
      }
    );
    const pickupData = await pickupGeocode.json();
    
    if (!pickupData || pickupData.length === 0) {
      throw new Error('Endereço de origem não encontrado');
    }

    const pickupLat = parseFloat(pickupData[0].lat);
    const pickupLng = parseFloat(pickupData[0].lon);

    // Geocode delivery address
    const deliveryGeocode = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(delivery_address)},Brazil&limit=1`,
      {
        headers: {
          'User-Agent': 'DentalLabDelivery/1.0'
        }
      }
    );
    const deliveryData = await deliveryGeocode.json();

    if (!deliveryData || deliveryData.length === 0) {
      throw new Error('Endereço de destino não encontrado');
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