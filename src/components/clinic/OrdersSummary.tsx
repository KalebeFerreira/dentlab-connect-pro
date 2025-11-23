import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, CheckCircle, AlertCircle } from "lucide-react";

interface OrderStats {
  total: number;
  pending: number;
  in_production: number;
  completed: number;
}

export const OrdersSummary = () => {
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    in_production: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("orders")
        .select("status")
        .eq("user_id", user.id);

      if (error) throw error;

      const stats: OrderStats = {
        total: data.length,
        pending: data.filter(o => o.status === "pending").length,
        in_production: data.filter(o => o.status === "in_production").length,
        completed: data.filter(o => o.status === "completed").length,
      };

      setStats(stats);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total de Pedidos",
      value: stats.total,
      icon: FileText,
      description: "Pedidos enviados ao laboratório",
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-950",
    },
    {
      title: "Pendentes",
      value: stats.pending,
      icon: AlertCircle,
      description: "Aguardando produção",
      color: "text-yellow-600",
      bgColor: "bg-yellow-100 dark:bg-yellow-950",
    },
    {
      title: "Em Produção",
      value: stats.in_production,
      icon: Clock,
      description: "Sendo produzidos",
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-950",
    },
    {
      title: "Concluídos",
      value: stats.completed,
      icon: CheckCircle,
      description: "Trabalhos finalizados",
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-950",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stat.value}</div>
            <CardDescription className="text-xs mt-1">
              {stat.description}
            </CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};