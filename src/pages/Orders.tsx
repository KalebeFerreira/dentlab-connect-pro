import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, FileText, Building2, User, Calendar } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

interface Order {
  id: string;
  clinic_name: string;
  dentist_name: string;
  patient_name: string;
  work_name: string | null;
  work_type: string;
  custom_color: string | null;
  amount: number | null;
  status: string;
  created_at: string;
}

const Orders = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    checkAuthAndLoadOrders();
  }, []);

  const checkAuthAndLoadOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setOrders(data || []);
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Ordens de Trabalho</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie todas as suas ordens de trabalho
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold">Minhas Ordens</h2>
            <p className="text-sm text-muted-foreground">
              {orders.length} {orders.length === 1 ? "ordem" : "ordens"} no total
            </p>
          </div>
          <Button onClick={() => navigate("/orders/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Ordem
          </Button>
        </div>

        {orders.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma ordem encontrada</h3>
              <p className="text-sm text-muted-foreground text-center mb-6 max-w-sm">
                Você ainda não criou nenhuma ordem de trabalho. Clique no botão abaixo para começar.
              </p>
              <Button onClick={() => navigate("/orders/new")}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeira Ordem
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => (
              <Card 
                key={order.id} 
                className="shadow-card hover:shadow-elevated transition-smooth cursor-pointer"
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {order.patient_name}
                      </h3>
                      {order.work_name && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {order.work_name}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <Building2 className="w-4 h-4 mr-2" />
                      <span>{order.clinic_name}</span>
                    </div>
                    <div className="flex items-center text-muted-foreground">
                      <User className="w-4 h-4 mr-2" />
                      <span>Dr(a). {order.dentist_name}</span>
                    </div>
                    <div className="flex items-center text-muted-foreground">
                      <FileText className="w-4 h-4 mr-2" />
                      <span className="capitalize">{order.work_type.replace("_", " ")}</span>
                    </div>
                    {order.custom_color && (
                      <div className="flex items-center text-muted-foreground">
                        <span className="w-4 h-4 mr-2 rounded-full border bg-white" />
                        <span>Cor: {order.custom_color}</span>
                      </div>
                    )}
                    {order.amount && (
                      <div className="flex items-center text-muted-foreground font-semibold">
                        <span className="mr-2">💰</span>
                        <span>R$ {order.amount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex items-center text-muted-foreground pt-2 border-t">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>{new Date(order.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Orders;
