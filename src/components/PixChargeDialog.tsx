import { useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, QrCode, Copy, Check, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generatePixPayload, type PixKeyType } from "@/lib/pixStatic";

interface PixChargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface QrResult {
  payload: string;
  imageDataUrl: string;
  amount?: number;
  description?: string;
  ticketUrl?: string;
}

export function PixChargeDialog({ open, onOpenChange }: PixChargeDialogProps) {
  const [mode, setMode] = useState<"static" | "dynamic">("static");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<QrResult | null>(null);

  // Static fields
  const [keyType, setKeyType] = useState<PixKeyType>("phone");
  const [pixKey, setPixKey] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [merchantCity, setMerchantCity] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const reset = () => {
    setResult(null);
    setCopied(false);
  };

  const handleGenerateStatic = async () => {
    if (!pixKey.trim()) {
      toast.error("Informe a chave PIX");
      return;
    }
    if (!merchantName.trim()) {
      toast.error("Informe o nome do recebedor");
      return;
    }

    setLoading(true);
    try {
      const amountNum = amount ? parseFloat(amount.replace(",", ".")) : undefined;
      const payload = generatePixPayload({
        key: pixKey,
        keyType,
        merchantName,
        merchantCity: merchantCity || "BRASIL",
        amount: amountNum,
        description,
      });

      const imageDataUrl = await QRCode.toDataURL(payload, {
        width: 400,
        margin: 2,
        errorCorrectionLevel: "M",
      });

      setResult({ payload, imageDataUrl, amount: amountNum, description });
      toast.success("QR Code PIX gerado!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar QR Code");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDynamic = async () => {
    const amountNum = parseFloat(amount.replace(",", "."));
    if (!amountNum || amountNum <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-pix-charge", {
        body: {
          amount: amountNum,
          description: description || "Cobrança PIX",
          payer_name: merchantName,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const imageDataUrl = data.qr_code_base64
        ? `data:image/png;base64,${data.qr_code_base64}`
        : await QRCode.toDataURL(data.qr_code, { width: 400, margin: 2 });

      setResult({
        payload: data.qr_code,
        imageDataUrl,
        amount: data.amount,
        description: data.description,
        ticketUrl: data.ticket_url,
      });
      toast.success("Cobrança PIX criada!");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao criar cobrança PIX");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.payload);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    const link = document.createElement("a");
    link.href = result.imageDataUrl;
    link.download = `pix-qrcode-${Date.now()}.png`;
    link.click();
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      reset();
      setPixKey("");
      setAmount("");
      setDescription("");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Gerar Cobrança PIX
          </DialogTitle>
          <DialogDescription>
            Crie um QR Code PIX para receber pagamentos
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <Tabs value={mode} onValueChange={(v) => setMode(v as "static" | "dynamic")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="static">PIX Estático</TabsTrigger>
              <TabsTrigger value="dynamic">
                <Sparkles className="h-3 w-3 mr-1" />
                Mercado Pago
              </TabsTrigger>
            </TabsList>

            <TabsContent value="static" className="space-y-4 mt-4">
              <p className="text-xs text-muted-foreground">
                Funciona com qualquer banco. Você recebe direto na sua conta.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo de chave</Label>
                  <Select value={keyType} onValueChange={(v) => setKeyType(v as PixKeyType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">Telefone</SelectItem>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="random">Chave aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Chave PIX *</Label>
                  <Input
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    placeholder={
                      keyType === "phone" ? "11999999999" :
                      keyType === "cpf" ? "00000000000" :
                      keyType === "cnpj" ? "00000000000000" :
                      keyType === "email" ? "voce@email.com" :
                      "chave aleatória"
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nome do recebedor *</Label>
                  <Input
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    placeholder="Seu nome"
                    maxLength={25}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={merchantCity}
                    onChange={(e) => setMerchantCity(e.target.value)}
                    placeholder="São Paulo"
                    maxLength={15}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Valor (opcional)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                />
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para o pagador escolher o valor.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Serviço de prótese dentária"
                  rows={2}
                  maxLength={50}
                />
              </div>

              <Button onClick={handleGenerateStatic} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
                Gerar QR Code
              </Button>
            </TabsContent>

            <TabsContent value="dynamic" className="space-y-4 mt-4">
              <p className="text-xs text-muted-foreground">
                Cobrança real via Mercado Pago. Expira em 1 hora.
              </p>

              <div className="space-y-2">
                <Label>Valor *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label>Nome do pagador (opcional)</Label>
                <Input
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>

              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Pagamento de prótese - João Silva"
                  rows={2}
                />
              </div>

              <Button onClick={handleGenerateDynamic} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Criar Cobrança PIX
              </Button>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 flex justify-center bg-white">
                <img src={result.imageDataUrl} alt="QR Code PIX" className="w-64 h-64" />
              </CardContent>
            </Card>

            {result.amount && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Valor</p>
                <p className="text-2xl font-bold text-primary">
                  R$ {result.amount.toFixed(2).replace(".", ",")}
                </p>
                {result.description && (
                  <p className="text-sm text-muted-foreground mt-1">{result.description}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Código PIX (Copia e Cola)</Label>
              <Textarea
                readOnly
                value={result.payload}
                rows={3}
                className="font-mono text-xs"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleCopy} variant="outline">
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? "Copiado!" : "Copiar código"}
              </Button>
              <Button onClick={handleDownload} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Baixar QR Code
              </Button>
            </div>

            <Button onClick={reset} variant="ghost" className="w-full">
              Gerar outro QR Code
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
