import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Package, Truck, MapPin, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Delivery {
  id: string;
  tracking_code: string;
  pickup_address: string;
  delivery_address: string;
  recipient_name: string;
  delivery_fee: number;
  distance_km: number;
  status: string;
  created_at: string;
  delivery_person: {
    name: string;
  } | null;
}

const Deliveries = () => {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    in_transit: 0,
    delivered: 0,
    total: 0,
  });

  useEffect(() => {
    loadDeliveries();
    setupRealtimeSubscription();
  }, []);

  const loadDeliveries = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase
        .from("deliveries")
        .select(`
          *,
          delivery_person:delivery_persons(name)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setDeliveries(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error("Error loading deliveries:", error);
      toast.error("Erro ao carregar entregas");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (deliveries: Delivery[]) => {
    const pending = deliveries.filter((d) => d.status === "pending").length;
    const in_transit = deliveries.filter((d) => d.status === "in_transit").length;
    const delivered = deliveries.filter((d) => d.status === "delivered").length;
    
    setStats({
      pending,
      in_transit,
      delivered,
      total: deliveries.length,
    });
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel("deliveries-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deliveries",
        },
        () => {
          loadDeliveries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      pending: { variant: "secondary", icon: Package, label: "Pendente" },
      in_transit: { variant: "default", icon: Truck, label: "Em Trânsito" },
      delivered: { variant: "default", icon: CheckCircle, label: "Entregue" },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
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

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Entregas</h1>
          <p className="text-muted-foreground">Gerencie todas as entregas</p>
        </div>
        <Button onClick={() => navigate("/deliveries/new")}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Entrega
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Em Trânsito
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.in_transit}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Entregues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entregas Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma entrega cadastrada</p>
              <Button
                onClick={() => navigate("/deliveries/new")}
                variant="outline"
                className="mt-4"
              >
                Criar primeira entrega
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {deliveries.map((delivery) => (
                <Card
                  key={delivery.id}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => navigate(`/deliveries/${delivery.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">
                            {delivery.tracking_code}
                          </span>
                          {getStatusBadge(delivery.status)}
                        </div>
                        
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="font-medium">{delivery.recipient_name}</p>
                            <p className="text-muted-foreground">{delivery.delivery_address}</p>
                          </div>
                        </div>

                        {delivery.delivery_person && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Truck className="w-4 h-4" />
                            <span>Motoboy: {delivery.delivery_person.name}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-right space-y-1">
                        <p className="text-lg font-bold text-green-600">
                          R$ {delivery.delivery_fee.toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {delivery.distance_km} km
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Deliveries;