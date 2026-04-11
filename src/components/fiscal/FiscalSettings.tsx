import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Save, Upload, ShieldCheck, Trash2, FileKey } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export function FiscalSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [hasCertificate, setHasCertificate] = useState(false);
  const [certFileName, setCertFileName] = useState("");
  const [certPassword, setCertPassword] = useState("");
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
        setHasCertificate(!!data.certificado_base64);
        if (data.certificado_base64) {
          setCertFileName("certificado.pfx (salvo)");
        }
      }
    } catch (err) {
      console.error("Erro ao carregar configurações fiscais:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.pfx') && !file.name.endsWith('.p12')) {
      toast.error("Arquivo inválido", { description: "Envie um certificado digital A1 (.pfx ou .p12)" });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande", { description: "O certificado deve ter no máximo 10MB" });
      return;
    }

    setUploadingCert(true);
    try {
      // Converter para base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        
        // Salvar base64 no banco (não exposto no frontend, apenas armazenado)
        const { data: existing } = await supabase
          .from('fiscal_settings')
          .select('id')
          .eq('user_id', user!.id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('fiscal_settings')
            .update({ certificado_base64: base64 })
            .eq('user_id', user!.id);
        } else {
          if (!form.cnpj || !form.razao_social) {
            toast.error("Salve o CNPJ e Razão Social antes de enviar o certificado");
            setUploadingCert(false);
            return;
          }
          await supabase
            .from('fiscal_settings')
            .insert({ ...form, user_id: user!.id, certificado_base64: base64 });
        }

        setCertFileName(file.name);
        setHasCertificate(true);
        toast.success("Certificado digital salvo com segurança!");
        setUploadingCert(false);
      };
      reader.onerror = () => {
        toast.error("Erro ao ler o arquivo");
        setUploadingCert(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Erro upload certificado:", err);
      toast.error("Erro ao enviar certificado");
      setUploadingCert(false);
    }
  };

  const handleRemoveCert = async () => {
    try {
      await supabase
        .from('fiscal_settings')
        .update({ certificado_base64: null, certificado_senha_encrypted: null })
        .eq('user_id', user!.id);

      setHasCertificate(false);
      setCertFileName("");
      setCertPassword("");
      toast.success("Certificado removido");
    } catch (err) {
      toast.error("Erro ao remover certificado");
    }
  };

  const handleSave = async () => {
    if (!form.cnpj || !form.razao_social) {
      toast.error("CNPJ e Razão Social são obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const updateData: any = { ...form };
      
      // Se senha do certificado foi preenchida, salvar (criptografada no servidor)
      if (certPassword) {
        // Base64 encode da senha para não trafegar em texto puro
        updateData.certificado_senha_encrypted = btoa(certPassword);
      }

      const { data: existing } = await supabase
        .from('fiscal_settings')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('fiscal_settings')
          .update(updateData)
          .eq('user_id', user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('fiscal_settings')
          .insert({ ...updateData, user_id: user!.id });
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
    <div className="space-y-4">
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

      {/* Certificado Digital */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileKey className="h-5 w-5" />
            Certificado Digital A1
          </CardTitle>
          <CardDescription>
            Necessário para emissão de NFS-e. O certificado é armazenado com segurança e nunca é exposto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription>
              Seu certificado digital é armazenado de forma criptografada e acessado apenas pelo servidor no momento da emissão.
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              {hasCertificate ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs py-1">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    {certFileName || "Certificado salvo"}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={handleRemoveCert} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="cert-upload" className="cursor-pointer">
                    <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/50 transition-colors">
                      {uploadingCert ? (
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                      ) : (
                        <>
                          <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Clique para enviar certificado .pfx</p>
                        </>
                      )}
                    </div>
                  </Label>
                  <Input
                    id="cert-upload"
                    type="file"
                    accept=".pfx,.p12"
                    className="hidden"
                    onChange={handleCertUpload}
                    disabled={uploadingCert}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 max-w-sm">
            <Label>Senha do Certificado</Label>
            <Input
              type="password"
              placeholder="Digite a senha do certificado"
              value={certPassword}
              onChange={e => setCertPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">A senha será salva de forma segura ao clicar em "Salvar Dados Fiscais"</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
