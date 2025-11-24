import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Package, Truck, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Delivery {
  id: string;
  tracking_code: string;
  pickup_address: string;
  delivery_address: string;
  recipient_name: string;
  recipient_phone: string;
  delivery_fee: number;
  distance_km: number;
  status: string;
  notes: string | null;
  created_at: string;
  picked_up_at: string | null;
  delivered_at: string | null;
  delivery_person: {
    name: string;
    phone: string;
    vehicle_type: string;
  } | null;
}

interface TrackingEvent {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
}

const DeliveryDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [tracking, setTracking] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDelivery();
    setupRealtimeSubscription();
  }, [id]);

  const loadDelivery = async () => {
    try {
      const { data: deliveryData, error: deliveryError } = await supabase
        .from("deliveries")
        .select(`
          *,
          delivery_person:delivery_persons(name, phone, vehicle_type)
        `)
        .eq("id", id)
        .single();

      if (deliveryError) throw deliveryError;

      const { data: trackingData, error: trackingError } = await supabase
        .from("delivery_tracking")
        .select("*")
        .eq("delivery_id", id)
        .order("created_at", { ascending: false });

      if (trackingError) throw trackingError;

      setDelivery(deliveryData);
      setTracking(trackingData || []);
    } catch (error) {
      console.error("Error loading delivery:", error);
      toast.error("Erro ao carregar entrega");
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`delivery-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deliveries",
          filter: `id=eq.${id}`,
        },
        () => {
          loadDelivery();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_tracking",
          filter: `delivery_id=eq.${id}`,
        },
        () => {
          loadDelivery();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const updateStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from("deliveries")
        .update({
          status: newStatus,
          ...(newStatus === "in_transit" && { picked_up_at: new Date().toISOString() }),
          ...(newStatus === "delivered" && { delivered_at: new Date().toISOString() }),
        })
        .eq("id", id);

      if (error) throw error;

      await supabase.from("delivery_tracking").insert({
        delivery_id: id,
        status: newStatus,
        notes: `Status atualizado para: ${getStatusLabel(newStatus)}`,
      });

      toast.success("Status atualizado!");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendente",
      in_transit: "Em Trânsito",
      delivered: "Entregue",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any }> = {
      pending: { variant: "secondary", icon: Package },
      in_transit: { variant: "default", icon: Truck },
      delivered: { variant: "default", icon: CheckCircle },
      cancelled: { variant: "destructive", icon: Clock },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {getStatusLabel(status)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <p>Entrega não encontrada</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl space-y-6">
      <Button variant="ghost" onClick={() => navigate("/deliveries")}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar
      </Button>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                Entrega #{delivery.tracking_code}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Criada em {format(new Date(delivery.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            {getStatusBadge(delivery.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Origem
              </h3>
              <p className="text-sm text-muted-foreground">{delivery.pickup_address}</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Destino
              </h3>
              <p className="text-sm text-muted-foreground">{delivery.delivery_address}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Destinatário</h3>
              <p className="text-sm">{delivery.recipient_name}</p>
              <p className="text-sm text-muted-foreground">{delivery.recipient_phone}</p>
            </div>

            {delivery.delivery_person && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Motoboy
                </h3>
                <p className="text-sm">{delivery.delivery_person.name}</p>
                <p className="text-sm text-muted-foreground">{delivery.delivery_person.phone}</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {delivery.delivery_person.vehicle_type}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground">Distância</p>
              <p className="text-lg font-semibold">{delivery.distance_km} km</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Taxa de Entrega</p>
              <p className="text-lg font-semibold text-green-600">
                R$ {delivery.delivery_fee.toFixed(2)}
              </p>
            </div>
          </div>

          {delivery.notes && (
            <div>
              <h3 className="font-semibold mb-2">Observações</h3>
              <p className="text-sm text-muted-foreground">{delivery.notes}</p>
            </div>
          )}

          {delivery.status === "pending" && (
            <div className="flex gap-2">
              <Button onClick={() => updateStatus("in_transit")} className="flex-1">
                Iniciar Entrega
              </Button>
            </div>
          )}

          {delivery.status === "in_transit" && (
            <div className="flex gap-2">
              <Button onClick={() => updateStatus("delivered")} className="flex-1">
                Confirmar Entrega
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rastreamento</CardTitle>
        </CardHeader>
        <CardContent>
          {tracking.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum evento de rastreamento registrado
            </p>
          ) : (
            <div className="space-y-4">
              {tracking.map((event, index) => (
                <div key={event.id} className="flex gap-4">
                  <div className="relative">
                    <div className="w-3 h-3 rounded-full bg-primary mt-1.5" />
                    {index < tracking.length - 1 && (
                      <div className="absolute top-5 left-1/2 -translate-x-1/2 w-0.5 h-full bg-border" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(event.status)}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    {event.notes && (
                      <p className="text-sm text-muted-foreground">{event.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DeliveryDetails;