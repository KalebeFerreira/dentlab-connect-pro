import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  Smartphone,
  QrCode,
  LogOut,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Webhook,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Status = "disconnected" | "connecting" | "open" | "unknown";

interface Info {
  instance_name: string | null;
  connection_status: Status;
  webhook_url: string | null;
  whatsapp_number: string | null;
  connected_at: string | null;
}

const POLL_MS = 4000;

export default function WhatsAppConnection() {
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const call = useCallback(async (action: string) => {
    const { data, error } = await supabase.functions.invoke("evolution-manager", {
      body: { action },
    });
    if (error) throw new Error(error.message || "Erro de conexão");
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await call("get");
      setInfo({
        instance_name: data.instance_name ?? null,
        connection_status: (data.connection_status as Status) ?? "disconnected",
        webhook_url: data.webhook_url ?? null,
        whatsapp_number: data.whatsapp_number ?? null,
        connected_at: data.connected_at ?? null,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const data = await call("status");
        if (data.state === "open") {
          stopPolling();
          setQrcode(null);
          setQrOpen(false);
          toast.success("WhatsApp conectado com sucesso!");
          await refresh();
        }
      } catch (e: any) {
        console.warn("[whatsapp] polling error", e.message);
      }
    }, POLL_MS);
  }, [call, refresh, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Stop polling when modal is closed manually
  useEffect(() => {
    if (!qrOpen) stopPolling();
  }, [qrOpen, stopPolling]);

  const requestQrCode = async () => {
    setError(null);
    setQrcode(null);
    setQrOpen(true); // open modal immediately so user sees spinner
    try {
      const data = await call("connect");
      const raw: unknown = data?.qrcode;
      // Accept ONLY a real base64 PNG of the pairing QR. Reject short pairing tokens
      // (e.g. Baileys "2@...") and any wa.me/api.whatsapp URLs.
      if (typeof raw === "string" && raw.length > 100) {
        const qr = raw.startsWith("data:image") ? raw : `data:image/png;base64,${raw}`;
        setQrcode(qr);
        startPolling();
        return true;
      }
      toast.error("QR Code não retornado pela API. Tente novamente.");
      setQrOpen(false);
      return false;
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
      setQrOpen(false);
      return false;
    }
  };


  const handleCreate = async () => {
    setBusy("create");
    setError(null);
    try {
      await call("create");
      await refresh();
      await requestQrCode();
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleConnect = async () => {
    setBusy("connect");
    try {
      await requestQrCode();
      await refresh();
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnect = async () => {
    setBusy("disconnect");
    setError(null);
    try {
      await call("disconnect");
      stopPolling();
      setQrcode(null);
      setQrOpen(false);
      toast.success("Instância desconectada");
      await refresh();
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleResetWebhook = async () => {
    setBusy("webhook");
    setError(null);
    try {
      const data = await call("set_webhook");
      toast.success("Webhook atualizado");
      setInfo((p) => (p ? { ...p, webhook_url: data.webhook_url } : p));
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const status: Status = info?.connection_status ?? "disconnected";
  const hasInstance = !!info?.instance_name;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" /> Conexão WhatsApp
              </CardTitle>
              <CardDescription>
                Cada clínica gerencia sua própria instância de WhatsApp — tudo acontece dentro do painel, sem redirecionar.
              </CardDescription>
            </div>
            <StatusBadge status={status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {hasInstance && (
            <div className="grid gap-2 text-sm rounded-md bg-muted/40 p-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Instância</span>
                <span className="font-mono text-xs">{info?.instance_name}</span>
              </div>
              {info?.whatsapp_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Número</span>
                  <span className="font-medium">+{info.whatsapp_number}</span>
                </div>
              )}
              {info?.webhook_url && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground shrink-0">Webhook</span>
                  <span className="font-mono text-[10px] truncate">{info.webhook_url}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!hasInstance && (
              <Button type="button" onClick={handleCreate} disabled={!!busy}>
                {busy === "create" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <QrCode className="w-4 h-4" />
                )}
                Gerar Nova Instância
              </Button>
            )}
            {hasInstance && status !== "open" && (
              <Button type="button" onClick={handleConnect} disabled={!!busy}>
                {busy === "connect" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <QrCode className="w-4 h-4" />
                )}
                Conectar WhatsApp
              </Button>
            )}
            {hasInstance && (
              <Button type="button" variant="outline" onClick={() => refresh()} disabled={!!busy}>
                <RefreshCw className="w-4 h-4" /> Verificar Status
              </Button>
            )}
            {hasInstance && (
              <Button
                type="button"
                variant="outline"
                onClick={handleResetWebhook}
                disabled={!!busy}
              >
                {busy === "webhook" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Webhook className="w-4 h-4" />
                )}
                Reconfigurar Webhook
              </Button>
            )}
            {hasInstance && status === "open" && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDisconnect}
                disabled={!!busy}
              >
                {busy === "disconnect" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                Desconectar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* QR Code Modal — fica DENTRO do painel, sem redirecionar */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" /> Conectar WhatsApp
            </DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no celular &gt; Aparelhos conectados &gt; Conectar um aparelho e
              escaneie o código abaixo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3 py-2">
            {qrcode ? (
              <img
                src={qrcode}
                alt="QR Code WhatsApp"
                className="w-64 h-64 rounded-md bg-white p-2 border"
              />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-md">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Verificando conexão automaticamente...
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleConnect}
              disabled={!!busy}
              className="gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Gerar novo QR Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "open")
    return (
      <Badge className="bg-green-600 hover:bg-green-600 text-white">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Conectado
      </Badge>
    );
  if (status === "connecting")
    return (
      <Badge className="bg-yellow-500 hover:bg-yellow-500 text-white">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        Conectando
      </Badge>
    );
  return (
    <Badge variant="secondary">
      <XCircle className="w-3 h-3 mr-1" />
      Desconectado
    </Badge>
  );
}
