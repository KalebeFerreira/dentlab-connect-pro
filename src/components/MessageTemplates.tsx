import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Edit, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MessageTemplate {
  id: string;
  template_name: string;
  template_type: string;
  message_content: string;
  variables: any;
  is_active: boolean;
}

const templateTypes = [
  { value: "appointment_reminder", label: "Lembrete de Agendamento" },
  { value: "order_status", label: "Status de Pedido" },
  { value: "payment_reminder", label: "Lembrete de Pagamento" },
  { value: "custom", label: "Personalizado" }
];

const availableVariables: Record<string, string[]> = {
  appointment_reminder: ["{patient_name}", "{date}", "{time}", "{clinic_name}"],
  order_status: ["{patient_name}", "{order_number}", "{status}", "{delivery_date}"],
  payment_reminder: ["{patient_name}", "{amount}", "{due_date}"],
  custom: ["{patient_name}", "{clinic_name}", "{date}"]
};

export const MessageTemplates = () => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    template_name: "",
    template_type: "custom",
    message_content: "",
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Erro ao carregar templates");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (!formData.template_name || !formData.message_content) {
        toast.error("Preencha todos os campos obrigatórios");
        return;
      }

      const templateData = {
        user_id: user.id,
        template_name: formData.template_name,
        template_type: formData.template_type,
        message_content: formData.message_content,
        variables: availableVariables[formData.template_type as keyof typeof availableVariables] || [],
        is_active: true,
      };

      if (editingId) {
        const { error } = await supabase
          .from("message_templates")
          .update(templateData)
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Template atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("message_templates")
          .insert(templateData);

        if (error) throw error;
        toast.success("Template criado com sucesso!");
      }

      setFormData({ template_name: "", template_type: "custom", message_content: "" });
      setShowForm(false);
      setEditingId(null);
      loadTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Erro ao salvar template");
    }
  };

  const handleEdit = (template: MessageTemplate) => {
    setFormData({
      template_name: template.template_name,
      template_type: template.template_type,
      message_content: template.message_content,
    });
    setEditingId(template.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("message_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Template excluído com sucesso!");
      loadTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Erro ao excluir template");
    }
  };

  const insertVariable = (variable: string) => {
    setFormData(prev => ({
      ...prev,
      message_content: prev.message_content + " " + variable
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Templates de Mensagens
            </CardTitle>
            <CardDescription>
              Crie templates personalizáveis para diferentes tipos de notificações
            </CardDescription>
          </div>
          <Button onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData({ template_name: "", template_type: "custom", message_content: "" });
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showForm && (
          <div className="mb-6 p-4 border rounded-lg bg-muted/30">
            <h3 className="font-semibold mb-4">
              {editingId ? "Editar Template" : "Novo Template"}
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="template_name">Nome do Template</Label>
                <Input
                  id="template_name"
                  value={formData.template_name}
                  onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                  placeholder="Ex: Lembrete de Consulta"
                />
              </div>
              
              <div>
                <Label htmlFor="template_type">Tipo</Label>
                <Select
                  value={formData.template_type}
                  onValueChange={(value) => setFormData({ ...formData, template_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templateTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="message_content">Mensagem</Label>
                <Textarea
                  id="message_content"
                  value={formData.message_content}
                  onChange={(e) => setFormData({ ...formData, message_content: e.target.value })}
                  placeholder="Digite sua mensagem aqui..."
                  rows={5}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Variáveis disponíveis:</span>
                  {availableVariables[formData.template_type as keyof typeof availableVariables]?.map((variable) => (
                    <Badge
                      key={variable}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary/20"
                      onClick={() => insertVariable(variable)}
                    >
                      {variable}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave}>
                  {editingId ? "Atualizar" : "Criar"} Template
                </Button>
                <Button variant="outline" onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({ template_name: "", template_type: "custom", message_content: "" });
                }}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}

        {templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum template criado ainda</p>
            <p className="text-sm mt-1">Crie seu primeiro template de mensagem</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="p-4 border rounded-lg hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold">{template.template_name}</h4>
                    <Badge variant="outline" className="mt-1">
                      {templateTypes.find(t => t.value === template.template_type)?.label}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(template)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {template.message_content}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};