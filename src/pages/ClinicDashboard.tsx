import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrdersSummary } from "@/components/clinic/OrdersSummary";
import { OrdersTracking } from "@/components/clinic/OrdersTracking";
import { DentistManagement } from "@/components/clinic/DentistManagement";
import { CertificateGenerator } from "@/components/clinic/CertificateGenerator";
import { CertificateTemplateManager } from "@/components/clinic/CertificateTemplateManager";
import { MessageTemplates } from "@/components/MessageTemplates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  FileText, 
  Users, 
  Calendar, 
  DollarSign, 
  Building2, 
  Table2, 
  Image as ImageIcon,
  FileSpreadsheet,
  Receipt,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Package,
  Stethoscope
} from "lucide-react";

interface QuickAction {
  title: string;
  description: string;
  icon: any;
  path: string;
  color: string;
  bgColor: string;
}

const ClinicDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setLoading(false);
  };

  const quickActions: QuickAction[] = [
    {
      title: "Novo Pedido",
      description: "Criar ordem de trabalho",
      icon: Plus,
      path: "/orders/new",
      color: "text-blue-600",
      bgColor: "bg-blue-500/10 hover:bg-blue-500/20"
    },
    {
      title: "Ver Pedidos",
      description: "Gerenciar ordens",
      icon: Package,
      path: "/orders",
      color: "text-purple-600",
      bgColor: "bg-purple-500/10 hover:bg-purple-500/20"
    },
    {
      title: "Pacientes",
      description: "Cadastro e histórico",
      icon: Users,
      path: "/patients",
      color: "text-green-600",
      bgColor: "bg-green-500/10 hover:bg-green-500/20"
    },
    {
      title: "Agendamentos",
      description: "Consultas marcadas",
      icon: Calendar,
      path: "/appointments",
      color: "text-orange-600",
      bgColor: "bg-orange-500/10 hover:bg-orange-500/20"
    },
    {
      title: "Financeiro",
      description: "Controle de caixa",
      icon: DollarSign,
      path: "/financial",
      color: "text-emerald-600",
      bgColor: "bg-emerald-500/10 hover:bg-emerald-500/20"
    },
    {
      title: "Faturamento",
      description: "Notas e recibos",
      icon: Receipt,
      path: "/billing",
      color: "text-cyan-600",
      bgColor: "bg-cyan-500/10 hover:bg-cyan-500/20"
    },
    {
      title: "Laboratório",
      description: "Parceiros e arquivos",
      icon: Building2,
      path: "/laboratory",
      color: "text-amber-600",
      bgColor: "bg-amber-500/10 hover:bg-amber-500/20"
    },
    {
      title: "Tabela de Preços",
      description: "Valores dos serviços",
      icon: Table2,
      path: "/price-table",
      color: "text-pink-600",
      bgColor: "bg-pink-500/10 hover:bg-pink-500/20"
    },
    {
      title: "Gerar Imagens",
      description: "IA para imagens dentais",
      icon: Sparkles,
      path: "/image-generator",
      color: "text-violet-600",
      bgColor: "bg-violet-500/10 hover:bg-violet-500/20"
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard da Clínica</h1>
          <p className="text-muted-foreground">
            Central de comandos para gerenciar sua clínica odontológica
          </p>
        </div>
        <Button onClick={() => navigate("/orders/new")} size="lg" className="w-full md:w-auto">
          <Plus className="h-5 w-5 mr-2" />
          Novo Pedido
        </Button>
      </div>

      {/* Quick Actions Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Ações Rápidas</h2>
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {quickActions.map((action) => (
            <Card
              key={action.path}
              className={`cursor-pointer transition-all hover:shadow-lg active:scale-95 ${action.bgColor}`}
              onClick={() => navigate(action.path)}
            >
              <CardContent className="p-4 flex flex-col items-center justify-center gap-3 min-h-[140px]">
                <div className={`w-12 h-12 rounded-full ${action.bgColor} flex items-center justify-center`}>
                  <action.icon className={`h-6 w-6 ${action.color}`} />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm mb-1">{action.title}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Statistics Overview */}
      <OrdersSummary />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <OrdersTracking />
        <DentistManagement />
      </div>

      {/* Certificates Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Atestados e Certificados
          </CardTitle>
          <CardDescription>
            Gere atestados médicos e gerencie templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="generator" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="generator">Gerar Atestado</TabsTrigger>
              <TabsTrigger value="templates">Gerenciar Templates</TabsTrigger>
            </TabsList>
            <TabsContent value="generator" className="space-y-4">
              <CertificateGenerator />
            </TabsContent>
            <TabsContent value="templates" className="space-y-4">
              <CertificateTemplateManager />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Message Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Templates de Mensagens
          </CardTitle>
          <CardDescription>
            Mensagens automatizadas para WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MessageTemplates />
        </CardContent>
      </Card>
    </div>
  );
};

export default ClinicDashboard;