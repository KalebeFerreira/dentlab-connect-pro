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

    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    if (!MAPBOX_TOKEN) {
      throw new Error('MAPBOX_ACCESS_TOKEN is not configured');
    }

    // Geocode pickup address
    const pickupGeocode = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(pickup_address)}.json?access_token=${MAPBOX_TOKEN}&country=BR&limit=1`
    );
    const pickupData = await pickupGeocode.json();
    
    if (!pickupData.features || pickupData.features.length === 0) {
      throw new Error('Endereço de origem não encontrado');
    }

    const pickupCoords = pickupData.features[0].center; // [lng, lat]

    // Geocode delivery address
    const deliveryGeocode = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(delivery_address)}.json?access_token=${MAPBOX_TOKEN}&country=BR&limit=1`
    );
    const deliveryData = await deliveryGeocode.json();

    if (!deliveryData.features || deliveryData.features.length === 0) {
      throw new Error('Endereço de destino não encontrado');
    }

    const deliveryCoords = deliveryData.features[0].center; // [lng, lat]

    // Calculate distance using Mapbox Directions API
    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${pickupCoords[0]},${pickupCoords[1]};${deliveryCoords[0]},${deliveryCoords[1]}?access_token=${MAPBOX_TOKEN}&geometries=geojson`;
    
    const directionsResponse = await fetch(directionsUrl);
    const directionsData = await directionsResponse.json();

    if (!directionsData.routes || directionsData.routes.length === 0) {
      throw new Error('Não foi possível calcular a rota');
    }

    const distanceMeters = directionsData.routes[0].distance;
    const distance_km = distanceMeters / 1000;

    // Calculate delivery fee based on distance
    // Base fee: R$ 10.00
    // Additional: R$ 2.50 per km
    const base_fee = 10.00;
    const per_km_rate = 2.50;
    const delivery_fee = base_fee + (distance_km * per_km_rate);

    console.log("Calculated:", {
      distance_km: distance_km.toFixed(2),
      delivery_fee: delivery_fee.toFixed(2),
      pickup_coords: pickupCoords,
      delivery_coords: deliveryCoords
    });

    return new Response(
      JSON.stringify({
        distance_km: parseFloat(distance_km.toFixed(2)),
        delivery_fee: parseFloat(delivery_fee.toFixed(2)),
        base_fee,
        per_km_rate,
        pickup_lat: pickupCoords[1],
        pickup_lng: pickupCoords[0],
        delivery_lat: deliveryCoords[1],
        delivery_lng: deliveryCoords[0],
        route_geometry: directionsData.routes[0].geometry
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