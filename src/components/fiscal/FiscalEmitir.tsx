import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText } from "lucide-react";

interface FiscalEmitirProps {
  onSuccess?: () => void;
  defaultValues?: {
    cliente_nome?: string;
    cliente_documento?: string;
    descricao_servico?: string;
    valor?: number;
    order_id?: string;
    service_id?: string;
  };
}

export function FiscalEmitir({ onSuccess, defaultValues }: FiscalEmitirProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    cliente_nome: defaultValues?.cliente_nome || "",
    cliente_documento: defaultValues?.cliente_documento || "",
    descricao_servico: defaultValues?.descricao_servico || "",
    valor: defaultValues?.valor?.toString() || "",
  });

  const handleEmitir = async () => {
    if (!form.cliente_nome || !form.cliente_documento || !form.descricao_servico || !form.valor) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const valor = parseFloat(form.valor);
    if (isNaN(valor) || valor <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('emit-invoice', {
        body: {
          cliente_nome: form.cliente_nome,
          cliente_documento: form.cliente_documento,
          descricao_servico: form.descricao_servico,
          valor: form.valor,
          order_id: defaultValues?.order_id || null,
          service_id: defaultValues?.service_id || null,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error, { description: data.details || '' });
        return;
      }

      toast.success("Nota fiscal emitida com sucesso!", {
        description: data?.numero_nota ? `Nº ${data.numero_nota}` : 'Processando...',
      });

      setForm({ cliente_nome: "", cliente_documento: "", descricao_servico: "", valor: "" });
      onSuccess?.();
    } catch (err: any) {
      console.error("Erro ao emitir nota:", err);
      toast.error("Erro ao emitir nota fiscal. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Emitir NFS-e
        </CardTitle>
        <CardDescription>Preencha os dados do cliente e serviço</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome do Cliente *</Label>
            <Input placeholder="Nome completo ou razão social" value={form.cliente_nome} onChange={e => updateField('cliente_nome', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>CPF/CNPJ do Cliente *</Label>
            <Input placeholder="000.000.000-00" value={form.cliente_documento} onChange={e => updateField('cliente_documento', e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Descrição do Serviço *</Label>
          <Textarea placeholder="Ex: Prótese dentária fixa em porcelana" value={form.descricao_servico} onChange={e => updateField('descricao_servico', e.target.value)} rows={3} />
        </div>

        <div className="space-y-2 max-w-xs">
          <Label>Valor (R$) *</Label>
          <Input type="number" step="0.01" min="0.01" placeholder="0,00" value={form.valor} onChange={e => updateField('valor', e.target.value)} />
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleEmitir} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
            Emitir Nota Fiscal
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
