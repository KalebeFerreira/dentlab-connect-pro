import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Save } from "lucide-react";

export function FiscalSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    cnpj: "",
    razao_social: "",
    inscricao_municipal: "",
    endereco_logradouro: "",
    endereco_numero: "",
    endereco_bairro: "",
    endereco_cidade: "",
    endereco_uf: "",
    endereco_cep: "",
    endereco_codigo_municipio: "",
  });

  useEffect(() => {
    if (user) loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('fiscal_settings')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (data) {
        setForm({
          cnpj: data.cnpj || "",
          razao_social: data.razao_social || "",
          inscricao_municipal: data.inscricao_municipal || "",
          endereco_logradouro: data.endereco_logradouro || "",
          endereco_numero: data.endereco_numero || "",
          endereco_bairro: data.endereco_bairro || "",
          endereco_cidade: data.endereco_cidade || "",
          endereco_uf: data.endereco_uf || "",
          endereco_cep: data.endereco_cep || "",
          endereco_codigo_municipio: data.endereco_codigo_municipio || "",
        });
      }
    } catch (err) {
      console.error("Erro ao carregar configurações fiscais:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.cnpj || !form.razao_social) {
      toast.error("CNPJ e Razão Social são obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('fiscal_settings')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('fiscal_settings')
          .update({ ...form })
          .eq('user_id', user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('fiscal_settings')
          .insert({ ...form, user_id: user!.id });
        if (error) throw error;
      }

      toast.success("Dados fiscais salvos com sucesso!");
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      toast.error("Erro ao salvar dados fiscais");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Dados Fiscais</CardTitle>
        <CardDescription>Configure seus dados para emissão de NFS-e</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>CNPJ *</Label>
            <Input placeholder="00.000.000/0000-00" value={form.cnpj} onChange={e => updateField('cnpj', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Razão Social *</Label>
            <Input placeholder="Sua empresa LTDA" value={form.razao_social} onChange={e => updateField('razao_social', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Inscrição Municipal</Label>
            <Input placeholder="Inscrição Municipal" value={form.inscricao_municipal} onChange={e => updateField('inscricao_municipal', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Código do Município (IBGE)</Label>
            <Input placeholder="Ex: 3550308" value={form.endereco_codigo_municipio} onChange={e => updateField('endereco_codigo_municipio', e.target.value)} />
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-medium mb-3">Endereço</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Logradouro</Label>
              <Input placeholder="Rua, Av..." value={form.endereco_logradouro} onChange={e => updateField('endereco_logradouro', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input placeholder="123" value={form.endereco_numero} onChange={e => updateField('endereco_numero', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input placeholder="Bairro" value={form.endereco_bairro} onChange={e => updateField('endereco_bairro', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input placeholder="Cidade" value={form.endereco_cidade} onChange={e => updateField('endereco_cidade', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>UF</Label>
                <Input placeholder="SP" maxLength={2} value={form.endereco_uf} onChange={e => updateField('endereco_uf', e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input placeholder="00000-000" value={form.endereco_cep} onChange={e => updateField('endereco_cep', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Dados Fiscais
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
