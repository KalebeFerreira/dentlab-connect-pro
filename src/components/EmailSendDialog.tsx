import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Loader2, Send } from "lucide-react";

interface Document {
  file_name: string;
  file_path: string;
  file_size: number;
  category: string;
  file_type: string;
}

interface EmailSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Document | null;
  labName: string;
  getCategoryLabel: (category: string) => string;
  formatFileSize: (bytes: number) => string;
}

export const EmailSendDialog = ({
  open,
  onOpenChange,
  document,
  labName,
  getCategoryLabel,
  formatFileSize,
}: EmailSendDialogProps) => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSendEmail = async () => {
    if (!document) return;

    if (!email || !email.includes("@")) {
      toast.error("Digite um email válido");
      return;
    }

    try {
      setSending(true);

      const { error } = await supabase.functions.invoke("send-document-email", {
        body: {
          to: email,
          labName: labName || "Laboratório",
          fileName: document.file_name,
          fileUrl: document.file_path,
          category: getCategoryLabel(document.category),
          fileSize: formatFileSize(document.file_size),
          fileType: document.file_type || "N/A",
          message: message || undefined,
        },
      });

      if (error) throw error;

      toast.success("Email enviado com sucesso!", {
        description: `Documento enviado para ${email}`,
      });

      setEmail("");
      setMessage("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error("Erro ao enviar email", {
        description: error.message,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Enviar Documento por Email
          </DialogTitle>
          <DialogDescription>
            Envie o arquivo para um destinatário via email
          </DialogDescription>
        </DialogHeader>

        {document && (
          <div className="space-y-4">
            {/* Document Info */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm font-medium mb-1">📄 {document.file_name}</p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>📁 Categoria: {getCategoryLabel(document.category)}</p>
                <p>📊 Tamanho: {formatFileSize(document.file_size)}</p>
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="recipient-email">Email do Destinatário *</Label>
              <Input
                id="recipient-email"
                type="email"
                placeholder="exemplo@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Message Input */}
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
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancelar
          </Button>
          <Button onClick={handleSendEmail} disabled={sending || !email}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
