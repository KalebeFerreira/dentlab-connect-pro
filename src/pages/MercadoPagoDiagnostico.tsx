import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Play, RefreshCw, CheckCircle2, XCircle, Clock, Copy, Webhook, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WebhookLog {
  id: string;
  payment_id: string | null;
  event_type: string | null;
  event_action: string | null;
  payment_status: string | null;
  signature_valid: boolean | null;
  http_status: number | null;
  raw_body: any;
  payment_data: any;
  error_message: string | null;
  processing_time_ms: number | null;
  created_at: string;
}

interface SimulatedPayment {
  payment_id: number;
  qr_code: string;
  qr_code_base64: string;
  amount: number;
  expires_at: string;
}

const statusBadge = (status: number | null) => {
  if (status === null) return <Badge variant="outline">—</Badge>;
  if (status >= 200 && status < 300) return <Badge className="bg-green-500/15 text-green-600 border-green-500/30">{status}</Badge>;
  if (status >= 400 && status < 500) return <Badge className="bg-yellow-500/15 text-yellow-600 border-yellow-500/30">{status}</Badge>;
  return <Badge className="bg-red-500/15 text-red-600 border-red-500/30">{status}</Badge>;
};

const paymentStatusBadge = (status: string | null) => {
  if (!status) return null;
  const map: Record<string, string> = {
    approved: "bg-green-500/15 text-green-600 border-green-500/30",
    pending: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
    rejected: "bg-red-500/15 text-red-600 border-red-500/30",
    cancelled: "bg-gray-500/15 text-gray-600 border-gray-500/30",
    in_process: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  };
  return <Badge className={map[status] ?? "bg-muted"}>{status}</Badge>;
};

export default function MercadoPagoDiagnostico() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [simulated, setSimulated] = useState<SimulatedPayment | null>(null);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);

  const loadLogs = async () => {
    const { data, error } = await supabase
      .from("mercadopago_webhook_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast({ title: "Erro ao carregar logs", description: error.message, variant: "destructive" });
    } else {
      setLogs((data ?? []) as WebhookLog[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
    const channel = supabase
      .channel("mp-webhook-logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mercadopago_webhook_logs" },
        (payload) => {
          setLogs((prev) => [payload.new as WebhookLog, ...prev].slice(0, 50));
          toast({ title: "Novo webhook recebido!", description: `Status: ${(payload.new as WebhookLog).http_status}` });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSimulatePayment = async () => {
    try {
      setSimulating(true);
      const { data, error } = await supabase.functions.invoke("simulate-mp-payment", { body: {} });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setSimulated(data);
      toast({ title: "Pagamento de teste criado", description: "Pague o QR Code (R$ 0,01) para acionar o webhook real." });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha ao simular", variant: "destructive" });
    } finally {
      setSimulating(false);
    }
  };

  const handleTriggerWebhook = async () => {
    if (!simulated?.payment_id) return;
    try {
      setTriggering(true);
      const { data, error } = await supabase.functions.invoke("simulate-mp-payment", {
        body: { action: "trigger_webhook", paymentId: simulated.payment_id },
      });
      if (error) throw error;
      toast({
        title: "Webhook acionado",
        description: `Status: ${data.webhook_status} — verifique os logs abaixo`,
      });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha", variant: "destructive" });
    } finally {
      setTriggering(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!simulated?.payment_id) return;
    try {
      const { data, error } = await supabase.functions.invoke("simulate-mp-payment", {
        body: { action: "check_status", paymentId: simulated.payment_id },
      });
      if (error) throw error;
      toast({
        title: `Status: ${data.payment?.status ?? "desconhecido"}`,
        description: data.payment?.status_detail ?? "—",
      });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "Falha", variant: "destructive" });
    }
  };

  const copyQrCode = () => {
    if (!simulated?.qr_code) return;
    navigator.clipboard.writeText(simulated.qr_code);
    toast({ title: "Código PIX copiado!" });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Webhook className="h-7 w-7 text-primary" /> Diagnóstico Mercado Pago
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Simule pagamentos PIX e acompanhe os webhooks em tempo real.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* SIMULAR */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /> Simular Pagamento</CardTitle>
            <CardDescription>Cria um PIX real de R$ 0,01 para testar o fluxo de ponta a ponta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!simulated && (
              <Button onClick={handleSimulatePayment} disabled={simulating} className="w-full">
                {simulating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Gerar PIX de teste (R$ 0,01)
              </Button>
            )}

            {simulated && (
              <div className="space-y-3">
                <div className="flex justify-center bg-white p-4 rounded-lg border">
                  <img src={`data:image/png;base64,${simulated.qr_code_base64}`} alt="QR Code" className="w-48 h-48" />
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">ID:</span><span className="font-mono">{simulated.payment_id}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor:</span><span>R$ {simulated.amount.toFixed(2)}</span></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={copyQrCode} className="flex-1">
                    <Copy className="h-3 w-3 mr-1" /> Copiar PIX
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCheckStatus} className="flex-1">
                    <RefreshCw className="h-3 w-3 mr-1" /> Status
                  </Button>
                </div>
                <Button size="sm" variant="secondary" onClick={handleTriggerWebhook} disabled={triggering} className="w-full">
                  {triggering ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Webhook className="h-3 w-3 mr-1" />}
                  Forçar acionamento do webhook
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSimulated(null)} className="w-full">
                  Novo teste
                </Button>
              </div>
            )}

            <div className="text-xs text-muted-foreground border-t pt-3 space-y-1">
              <p><strong>1.</strong> Clique em "Gerar PIX" para criar um pagamento real de 1 centavo.</p>
              <p><strong>2.</strong> Pague no app do banco — o MP envia o webhook automaticamente.</p>
              <p><strong>3.</strong> Ou clique em "Forçar webhook" para simular sem pagar.</p>
              <p><strong>4.</strong> Os logs aparecem ao lado em tempo real.</p>
            </div>
          </CardContent>
        </Card>

        {/* LOGS */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Webhooks Recebidos</CardTitle>
              <CardDescription>Atualização em tempo real • {logs.length} logs</CardDescription>
            </div>
            <Button size="icon" variant="ghost" onClick={loadLogs}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-3">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Nenhum webhook recebido ainda.<br />
                  Gere um pagamento de teste e aguarde.
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <button
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`w-full text-left border rounded-lg p-3 hover:bg-muted/50 transition ${selectedLog?.id === log.id ? "border-primary bg-muted/30" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          {log.http_status && log.http_status >= 200 && log.http_status < 300 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="text-xs font-semibold">{log.event_type ?? "—"}</span>
                          {paymentStatusBadge(log.payment_status)}
                        </div>
                        {statusBadge(log.http_status)}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{log.payment_id ? `ID: ${log.payment_id}` : "sem payment_id"}</span>
                        <span>{format(new Date(log.created_at), "HH:mm:ss", { locale: ptBR })}</span>
                      </div>
                      {log.error_message && (
                        <div className="text-xs text-red-600 mt-1 truncate">⚠ {log.error_message}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* DETALHES */}
      {selectedLog && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhes do log</CardTitle>
            <CardDescription>
              {format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
              {selectedLog.processing_time_ms !== null && ` • ${selectedLog.processing_time_ms}ms`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div><div className="text-muted-foreground">HTTP</div><div>{statusBadge(selectedLog.http_status)}</div></div>
              <div><div className="text-muted-foreground">Tipo</div><div className="font-mono">{selectedLog.event_type ?? "—"}</div></div>
              <div><div className="text-muted-foreground">Status pagto</div><div>{paymentStatusBadge(selectedLog.payment_status) ?? "—"}</div></div>
              <div>
                <div className="text-muted-foreground">Assinatura</div>
                <div>{selectedLog.signature_valid === true ? "✅ Válida" : selectedLog.signature_valid === false ? "❌ Inválida" : "—"}</div>
              </div>
            </div>
            {selectedLog.error_message && (
              <div className="bg-red-500/10 border border-red-500/20 rounded p-2 text-xs text-red-600">
                {selectedLog.error_message}
              </div>
            )}
            <div>
              <div className="text-xs text-muted-foreground mb-1">Body recebido</div>
              <pre className="bg-muted rounded p-2 text-xs overflow-x-auto max-h-40">
                {JSON.stringify(selectedLog.raw_body, null, 2)}
              </pre>
            </div>
            {selectedLog.payment_data && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Dados do pagamento (MP API)</div>
                <pre className="bg-muted rounded p-2 text-xs overflow-x-auto max-h-60">
                  {JSON.stringify(selectedLog.payment_data, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
