import { useState, useEffect, lazy, Suspense, memo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

// Lazy load heavy components
const CompanyInfoForm = lazy(() => import("@/components/billing/CompanyInfoForm").then(m => ({ default: m.CompanyInfoForm })));
const ServiceForm = lazy(() => import("@/components/billing/ServiceForm").then(m => ({ default: m.ServiceForm })));
const ServicesList = lazy(() => import("@/components/billing/ServicesList").then(m => ({ default: m.ServicesList })));
const BillingStats = lazy(() => import("@/components/billing/BillingStats").then(m => ({ default: m.BillingStats })));
const MonthlyReports = lazy(() => import("@/components/billing/MonthlyReports").then(m => ({ default: m.MonthlyReports })));
const ClientReports = lazy(() => import("@/components/billing/ClientReports").then(m => ({ default: m.ClientReports })));
const AutomaticReportSettings = lazy(() => import("@/components/billing/AutomaticReportSettings").then(m => ({ default: m.AutomaticReportSettings })));
const DocumentScanner = lazy(() => import("@/components/billing/DocumentScanner").then(m => ({ default: m.DocumentScanner })));
const ScanHistory = lazy(() => import("@/components/billing/ScanHistory").then(m => ({ default: m.ScanHistory })));

const ComponentLoader = memo(() => (
  <div className="flex items-center justify-center py-8">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
));

export interface CompanyInfo {
  id?: string;
  company_name: string;
  cpf_cnpj: string;
  email: string;
  phone: string;
  logo_url?: string;
}

export interface Service {
  id: string;
  service_name: string;
  service_value: number;
  client_name?: string;
  patient_name?: string;
  color?: string;
  work_type?: string;
  service_date: string;
  status: string;
  created_at: string;
}

const Billing = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [scanRefreshTrigger, setScanRefreshTrigger] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    // Setup realtime subscription for services
    const channel = supabase
      .channel('services-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'services'
        },
        () => {
          loadServices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    await loadData();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadCompanyInfo(), loadServices()]);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanyInfo = async () => {
    const { data, error } = await supabase
      .from("company_info")
      .select("*")
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Erro ao carregar informações da empresa:", error);
      return;
    }

    if (data) {
      setCompanyInfo(data);
    }
  };

  const loadServices = async () => {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("status", "active")
      .order("service_date", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar serviços");
      console.error(error);
      return;
    }

    setServices(data || []);
  };

  const handleCompanyInfoSave = async (info: CompanyInfo) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      ...info,
      user_id: user.id,
    };

    const { error } = companyInfo?.id
      ? await supabase
          .from("company_info")
          .update(payload)
          .eq("id", companyInfo.id)
      : await supabase.from("company_info").insert([payload]);

    if (error) {
      toast.error("Erro ao salvar informações da empresa");
      console.error(error);
      return;
    }

    toast.success("Informações salvas com sucesso!");
    await loadCompanyInfo();
  };

  const handleServiceAdd = async () => {
    await loadServices();
  };

  const handleServiceDelete = async (id: string) => {
    const { error } = await supabase
      .from("services")
      .update({ status: "deleted" })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir serviço");
      console.error(error);
      return;
    }

    toast.success("Serviço excluído com sucesso!");
    await loadServices();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Faturamento</h1>
      </div>

      <Suspense fallback={<ComponentLoader />}>
        <CompanyInfoForm
          companyInfo={companyInfo}
          onSave={handleCompanyInfoSave}
        />
      </Suspense>

      <Suspense fallback={<ComponentLoader />}>
        <BillingStats services={services} />
      </Suspense>

      <Tabs defaultValue="services" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1 p-1">
          <TabsTrigger value="services" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
            Serviços
          </TabsTrigger>
          <TabsTrigger value="monthly" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
            Rel. Mensais
          </TabsTrigger>
          <TabsTrigger value="clients" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
            Rel. Clientes
          </TabsTrigger>
          <TabsTrigger value="automatic" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
            Envio Auto
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-6">
          <Suspense fallback={<ComponentLoader />}>
            <div className="grid gap-6 lg:grid-cols-2">
              <DocumentScanner 
                onServiceAdd={handleServiceAdd} 
                onScanComplete={() => setScanRefreshTrigger(prev => prev + 1)}
              />
              <ScanHistory refreshTrigger={scanRefreshTrigger} />
            </div>
          </Suspense>
          <Suspense fallback={<ComponentLoader />}>
            <ServiceForm onServiceAdd={handleServiceAdd} />
          </Suspense>
          <Suspense fallback={<ComponentLoader />}>
            <ServicesList
              services={services}
              onDelete={handleServiceDelete}
              companyInfo={companyInfo}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="monthly">
          <Suspense fallback={<ComponentLoader />}>
            <MonthlyReports services={services} companyInfo={companyInfo} />
          </Suspense>
        </TabsContent>

        <TabsContent value="clients">
          <Suspense fallback={<ComponentLoader />}>
            <ClientReports services={services} companyInfo={companyInfo} />
          </Suspense>
        </TabsContent>

        <TabsContent value="automatic">
          <Suspense fallback={<ComponentLoader />}>
            <AutomaticReportSettings services={services} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Billing;
