import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { supabase } from "@/integrations/supabase/client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default marker icons in React-Leaflet
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom icons
const pickupIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const deliveryIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const motoIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface DeliveryMapProps {
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
  deliveryId: string;
  deliveryPersonId?: string;
}

export function DeliveryMap({
  pickupLat,
  pickupLng,
  deliveryLat,
  deliveryLng,
  deliveryId,
  deliveryPersonId,
}: DeliveryMapProps) {
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    // Subscribe to real-time location updates
    const channel = supabase
      .channel(`delivery-tracking-${deliveryId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "delivery_tracking",
          filter: `delivery_id=eq.${deliveryId}`,
        },
        (payload: any) => {
          if (payload.new.location_lat && payload.new.location_lng) {
            setCurrentLocation([payload.new.location_lat, payload.new.location_lng]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deliveryId]);

  const center: [number, number] = [
    (pickupLat + deliveryLat) / 2,
    (pickupLng + deliveryLng) / 2,
  ];

  const routeCoordinates: [number, number][] = [
    [pickupLat, pickupLng],
    [deliveryLat, deliveryLng],
  ];

  return (
    <div className="h-[400px] w-full rounded-lg overflow-hidden border border-border">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <Marker position={[pickupLat, pickupLng]} icon={pickupIcon}>
          <Popup>Ponto de Coleta</Popup>
        </Marker>
        
        <Marker position={[deliveryLat, deliveryLng]} icon={deliveryIcon}>
          <Popup>Ponto de Entrega</Popup>
        </Marker>
        
        {currentLocation && (
          <Marker position={currentLocation} icon={motoIcon}>
            <Popup>Localização Atual do Motoboy</Popup>
          </Marker>
        )}
        
        <Polyline positions={routeCoordinates} color="blue" weight={3} opacity={0.7} />
      </MapContainer>
    </div>
  );
}
