import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Building2, Phone, Mail, Save } from "lucide-react";

interface LaboratoryData {
  id?: string;
  lab_name: string;
  whatsapp: string;
  email: string;
}

const Laboratory = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [labData, setLabData] = useState<LaboratoryData>({
    lab_name: "",
    whatsapp: "",
    email: "",
  });

  useEffect(() => {
    checkAuth();
    loadLaboratoryInfo();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    }
  };

  const loadLaboratoryInfo = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("laboratory_info")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setLabData({
          id: data.id,
          lab_name: data.lab_name,
          whatsapp: data.whatsapp,
          email: data.email,
        });
      }
    } catch (error: any) {
      toast.error("Erro ao carregar informações", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!labData.lab_name || !labData.whatsapp || !labData.email) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (labData.id) {
        // Atualizar
        const { error } = await supabase
          .from("laboratory_info")
          .update({
            lab_name: labData.lab_name,
            whatsapp: labData.whatsapp,
            email: labData.email,
          })
          .eq("id", labData.id);

        if (error) throw error;
        toast.success("Informações atualizadas com sucesso!");
      } else {
        // Criar novo
        const { data, error } = await supabase
          .from("laboratory_info")
          .insert({
            user_id: user.id,
            lab_name: labData.lab_name,
            whatsapp: labData.whatsapp,
            email: labData.email,
          })
          .select()
          .single();

        if (error) throw error;
        setLabData({ ...labData, id: data.id });
        toast.success("Informações cadastradas com sucesso!");
      }
    } catch (error: any) {
      toast.error("Erro ao salvar", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

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
        <h1 className="text-3xl font-bold mb-2">Informações do Laboratório</h1>
        <p className="text-muted-foreground">
          Gerencie os dados do seu laboratório
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* Card Principal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Dados do Laboratório
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="lab_name">
                  Nome do Laboratório *
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="lab_name"
                    value={labData.lab_name}
                    onChange={(e) => setLabData({ ...labData, lab_name: e.target.value })}
                    placeholder="Ex: DentLab Próteses"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">
                  WhatsApp (com DDD) *
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="whatsapp"
                    value={labData.whatsapp}
                    onChange={(e) => setLabData({ ...labData, whatsapp: e.target.value })}
                    placeholder="(11) 99999-9999"
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Usado para comunicação via WhatsApp com clientes
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  E-mail *
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={labData.email}
                    onChange={(e) => setLabData({ ...labData, email: e.target.value })}
                    placeholder="contato@dentlab.com.br"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Informações
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Card de Resumo */}
        {labData.lab_name && (
          <Card>
            <CardHeader>
              <CardTitle>Resumo das Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <Building2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Laboratório</p>
                  <p className="text-sm text-muted-foreground">{labData.lab_name}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <Phone className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">WhatsApp</p>
                  <p className="text-sm text-muted-foreground">{labData.whatsapp}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <Mail className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">E-mail</p>
                  <p className="text-sm text-muted-foreground">{labData.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Laboratory;
