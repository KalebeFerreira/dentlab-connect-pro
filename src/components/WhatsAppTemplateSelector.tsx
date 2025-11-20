import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { MessageSquare, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Template {
  id: string;
  template_name: string;
  message_content: string;
}

interface Document {
  file_name: string;
  file_size: number;
  category: string;
  file_type: string;
}

interface WhatsAppTemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Document | null;
  labName: string;
  onTemplateSelect: (message: string) => void;
  getCategoryLabel: (category: string) => string;
  formatFileSize: (bytes: number) => string;
}

export const WhatsAppTemplateSelector = ({
  open,
  onOpenChange,
  document,
  labName,
  onTemplateSelect,
  getCategoryLabel,
  formatFileSize,
}: WhatsAppTemplateSelectorProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .eq("user_id", user.id)
        .eq("template_type", "whatsapp_stl_share")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar templates", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (template: Template) => {
    if (!document) return;

    const message = template.message_content
      .replace(/\{labName\}/g, labName)
      .replace(/\{fileName\}/g, document.file_name)
      .replace(/\{category\}/g, getCategoryLabel(document.category))
      .replace(/\{fileSize\}/g, formatFileSize(document.file_size))
      .replace(/\{fileType\}/g, document.file_type || "N/A");

    onTemplateSelect(message);
    onOpenChange(false);
  };

  const useDefaultMessage = () => {
    if (!document) return;

    const message = `🦷 *${labName}*\n\n📄 *Arquivo:* ${document.file_name}\n📁 *Categoria:* ${getCategoryLabel(document.category)}\n📊 *Tamanho:* ${formatFileSize(document.file_size)}\n📋 *Tipo:* ${document.file_type || "N/A"}\n\n💬 Arquivo disponível para visualização e download.`;
    
    onTemplateSelect(message);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecione um Template de Mensagem</DialogTitle>
          <DialogDescription>
            Escolha um template para compartilhar o arquivo via WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando templates...</div>
          ) : (
            <>
              <div className="space-y-3">
                <Card 
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={useDefaultMessage}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        <h4 className="font-semibold">Mensagem Padrão</h4>
                        <Badge variant="secondary">Padrão</Badge>
                      </div>
                    </div>
                    {document && (
                      <pre className="text-sm whitespace-pre-wrap text-muted-foreground mt-2 p-3 bg-muted rounded-lg">
                        {`🦷 *${labName}*\n\n📄 *Arquivo:* ${document.file_name}\n📁 *Categoria:* ${getCategoryLabel(document.category)}\n📊 *Tamanho:* ${formatFileSize(document.file_size)}\n📋 *Tipo:* ${document.file_type || "N/A"}\n\n💬 Arquivo disponível para visualização e download.`}
                      </pre>
                    )}
                  </CardContent>
                </Card>

                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-5 w-5" />
                          <h4 className="font-semibold">{template.template_name}</h4>
                        </div>
                        {selectedTemplate?.id === template.id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      {document && (
                        <pre className="text-sm whitespace-pre-wrap text-muted-foreground mt-2 p-3 bg-muted rounded-lg">
                          {template.message_content
                            .replace(/\{labName\}/g, labName)
                            .replace(/\{fileName\}/g, document.file_name)
                            .replace(/\{category\}/g, getCategoryLabel(document.category))
                            .replace(/\{fileSize\}/g, formatFileSize(document.file_size))
                            .replace(/\{fileType\}/g, document.file_type || "N/A")}
                        </pre>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {templates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum template personalizado criado. Usando mensagem padrão.
                </div>
              )}

              {selectedTemplate && (
                <div className="flex justify-end">
                  <Button onClick={() => applyTemplate(selectedTemplate)}>
                    Usar Este Template
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
