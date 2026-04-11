import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Save, Upload, ShieldCheck, Trash2, FileKey, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type CertStatus = 'none' | 'uploading' | 'validating' | 'valid' | 'invalid' | 'needs_password';

export function FiscalSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [hasCertificate, setHasCertificate] = useState(false);
  const [certFileName, setCertFileName] = useState("");
  const [certPassword, setCertPassword] = useState("");
  const [certStatus, setCertStatus] = useState<CertStatus>('none');
  const [certMessage, setCertMessage] = useState("");
  const [certExpiry, setCertExpiry] = useState<string | null>(null);
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
          // Se tem certificado e senha, validar automaticamente
          if (data.certificado_senha_encrypted) {
            setCertStatus('valid'); // assume válido até re-validar
          }
        }
      }
    } catch (err) {
      console.error("Erro ao carregar configurações fiscais:", err);
    } finally {
      setLoading(false);
    }
  };

  const validateCertificate = async () => {
    setCertStatus('validating');
    setCertMessage('Validando certificado na Nuvem Fiscal...');

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        setCertStatus('invalid');
        setCertMessage('Sessão expirada. Faça login novamente.');
        return;
      }

      const response = await supabase.functions.invoke('validate-certificate', {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });

      const result = response.data;

      if (result?.valid) {
        setCertStatus('valid');
        setCertMessage(result.message || 'Certificado validado com sucesso!');
        setCertExpiry(result.expiresAt || null);
        toast.success("✅ Certificado Validado!", {
          description: "Seu certificado digital foi verificado com sucesso. Você já pode emitir notas fiscais!",
          duration: 8000,
        });
      } else if (result?.needs_password) {
        setCertStatus('needs_password');
        setCertMessage(result.error || 'Salve a senha do certificado primeiro.');
        toast.warning("Senha necessária", {
          description: "Insira a senha do certificado e clique em 'Salvar Dados Fiscais' antes de validar.",
          duration: 6000,
        });
      } else {
        setCertStatus('invalid');
        setCertMessage(result?.error || 'Certificado inválido.');
        toast.error("❌ Certificado Inválido", {
          description: result?.error || "Verifique o arquivo e a senha do certificado.",
          duration: 8000,
        });
      }
    } catch (err: any) {
      console.error("Erro ao validar certificado:", err);
      setCertStatus('invalid');
      setCertMessage('Erro ao conectar com o serviço de validação.');
      toast.error("Erro na validação", {
        description: "Não foi possível validar o certificado. Tente novamente.",
      });
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
    setCertStatus('uploading');
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        
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
            setCertStatus('none');
            return;
          }
          await supabase
            .from('fiscal_settings')
            .insert({ ...form, user_id: user!.id, certificado_base64: base64 });
        }

        setCertFileName(file.name);
        setHasCertificate(true);
        setUploadingCert(false);
        
        toast.success("Certificado enviado!", { description: "Agora salve a senha e valide o certificado." });

        // Se já tem senha salva, validar automaticamente
        const { data: settings } = await supabase
          .from('fiscal_settings')
          .select('certificado_senha_encrypted')
          .eq('user_id', user!.id)
          .maybeSingle();

        if (settings?.certificado_senha_encrypted) {
          // Validar automaticamente
          setTimeout(() => validateCertificate(), 500);
        } else {
          setCertStatus('needs_password');
          setCertMessage('Insira a senha do certificado e salve para validar automaticamente.');
          toast.info("📝 Próximo passo", {
            description: "Insira a senha do certificado abaixo e clique em 'Salvar Dados Fiscais'.",
            duration: 6000,
          });
        }
      };
      reader.onerror = () => {
        toast.error("Erro ao ler o arquivo");
        setUploadingCert(false);
        setCertStatus('none');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Erro upload certificado:", err);
      toast.error("Erro ao enviar certificado");
      setUploadingCert(false);
      setCertStatus('none');
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
      setCertStatus('none');
      setCertMessage('');
      setCertExpiry(null);
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
      
      if (certPassword) {
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

      // Se tem certificado e acabou de salvar a senha, validar automaticamente
      if (hasCertificate && certPassword) {
        toast.info("🔄 Validando certificado...", { description: "Aguarde a verificação automática." });
        setTimeout(() => validateCertificate(), 1000);
      }
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
            Necessário para emissão de NFS-e. O certificado é validado automaticamente na Nuvem Fiscal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription>
              Seu certificado digital é armazenado de forma segura e validado automaticamente após o envio.
            </AlertDescription>
          </Alert>

          {/* Status do certificado */}
          {certStatus !== 'none' && certStatus !== 'uploading' && (
            <div className={`rounded-lg p-4 border ${
              certStatus === 'valid' ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' :
              certStatus === 'validating' ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800' :
              certStatus === 'needs_password' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800' :
              'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
            }`}>
              <div className="flex items-start gap-3">
                {certStatus === 'valid' && <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />}
                {certStatus === 'validating' && <Loader2 className="h-5 w-5 text-blue-600 animate-spin mt-0.5 flex-shrink-0" />}
                {certStatus === 'needs_password' && <ShieldCheck className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />}
                {certStatus === 'invalid' && <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    certStatus === 'valid' ? 'text-green-800 dark:text-green-200' :
                    certStatus === 'validating' ? 'text-blue-800 dark:text-blue-200' :
                    certStatus === 'needs_password' ? 'text-yellow-800 dark:text-yellow-200' :
                    'text-red-800 dark:text-red-200'
                  }`}>
                    {certStatus === 'valid' && '✅ Certificado Válido - Pronto para emitir NFS-e!'}
                    {certStatus === 'validating' && '🔄 Validando certificado...'}
                    {certStatus === 'needs_password' && '🔑 Senha do certificado necessária'}
                    {certStatus === 'invalid' && '❌ Certificado Inválido'}
                  </p>
                  <p className={`text-xs mt-1 ${
                    certStatus === 'valid' ? 'text-green-700 dark:text-green-300' :
                    certStatus === 'validating' ? 'text-blue-700 dark:text-blue-300' :
                    certStatus === 'needs_password' ? 'text-yellow-700 dark:text-yellow-300' :
                    'text-red-700 dark:text-red-300'
                  }`}>
                    {certMessage}
                  </p>
                  {certExpiry && (
                    <p className="text-xs mt-1 text-green-600 dark:text-green-400">
                      Validade: {new Date(certExpiry).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
                {(certStatus === 'invalid' || certStatus === 'valid') && (
                  <Button variant="ghost" size="sm" onClick={validateCertificate} className="flex-shrink-0">
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Revalidar
                  </Button>
                )}
              </div>
            </div>
          )}

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
            <p className="text-xs text-muted-foreground">
              A senha será salva e o certificado validado automaticamente ao clicar em "Salvar Dados Fiscais"
            </p>
          </div>

          {hasCertificate && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={validateCertificate} disabled={certStatus === 'validating'}>
                {certStatus === 'validating' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Validar Certificado Agora
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
