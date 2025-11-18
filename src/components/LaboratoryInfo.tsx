import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, Save, Loader2 } from "lucide-react";

interface LabInfo {
  id?: string;
  lab_name: string;
  whatsapp: string;
  email: string;
}

export const LaboratoryInfo = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [labInfo, setLabInfo] = useState<LabInfo>({
    lab_name: "",
    whatsapp: "",
    email: "",
  });

  useEffect(() => {
    loadLabInfo();
  }, []);

  const loadLabInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("laboratory_info")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setLabInfo({
          id: data.id,
          lab_name: data.lab_name,
          whatsapp: data.whatsapp,
          email: data.email,
        });
      }
    } catch (error: any) {
      console.error("Error loading lab info:", error);
      toast.error("Erro ao carregar informações do laboratório");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!labInfo.lab_name || !labInfo.whatsapp || !labInfo.email) {
      toast.error("Preencha todos os campos");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (labInfo.id) {
        const { error } = await supabase
          .from("laboratory_info")
          .update({
            lab_name: labInfo.lab_name,
            whatsapp: labInfo.whatsapp,
            email: labInfo.email,
          })
          .eq("id", labInfo.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("laboratory_info")
          .insert({
            user_id: user.id,
            lab_name: labInfo.lab_name,
            whatsapp: labInfo.whatsapp,
            email: labInfo.email,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setLabInfo({ ...labInfo, id: data.id });
        }
      }

      toast.success("Informações salvas com sucesso!");
    } catch (error: any) {
      console.error("Error saving lab info:", error);
      toast.error("Erro ao salvar informações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle>Informações do Laboratório</CardTitle>
        </div>
        <CardDescription>
          Configure as informações do seu laboratório
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="lab_name">Nome do Laboratório</Label>
          <Input
            id="lab_name"
            placeholder="Ex: Laboratório Dental Plus"
            value={labInfo.lab_name}
            onChange={(e) => setLabInfo({ ...labInfo, lab_name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            placeholder="Ex: (11) 98765-4321"
            value={labInfo.whatsapp}
            onChange={(e) => setLabInfo({ ...labInfo, whatsapp: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="Ex: contato@laboratorio.com"
            value={labInfo.email}
            onChange={(e) => setLabInfo({ ...labInfo, email: e.target.value })}
          />
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="w-full"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Informações
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
