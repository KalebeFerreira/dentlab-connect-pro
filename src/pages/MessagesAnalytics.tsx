import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MessageCircle, TrendingUp, Calendar, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface MessageStats {
  total: number;
  byType: Record<string, number>;
  byPeriod: Array<{ date: string; count: number }>;
  byStatus: Record<string, number>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const messageTypeLabels: Record<string, string> = {
  appointment_reminder: "Lembrete de Agendamento",
  appointment_confirmation: "Confirmação",
  general: "Geral",
};

const MessagesAnalytics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MessageStats>({
    total: 0,
    byType: {},
    byPeriod: [],
    byStatus: {},
  });
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    checkAuth();
    loadStats();
  }, [startDate, endDate]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    }
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("message_history")
        .select("*")
        .eq("user_id", user.id)
        .gte("sent_at", startDate)
        .lte("sent_at", `${endDate}T23:59:59`);

      if (error) throw error;

      // Calcular estatísticas
      const byType: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      const byDate: Record<string, number> = {};

      data?.forEach((message) => {
        // Por tipo
        byType[message.message_type] = (byType[message.message_type] || 0) + 1;
        
        // Por status
        byStatus[message.status] = (byStatus[message.status] || 0) + 1;
        
        // Por data
        const date = new Date(message.sent_at).toLocaleDateString('pt-BR');
        byDate[date] = (byDate[date] || 0) + 1;
      });

      const byPeriod = Object.entries(byDate).map(([date, count]) => ({
        date,
        count,
      }));

      setStats({
        total: data?.length || 0,
        byType,
        byPeriod,
        byStatus,
      });
    } catch (error: any) {
      toast.error("Erro ao carregar estatísticas", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const pieChartData = Object.entries(stats.byType).map(([type, count]) => ({
    name: messageTypeLabels[type] || type,
    value: count,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Análise de Mensagens</h1>
        <p className="text-muted-foreground">
          Estatísticas e métricas de mensagens enviadas
        </p>
      </div>

      {/* Filtros de data */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Período de Análise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={loadStats} className="w-full">
                Atualizar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {startDate} até {endDate}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Enviadas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byStatus.sent || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Status: Enviado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tipos Diferentes</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(stats.byType).length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Categorias únicas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de barras - Mensagens por período */}
        <Card>
          <CardHeader>
            <CardTitle>Mensagens por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.byPeriod.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.byPeriod}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={12}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#8884d8" name="Mensagens" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de pizza - Mensagens por tipo */}
        <Card>
          <CardHeader>
            <CardTitle>Mensagens por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de resumo por tipo */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Detalhamento por Tipo de Mensagem</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between border-b pb-2">
                <div>
                  <p className="font-medium">{messageTypeLabels[type] || type}</p>
                  <p className="text-sm text-muted-foreground">
                    {((count / stats.total) * 100).toFixed(1)}% do total
                  </p>
                </div>
                <div className="text-2xl font-bold">{count}</div>
              </div>
            ))}
            {Object.keys(stats.byType).length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma mensagem encontrada no período selecionado
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MessagesAnalytics;
