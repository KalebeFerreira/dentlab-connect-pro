import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyInfoForm } from "@/components/billing/CompanyInfoForm";
import { ServiceForm } from "@/components/billing/ServiceForm";
import { ServicesList } from "@/components/billing/ServicesList";
import { BillingStats } from "@/components/billing/BillingStats";
import { MonthlyReports } from "@/components/billing/MonthlyReports";
import { ClientReports } from "@/components/billing/ClientReports";
import { Loader2 } from "lucide-react";

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
  service_date: string;
  status: string;
  created_at: string;
}

const Billing = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [services, setServices] = useState<Service[]>([]);

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

      <CompanyInfoForm
        companyInfo={companyInfo}
        onSave={handleCompanyInfoSave}
      />

      <BillingStats services={services} />

      <Tabs defaultValue="services" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="monthly">Relatórios Mensais</TabsTrigger>
          <TabsTrigger value="clients">Relatórios de Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-6">
          <ServiceForm onServiceAdd={handleServiceAdd} />
          <ServicesList
            services={services}
            onDelete={handleServiceDelete}
            companyInfo={companyInfo}
          />
        </TabsContent>

        <TabsContent value="monthly">
          <MonthlyReports services={services} companyInfo={companyInfo} />
        </TabsContent>

        <TabsContent value="clients">
          <ClientReports services={services} companyInfo={companyInfo} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Billing;
