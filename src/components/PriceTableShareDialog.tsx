import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, MessageCircle, Loader2 } from "lucide-react";

interface PriceItem {
  workType: string;
  description: string;
  price: string;
  imageUrl: string | null;
}

interface PriceTableShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: string;
  items: PriceItem[];
  laboratoryName: string;
}

export const PriceTableShareDialog = ({
  open,
  onOpenChange,
  tableName,
  items,
  laboratoryName,
}: PriceTableShareDialogProps) => {
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [message, setMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  const validItems = items.filter(item => item.workType && item.price);

  const handleSendEmail = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Digite um email válido");
      return;
    }

    if (validItems.length === 0) {
      toast.error("A tabela deve conter pelo menos um item válido");
      return;
    }

    try {
      setSendingEmail(true);

      const { error } = await supabase.functions.invoke("send-price-table-email", {
        body: {
          to: email,
          tableName,
          items: validItems,
          laboratoryName: laboratoryName || undefined,
          message: message || undefined,
        },
      });

      if (error) throw error;

      toast.success("Email enviado com sucesso!", {
        description: `Tabela de preços enviada para ${email}`,
      });

      setEmail("");
      setMessage("");
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error("Erro ao enviar email", {
        description: error.message,
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendWhatsApp = () => {
    if (!whatsapp) {
      toast.error("Digite um número de WhatsApp");
      return;
    }

    if (validItems.length === 0) {
      toast.error("A tabela deve conter pelo menos um item válido");
      return;
    }

    // Format WhatsApp message
    let whatsappMessage = `🦷 *${tableName}*\n\n`;
    
    if (message) {
      whatsappMessage += `${message}\n\n`;
    }

    whatsappMessage += `📋 *Serviços e Preços:*\n\n`;

    validItems.forEach((item, index) => {
      const price = parseFloat(item.price || '0');
      const formattedPrice = price.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      whatsappMessage += `${index + 1}. *${item.workType}*\n`;
      if (item.description) {
        whatsappMessage += `   ${item.description}\n`;
      }
      whatsappMessage += `   💰 R$ ${formattedPrice}\n\n`;
    });

    if (laboratoryName) {
      whatsappMessage += `\n📌 *${laboratoryName}*\n`;
    }

    whatsappMessage += `\n_Tabela gerada em ${new Date().toLocaleDateString('pt-BR')}_`;

    // Clean phone number
    const cleanPhone = whatsapp.replace(/\D/g, '');
    
    // Open WhatsApp
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(whatsappUrl, '_blank');

    toast.success("WhatsApp aberto!", {
      description: "Mensagem preparada para envio",
    });

    setWhatsapp("");
    setMessage("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar Tabela de Preços</DialogTitle>
          <DialogDescription>
            Envie a tabela diretamente por email ou WhatsApp
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="email" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4 mt-4">
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-sm font-medium mb-1">📊 {tableName}</p>
              <p className="text-xs text-muted-foreground">
                {validItems.length} {validItems.length === 1 ? 'item' : 'itens'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email do Destinatário *</Label>
              <Input
                id="email"
                type="email"
                placeholder="exemplo@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-message">Mensagem (Opcional)</Label>
              <Textarea
                id="email-message"
                placeholder="Adicione uma mensagem personalizada..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              onClick={handleSendEmail}
              disabled={sendingEmail}
              className="w-full gap-2"
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Enviar Email
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="whatsapp" className="space-y-4 mt-4">
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-sm font-medium mb-1">📊 {tableName}</p>
              <p className="text-xs text-muted-foreground">
                {validItems.length} {validItems.length === 1 ? 'item' : 'itens'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">Número do WhatsApp *</Label>
              <Input
                id="whatsapp"
                type="tel"
                placeholder="5511999999999"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Formato: código do país + DDD + número (ex: 5511999999999)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp-message">Mensagem (Opcional)</Label>
              <Textarea
                id="whatsapp-message"
                placeholder="Adicione uma mensagem personalizada..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              onClick={handleSendWhatsApp}
              disabled={sendingWhatsApp}
              className="w-full gap-2"
            >
              {sendingWhatsApp ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparando...
                </>
              ) : (
                <>
                  <MessageCircle className="h-4 w-4" />
                  Enviar WhatsApp
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
