import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import essenciaLogo from "@/assets/essencia-logo.jpg";
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
  Sparkles,
  FileSpreadsheet,
  Moon,
  Sun,
  Table2,
  Calendar,
  Search,
  Upload,
  FileUp
} from "lucide-react";
import { LaboratoryInfo } from "@/components/LaboratoryInfo";
import { NotificationSettings } from "@/components/NotificationSettings";
import { MessageTemplates } from "@/components/MessageTemplates";
import { QuickSearch } from "@/components/QuickSearch";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check user role and redirect to appropriate dashboard
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleData?.role === 'dentist') {
        navigate("/dentist");
        return;
      }

      if (roleData?.role === 'clinic') {
        navigate("/clinic");
        return;
      }

      if (roleData?.role === 'laboratory') {
        navigate("/laboratory");
        return;
      }

      // If no specific role or admin, continue to main dashboard
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

  const handleSTLUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.stl')) {
      toast.error("Por favor, selecione um arquivo STL");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 20MB");
      return;
    }

    try {
      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/documents/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('laboratory-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('laboratory-files')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from("laboratory_documents")
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: publicUrl,
          file_type: file.type,
          file_size: file.size,
          category: 'stl',
        });

      if (dbError) throw dbError;

      toast.success("Arquivo STL enviado com sucesso!");
      e.target.value = '';
    } catch (error: any) {
      toast.error("Erro ao enviar arquivo", { description: error.message });
    } finally {
      setUploading(false);
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
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg overflow-hidden">
              <img 
                src={essenciaLogo} 
                alt="Essência dental-lab" 
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold">Essência dental-lab</h1>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Alterar tema</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Sun className="mr-2 h-4 w-4" />
                  <span>Claro</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Moon className="mr-2 h-4 w-4" />
                  <span>Escuro</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <span className="mr-2 h-4 w-4">💻</span>
                  <span>Sistema</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">
                Bem-vindo, {userName?.split(" ")[0]}!
              </h2>
              <p className="text-sm md:text-base text-muted-foreground">
                Gerencie suas ordens de trabalho e acompanhe seus resultados
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full md:w-auto"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4 mr-2" />
              Busca Rápida
              <kbd className="hidden md:inline-flex ml-2 pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
          </div>
        </div>

        {/* Quick Actions - Mobile Optimized */}
        <div className="mb-6 lg:hidden">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Ações Rápidas
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Card 
              className="cursor-pointer hover:shadow-md transition-all active:scale-95"
              onClick={() => navigate("/orders/new")}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center gap-2 min-h-[100px]">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-center">Novo Pedido</span>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-all active:scale-95"
              onClick={() => navigate("/orders")}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center gap-2 min-h-[100px]">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-center">Ver Pedidos</span>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-all active:scale-95"
              onClick={() => navigate("/price-table")}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center gap-2 min-h-[100px]">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Table2 className="h-6 w-6 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-center">Tabela Preços</span>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-all active:scale-95"
              onClick={() => navigate("/image-generator")}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center gap-2 min-h-[100px]">
                <div className="w-12 h-12 rounded-full bg-pink-500/10 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-pink-600" />
                </div>
                <span className="text-sm font-medium text-center">Gerar Imagem</span>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-all active:scale-95"
              onClick={() => navigate("/financial")}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center gap-2 min-h-[100px]">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <span className="text-sm font-medium text-center">Financeiro</span>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-all active:scale-95"
              onClick={() => navigate("/billing")}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center gap-2 min-h-[100px]">
                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-6 w-6 text-orange-600" />
                </div>
                <span className="text-sm font-medium text-center">Faturamento</span>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-all active:scale-95"
              onClick={() => navigate("/appointments")}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center gap-2 min-h-[100px]">
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-cyan-600" />
                </div>
                <span className="text-sm font-medium text-center">Agendamentos</span>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-all active:scale-95"
              onClick={() => navigate("/patients")}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center gap-2 min-h-[100px]">
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-indigo-600" />
                </div>
                <span className="text-sm font-medium text-center">Pacientes</span>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-all active:scale-95"
              onClick={() => navigate("/laboratory")}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center gap-2 min-h-[100px]">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-amber-600" />
                </div>
                <span className="text-sm font-medium text-center">Laboratório</span>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-md transition-all active:scale-95"
              onClick={() => navigate("/clinic")}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center gap-2 min-h-[100px]">
                <div className="w-12 h-12 rounded-full bg-teal-500/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-teal-600" />
                </div>
                <span className="text-sm font-medium text-center">Clínica</span>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Upload Rápido STL */}
        <Card className="mb-6 shadow-card hover:shadow-elevated transition-smooth">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <FileUp className="h-5 w-5 text-primary" />
              Upload Rápido - Arquivo STL
            </CardTitle>
            <CardDescription className="text-xs md:text-sm">
              Envie arquivos digitais STL diretamente para o laboratório
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 text-xs md:text-sm text-muted-foreground">
                Formatos aceitos: STL (máx. 20MB)
              </div>
              <label htmlFor="stl-upload" className="cursor-pointer">
                <Button 
                  type="button" 
                  variant="default" 
                  disabled={uploading}
                  size="lg"
                  className="w-full sm:w-auto"
                  asChild
                >
                  <span>
                    {uploading ? (
                      <>
                        <div className="h-5 w-5 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5 mr-2" />
                        Selecionar Arquivo
                      </>
                    )}
                  </span>
                </Button>
              </label>
              <input
                id="stl-upload"
                type="file"
                accept=".stl"
                onChange={handleSTLUpload}
                className="hidden"
                disabled={uploading}
              />
            </div>
          </CardContent>
        </Card>

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

        {/* Quick Actions and Lab Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate("/price-table")}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Tabela de Preços com IA
              </Button>
            </CardContent>
          </Card>

          <LaboratoryInfo />
        </div>

        {/* Notifications and Templates Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <NotificationSettings />
          <MessageTemplates />
        </div>

        {/* Activity Section */}
        <Card className="shadow-card mb-6">
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

      {/* Quick Search Dialog */}
      <QuickSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
};

export default Dashboard;
