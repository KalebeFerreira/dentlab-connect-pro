import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useInvoiceLimits } from "@/hooks/useInvoiceLimits";
import { Loader2, FileText, AlertTriangle, CheckCircle2, Receipt } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Service } from "@/pages/Billing";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BillingFiscalIntegrationProps {
  services: Service[];
  onSuccess?: () => void;
}

export function BillingFiscalIntegration({ services, onSuccess }: BillingFiscalIntegrationProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [results, setResults] = useState<{ id: string; name: string; success: boolean; error?: string }[]>([]);
  const [showResults, setShowResults] = useState(false);
  const { usage, limit, remaining, canEmit, isUnlimited, refreshUsage } = useInvoiceLimits();

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const servicesWithoutInvoice = services.filter(s => s.status === "active");

  const toggleService = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === servicesWithoutInvoice.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(servicesWithoutInvoice.map(s => s.id));
    }
  };

  const selectedServices = servicesWithoutInvoice.filter(s => selectedIds.includes(s.id));
  const totalValue = selectedServices.reduce((sum, s) => sum + Number(s.service_value), 0);

  const handleEmitBatch = async () => {
    if (selectedServices.length === 0) {
      toast.error("Selecione ao menos um serviço");
      return;
    }

    if (!canEmit) {
      toast.error("Limite de notas fiscais atingido neste mês");
      return;
    }

    const maxToEmit = isUnlimited ? selectedServices.length : Math.min(selectedServices.length, remaining);
    if (maxToEmit < selectedServices.length) {
      toast.warning(`Você só pode emitir mais ${remaining} nota(s) este mês. Apenas ${maxToEmit} serão processados.`);
    }

    setConfirmOpen(false);
    setLoading(true);
    const batchResults: typeof results = [];

    const toProcess = selectedServices.slice(0, maxToEmit);

    for (const service of toProcess) {
      try {
        const { data, error } = await supabase.functions.invoke('emit-invoice', {
          body: {
            cliente_nome: service.client_name || "Cliente não informado",
            cliente_documento: "00000000000",
            descricao_servico: `${service.service_name}${service.patient_name ? ` - Paciente: ${service.patient_name}` : ""}${service.work_type ? ` - Tipo: ${service.work_type}` : ""}`,
            valor: service.service_value.toString(),
            service_id: service.id,
          },
        });

        if (error) throw error;

        if (data?.error) {
          batchResults.push({ id: service.id, name: service.service_name, success: false, error: data.error });
        } else {
          batchResults.push({ id: service.id, name: service.service_name, success: true });
        }
      } catch (err: any) {
        batchResults.push({ id: service.id, name: service.service_name, success: false, error: err.message || "Erro desconhecido" });
      }
    }

    setResults(batchResults);
    setShowResults(true);
    setLoading(false);
    setSelectedIds([]);
    refreshUsage();

    const successCount = batchResults.filter(r => r.success).length;
    const failCount = batchResults.filter(r => !r.success).length;

    if (failCount === 0) {
      toast.success(`${successCount} nota(s) fiscal(is) emitida(s) com sucesso!`);
    } else {
      toast.warning(`${successCount} emitida(s), ${failCount} com erro.`);
    }

    onSuccess?.();
  };

  const handleEmitSingle = async (service: Service) => {
    if (!canEmit) {
      toast.error("Limite de notas fiscais atingido neste mês");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('emit-invoice', {
        body: {
          cliente_nome: service.client_name || "Cliente não informado",
          cliente_documento: "00000000000",
          descricao_servico: `${service.service_name}${service.patient_name ? ` - Paciente: ${service.patient_name}` : ""}`,
          valor: service.service_value.toString(),
          service_id: service.id,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`Nota fiscal emitida: ${service.service_name}`, {
          description: data?.numero_nota ? `Nº ${data.numero_nota}` : "Processando...",
        });
      }

      refreshUsage();
      onSuccess?.();
    } catch (err: any) {
      toast.error("Erro ao emitir nota fiscal");
    } finally {
      setLoading(false);
    }
  };

  if (servicesWithoutInvoice.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Nenhum serviço ativo para emissão de nota fiscal.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Emissão de NFS-e via Faturamento
              </CardTitle>
              <CardDescription>
                {isUnlimited
                  ? "Notas ilimitadas no seu plano"
                  : `${usage}/${limit} notas emitidas este mês — ${remaining} restante(s)`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={toggleAll} disabled={loading}>
                {selectedIds.length === servicesWithoutInvoice.length ? "Desmarcar todos" : "Selecionar todos"}
              </Button>
              <Button
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={loading || selectedIds.length === 0 || !canEmit}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                Emitir {selectedIds.length > 0 ? `(${selectedIds.length})` : ""} Nota(s)
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {!canEmit && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Limite de {limit} notas fiscais atingido este mês. Faça upgrade para emitir mais.
              </AlertDescription>
            </Alert>
          )}

          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {servicesWithoutInvoice.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.includes(service.id)}
                    onCheckedChange={() => toggleService(service.id)}
                    disabled={loading}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{service.service_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {service.client_name || "Sem cliente"} {service.patient_name ? `• ${service.patient_name}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {formatCurrency(Number(service.service_value))}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEmitSingle(service)}
                    disabled={loading || !canEmit}
                    title="Emitir nota individual"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between pt-3 border-t">
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} serviço(s) selecionado(s)
              </span>
              <span className="font-bold">{formatCurrency(totalValue)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar emissão em lote</DialogTitle>
            <DialogDescription>
              Você está prestes a emitir {selectedIds.length} nota(s) fiscal(is) totalizando {formatCurrency(totalValue)}.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Esta ação não pode ser desfeita. As notas serão enviadas para a API fiscal.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={handleEmitBatch}>
              <FileText className="h-4 w-4 mr-2" />
              Confirmar emissão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Results Dialog */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resultado da emissão</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {results.map((r) => (
                <div key={r.id} className="flex items-center gap-2 p-2 rounded border">
                  {r.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    {r.error && <p className="text-xs text-red-500">{r.error}</p>}
                  </div>
                  <Badge variant={r.success ? "default" : "destructive"} className="text-xs">
                    {r.success ? "Emitida" : "Erro"}
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
