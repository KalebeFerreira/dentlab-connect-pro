import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Calendar, User, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Order {
  id: string;
  os_number: string | null;
  patient_name: string;
  dentist_name: string;
  work_type: string;
  status: string;
  delivery_date: string | null;
  created_at: string;
  laboratory_id: string | null;
  laboratory_info?: {
    lab_name: string;
  } | null;
}

export const OrdersTracking = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          laboratory_info:laboratory_id (
            lab_name
          )
        `)
        .eq("user_id", user.id)
        .in("status", ["pending", "in_production"])
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pendente", variant: "secondary" as const },
      in_production: { label: "Em Produção", variant: "default" as const },
      completed: { label: "Concluído", variant: "default" as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Acompanhamento de Pedidos</CardTitle>
            <CardDescription>Status dos trabalhos em andamento</CardDescription>
          </div>
          <Button variant="outline" onClick={() => navigate("/orders")}>
            Ver Todos
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum pedido em andamento</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {order.os_number || "S/N"}
                    </span>
                    {getStatusBadge(order.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Paciente: {order.patient_name}
                  </p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {order.dentist_name}
                    </span>
                    {order.delivery_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Entrega: {format(new Date(order.delivery_date), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium">{order.work_type}</p>
                  {order.laboratory_info && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Lab: {order.laboratory_info.lab_name}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};