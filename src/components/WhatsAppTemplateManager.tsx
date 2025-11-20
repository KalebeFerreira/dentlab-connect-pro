import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Template {
  id: string;
  template_name: string;
  message_content: string;
  is_active: boolean;
}

export const WhatsAppTemplateManager = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    template_name: "",
    message_content: "",
  });

  useEffect(() => {
    loadTemplates();
  }, []);

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
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar templates", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!formData.template_name || !formData.message_content) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingTemplate) {
        const { error } = await supabase
          .from("message_templates")
          .update({
            template_name: formData.template_name,
            message_content: formData.message_content,
          })
          .eq("id", editingTemplate.id);

        if (error) throw error;
        toast.success("Template atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("message_templates")
        .insert({
          user_id: user.id,
          template_name: formData.template_name,
          template_type: "whatsapp_stl_share",
          message_content: formData.message_content,
          is_active: true,
          variables: ["fileName", "category", "fileSize", "fileType", "labName"],
        });

        if (error) throw error;
        toast.success("Template criado com sucesso!");
      }

      loadTemplates();
      handleCancelEdit();
    } catch (error: any) {
      toast.error("Erro ao salvar template", { description: error.message });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este template?")) return;

    try {
      const { error } = await supabase
        .from("message_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Template excluído com sucesso!");
      loadTemplates();
    } catch (error: any) {
      toast.error("Erro ao excluir template", { description: error.message });
    }
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      template_name: template.template_name,
      message_content: template.message_content,
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setFormData({
      template_name: "",
      message_content: "",
    });
    setShowForm(false);
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setFormData({
      template_name: "",
      message_content: "",
    });
    setShowForm(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Templates de Mensagens WhatsApp</CardTitle>
            <Button onClick={handleNewTemplate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
              <div className="rounded-lg border p-4 bg-muted/50">
              <h4 className="text-sm font-semibold mb-2">Variáveis Disponíveis:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><Badge variant="outline">{"{labName}"}</Badge> - Nome do laboratório</div>
                <div><Badge variant="outline">{"{fileName}"}</Badge> - Nome do arquivo</div>
                <div><Badge variant="outline">{"{category}"}</Badge> - Categoria do arquivo</div>
                <div><Badge variant="outline">{"{fileSize}"}</Badge> - Tamanho do arquivo</div>
                <div><Badge variant="outline">{"{fileType}"}</Badge> - Tipo do arquivo</div>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum template criado ainda. Crie seu primeiro template!
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.template_name}</TableCell>
                      <TableCell className="max-w-md truncate">{template.message_content}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditTemplate(template)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteTemplate(template.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Editar Template" : "Novo Template"}
            </DialogTitle>
            <DialogDescription>
              Use as variáveis disponíveis para personalizar sua mensagem. As variáveis serão substituídas automaticamente ao compartilhar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template_name">Nome do Template *</Label>
              <Input
                id="template_name"
                value={formData.template_name}
                onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                placeholder="Ex: Padrão, Formal, Informal..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message_content">Mensagem *</Label>
              <Textarea
                id="message_content"
                value={formData.message_content}
                onChange={(e) => setFormData({ ...formData, message_content: e.target.value })}
                placeholder="Ex: 🦷 *{labName}*&#10;&#10;📄 Arquivo: {fileName}&#10;📁 Categoria: {category}&#10;📊 Tamanho: {fileSize}&#10;📋 Tipo: {fileType}"
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            <div className="rounded-lg border p-4 bg-muted/50">
              <h4 className="text-sm font-semibold mb-2">Preview:</h4>
              <pre className="text-sm whitespace-pre-wrap break-words">
                {formData.message_content
                  .replace("{labName}", "Nome do Lab")
                  .replace("{fileName}", "arquivo.stl")
                  .replace("{category}", "STL")
                  .replace("{fileSize}", "2.5 MB")
                  .replace("{fileType}", "application/stl")}
              </pre>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancelEdit}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSaveTemplate}>
                <Save className="h-4 w-4 mr-2" />
                Salvar Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
