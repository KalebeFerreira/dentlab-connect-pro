import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OrdersSummary } from "@/components/clinic/OrdersSummary";
import { OrdersTracking } from "@/components/clinic/OrdersTracking";
import { DentistManagement } from "@/components/clinic/DentistManagement";
import { CertificateGenerator } from "@/components/clinic/CertificateGenerator";
import { CertificateTemplateManager } from "@/components/clinic/CertificateTemplateManager";
import { MessageTemplates } from "@/components/MessageTemplates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard da Clínica</h1>
        <p className="text-muted-foreground">
          Gerencie pedidos, dentistas e templates de mensagens
        </p>
      </div>

      <OrdersSummary />

      <div className="grid gap-6 lg:grid-cols-2">
        <OrdersTracking />
        <DentistManagement />
      </div>

      <Tabs defaultValue="generator" className="space-y-4">
        <TabsList>
          <TabsTrigger value="generator">Gerar Atestado</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="generator" className="space-y-4">
          <CertificateGenerator />
        </TabsContent>
        <TabsContent value="templates" className="space-y-4">
          <CertificateTemplateManager />
        </TabsContent>
      </Tabs>

      <MessageTemplates />
    </div>
  );
};

export default ClinicDashboard;