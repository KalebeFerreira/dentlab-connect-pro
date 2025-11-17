import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  FileText, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  LogOut,
  Plus,
  TrendingUp,
  TrendingDown,
  Users,
  Sparkles
} from "lucide-react";

interface OrderStats {
  total: number;
  pending: number;
  in_production: number;
  completed: number;
}

interface FinancialStats {
  income: number;
  expense: number;
  profit: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    in_production: 0,
    completed: 0,
  });
  const [financialStats, setFinancialStats] = useState<FinancialStats>({
    income: 0,
    expense: 0,
    profit: 0,
  });

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUser(user);
      await loadStats(user.id);
    } catch (error) {
      console.error("Error checking user:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async (userId: string) => {
    try {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("status")
        .eq("user_id", userId);

      if (error) throw error;

      const stats: OrderStats = {
        total: orders?.length || 0,
        pending: orders?.filter(o => o.status === "pending").length || 0,
        in_production: orders?.filter(o => o.status === "in_production").length || 0,
        completed: orders?.filter(o => o.status === "completed" || o.status === "delivered").length || 0,
      };

      setStats(stats);
      await loadFinancialStats(userId);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadFinancialStats = async (userId: string) => {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const { data: transactions, error } = await supabase
        .from("financial_transactions")
        .select("transaction_type, amount, status")
        .eq("user_id", userId)
        .eq("month", currentMonth)
        .eq("year", currentYear);

      if (error) throw error;

      const income = transactions
        ?.filter((t) => t.transaction_type === "receipt" && t.status === "completed")
        .reduce((sum, t) => sum + t.amount, 0) || 0;

      const expense = transactions
        ?.filter((t) => t.transaction_type === "payment" && t.status === "completed")
        .reduce((sum, t) => sum + t.amount, 0) || 0;

      setFinancialStats({
        income,
        expense,
        profit: income - expense,
      });
    } catch (error) {
      console.error("Error loading financial stats:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logout realizado com sucesso!");
      navigate("/auth");
    } catch (error: any) {
      toast.error("Erro ao fazer logout", {
        description: error.message,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const userType = user?.user_metadata?.user_type || "clinic";
  const userName = user?.user_metadata?.name || user?.email;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-6 h-6 text-primary-foreground"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold">DentLab Connect</h1>
              <p className="text-xs text-muted-foreground">
                {userType === "clinic" ? "Painel da Clínica" : "Painel do Laboratório"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <Button variant="outline" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Bem-vindo, {userName?.split(" ")[0]}!
          </h2>
          <p className="text-muted-foreground">
            Gerencie suas ordens de trabalho e acompanhe seus resultados
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="shadow-card hover:shadow-elevated transition-smooth">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Ordens
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.total === 0 ? "Nenhuma ordem cadastrada" : "Ordens criadas"}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-elevated transition-smooth">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Em Produção
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.in_production}</div>
              <p className="text-xs text-muted-foreground">
                Aguardando conclusão
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-card hover:shadow-elevated transition-smooth">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Concluídas
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">
                Este mês
              </p>
            </CardContent>
          </Card>

          <Card 
            className="shadow-card hover:shadow-elevated transition-smooth cursor-pointer"
            onClick={() => navigate("/financial")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Lucro Líquido
              </CardTitle>
              <TrendingUp className={`h-4 w-4 ${financialStats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${financialStats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                R$ {financialStats.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Este mês • Clique para detalhes
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card 
            className="shadow-card hover:shadow-elevated transition-smooth cursor-pointer"
            onClick={() => navigate("/financial")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Receitas do Mês
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {financialStats.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Clique para gerenciar
              </p>
            </CardContent>
          </Card>

          <Card 
            className="shadow-card hover:shadow-elevated transition-smooth cursor-pointer"
            onClick={() => navigate("/financial")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Despesas do Mês
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                R$ {financialStats.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Clique para gerenciar
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
              <CardDescription>
                Gerencie suas ordens de trabalho
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full justify-start" 
                onClick={() => navigate("/orders/new")}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nova Ordem de Trabalho
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate("/orders")}
              >
                <FileText className="mr-2 h-4 w-4" />
                Ver Todas as Ordens
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate("/financial")}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Controle Financeiro
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate("/image-generator")}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Gerador de Imagens IA
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Atividade Recente</CardTitle>
              <CardDescription>
                Últimas atualizações do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma atividade registrada</p>
                <p className="text-sm mt-1">
                  Comece criando sua primeira ordem de trabalho
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Banner */}
        <Card className="mt-6 border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-4 pt-6">
            <TrendingUp className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1">Bem-vindo ao DentLab Connect!</h3>
              <p className="text-sm text-muted-foreground">
                Esta é a primeira versão da plataforma. Você pode criar ordens de trabalho, 
                acompanhar o status e gerenciar suas finanças. Mais recursos serão adicionados em breve!
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
