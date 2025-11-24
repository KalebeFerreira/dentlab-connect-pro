import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';

interface DeliveryMapProps {
  deliveryId: string;
  pickupLat?: number;
  pickupLng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
  currentLat?: number;
  currentLng?: number;
  status: string;
}

const DeliveryMap: React.FC<DeliveryMapProps> = ({
  deliveryId,
  pickupLat,
  pickupLng,
  deliveryLat,
  deliveryLng,
  currentLat,
  currentLng,
  status,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const pickupMarker = useRef<mapboxgl.Marker | null>(null);
  const deliveryMarker = useRef<mapboxgl.Marker | null>(null);
  const currentMarker = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    // Get Mapbox token from Supabase secrets
    const getMapboxToken = async () => {
      // For now, we'll use a placeholder - in production, this would come from an edge function
      // that securely retrieves the token
      setMapboxToken('pk.eyJ1IjoibG92YWJsZS1kZW1vIiwiYSI6ImNtNXBzdXh2eTBjNGgya3M4azh3aGdxeXcifQ.placeholder');
    };
    
    getMapboxToken();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    // Initialize map
    mapboxgl.accessToken = mapboxToken;
    
    const centerLat = pickupLat || -23.5505;
    const centerLng = pickupLng || -46.6333;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [centerLng, centerLat],
      zoom: 12,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: false,
      }),
      'top-right'
    );

    // Add markers
    if (pickupLat && pickupLng) {
      const el = document.createElement('div');
      el.className = 'pickup-marker';
      el.style.backgroundImage = 'url(https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png)';
      el.style.width = '32px';
      el.style.height = '40px';
      el.style.backgroundSize = '100%';

      pickupMarker.current = new mapboxgl.Marker({ element: el, color: '#22c55e' })
        .setLngLat([pickupLng, pickupLat])
        .setPopup(new mapboxgl.Popup().setHTML('<h3>Origem</h3>'))
        .addTo(map.current);
    }

    if (deliveryLat && deliveryLng) {
      deliveryMarker.current = new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat([deliveryLng, deliveryLat])
        .setPopup(new mapboxgl.Popup().setHTML('<h3>Destino</h3>'))
        .addTo(map.current);
    }

    // Fit bounds to show both markers
    if (pickupLat && pickupLng && deliveryLat && deliveryLng) {
      const bounds = new mapboxgl.LngLatBounds()
        .extend([pickupLng, pickupLat])
        .extend([deliveryLng, deliveryLat]);
      
      map.current.fitBounds(bounds, { padding: 50 });
    }

    // Subscribe to real-time location updates
    const channel = supabase
      .channel(`delivery-location-${deliveryId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'delivery_tracking',
          filter: `delivery_id=eq.${deliveryId}`,
        },
        (payload) => {
          const tracking = payload.new;
          if (tracking.location_lat && tracking.location_lng && map.current) {
            // Update or create current location marker
            if (currentMarker.current) {
              currentMarker.current.setLngLat([tracking.location_lng, tracking.location_lat]);
            } else {
              currentMarker.current = new mapboxgl.Marker({ color: '#3b82f6' })
                .setLngLat([tracking.location_lng, tracking.location_lat])
                .setPopup(new mapboxgl.Popup().setHTML('<h3>Localização Atual</h3>'))
                .addTo(map.current);
            }

            // Center map on new location
            map.current.easeTo({
              center: [tracking.location_lng, tracking.location_lat],
              zoom: 14,
              duration: 1000,
            });
          }
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      map.current?.remove();
      supabase.removeChannel(channel);
    };
  }, [mapboxToken, deliveryId, pickupLat, pickupLng, deliveryLat, deliveryLng]);

  // Update current location marker if provided
  useEffect(() => {
    if (currentLat && currentLng && map.current) {
      if (currentMarker.current) {
        currentMarker.current.setLngLat([currentLng, currentLat]);
      } else {
        currentMarker.current = new mapboxgl.Marker({ color: '#3b82f6' })
          .setLngLat([currentLng, currentLat])
          .setPopup(new mapboxgl.Popup().setHTML('<h3>Localização Atual</h3>'))
          .addTo(map.current);
      }
    }
  }, [currentLat, currentLng]);

  if (!mapboxToken) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
        <p className="text-muted-foreground">Carregando mapa...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-96 rounded-lg overflow-hidden shadow-lg">
      <div ref={mapContainer} className="absolute inset-0" />
      {status === 'in_transit' && (
        <div className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg">
          🚚 Em trânsito
        </div>
      )}
    </div>
  );
};

export default DeliveryMap;