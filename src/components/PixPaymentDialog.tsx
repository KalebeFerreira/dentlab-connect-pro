import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PixPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceId: string | null;
  planName: string;
  onSuccess?: () => void;
}

interface PixData {
  payment_id: number;
  qr_code: string;
  qr_code_base64: string;
  ticket_url: string;
  amount: number;
  original_amount: number;
  expires_at: string;
}

export const PixPaymentDialog = ({ open, onOpenChange, priceId, planName, onSuccess }: PixPaymentDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [polling, setPolling] = useState(false);

  // Generate PIX when dialog opens
  useEffect(() => {
    if (open && priceId && !pixData && !loading) {
      generatePix();
    }
    if (!open) {
      setPixData(null);
      setCopied(false);
      setPolling(false);
    }
  }, [open, priceId]);

  // Countdown
  useEffect(() => {
    if (!pixData?.expires_at) return;
    const interval = setInterval(() => {
      const diff = new Date(pixData.expires_at).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Expirado");
        clearInterval(interval);
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [pixData?.expires_at]);

  // Poll payment status
  useEffect(() => {
    if (!pixData?.payment_id || !open) return;
    setPolling(true);
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("pix_payments")
        .select("status")
        .eq("mercadopago_payment_id", String(pixData.payment_id))
        .maybeSingle();
      if (data?.status === "approved") {
        clearInterval(interval);
        toast({ title: "Pagamento confirmado!", description: "Sua assinatura foi ativada." });
        onSuccess?.();
        onOpenChange(false);
      }
    }, 4000);
    return () => {
      clearInterval(interval);
      setPolling(false);
    };
  }, [pixData?.payment_id, open]);

  const generatePix = async () => {
    if (!priceId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("create-pix-payment", {
        body: { priceId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setPixData(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar PIX";
      toast({ title: "Erro", description: msg, variant: "destructive" });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!pixData?.qr_code) return;
    navigator.clipboard.writeText(pixData.qr_code);
    setCopied(true);
    toast({ title: "Código copiado!", description: "Cole no app do seu banco." });
    setTimeout(() => setCopied(false), 2500);
  };

  const discount = pixData ? pixData.original_amount - pixData.amount : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar com PIX — 10% OFF</DialogTitle>
          <DialogDescription>{planName}</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
          </div>
        )}

        {pixData && !loading && (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground line-through">R$ {pixData.original_amount.toFixed(2)}</span>
                <span className="text-green-600 font-bold text-lg">R$ {pixData.amount.toFixed(2)}</span>
              </div>
              <p className="text-xs text-green-600 mt-1">Você economiza R$ {discount.toFixed(2)} pagando via PIX</p>
            </div>

            <div className="flex justify-center bg-white p-4 rounded-lg border">
              <img
                src={`data:image/png;base64,${pixData.qr_code_base64}`}
                alt="QR Code PIX"
                className="w-56 h-56"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Ou copie o código PIX:</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={pixData.qr_code}
                  className="flex-1 text-xs bg-muted px-3 py-2 rounded border font-mono truncate"
                />
                <Button size="icon" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-3">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                Expira em
              </span>
              <span className="font-mono font-semibold">{timeLeft}</span>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              {polling ? "Aguardando confirmação do pagamento..." : ""}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
