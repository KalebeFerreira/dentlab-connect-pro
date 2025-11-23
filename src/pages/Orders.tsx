import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, FileText, Building2, User, Calendar, Filter } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";

interface Laboratory {
  id: string;
  lab_name: string;
}

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
  laboratory_id: string | null;
  laboratory_info?: Laboratory | null;
}

const Orders = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [selectedLab, setSelectedLab] = useState<string>("all");

  useEffect(() => {
    checkAuthAndLoadOrders();
    loadLaboratories();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [selectedLab, orders]);

  const checkAuthAndLoadOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          laboratory_info:laboratory_id (
            id,
            lab_name
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setOrders(data || []);
      setFilteredOrders(data || []);
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadLaboratories = async () => {
    try {
      const { data, error } = await supabase
        .from("laboratory_info")
        .select("id, lab_name")
        .eq("is_public", true)
        .order("lab_name");

      if (error) throw error;
      setLaboratories(data || []);
    } catch (error) {
      console.error("Error loading laboratories:", error);
    }
  };

  const filterOrders = () => {
    if (selectedLab === "all") {
      setFilteredOrders(orders);
    } else if (selectedLab === "none") {
      setFilteredOrders(orders.filter(order => !order.laboratory_id));
    } else {
      setFilteredOrders(orders.filter(order => order.laboratory_id === selectedLab));
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
        <div className="space-y-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Minhas Ordens</h2>
              <p className="text-sm text-muted-foreground">
                {filteredOrders.length} {filteredOrders.length === 1 ? "ordem" : "ordens"} 
                {selectedLab !== "all" && " filtrada(s)"}
              </p>
            </div>
            <Button onClick={() => navigate("/orders/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Ordem
            </Button>
          </div>

          {orders.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedLab} onValueChange={setSelectedLab}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Filtrar por laboratório" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os laboratórios</SelectItem>
                  <SelectItem value="none">Sem laboratório</SelectItem>
                  {laboratories.map((lab) => (
                    <SelectItem key={lab.id} value={lab.id}>
                      {lab.lab_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
            {filteredOrders.map((order) => (
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
                    {order.laboratory_info && (
                      <div className="flex items-center text-muted-foreground">
                        <Building2 className="w-4 h-4 mr-2" />
                        <span>Lab: {order.laboratory_info.lab_name}</span>
                      </div>
                    )}
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
