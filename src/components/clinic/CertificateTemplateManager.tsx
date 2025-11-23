import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Edit, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface CertificateTemplate {
  id: string;
  template_name: string;
  category: string;
  default_reason: string;
  default_days: number;
  default_text: string;
  is_active: boolean;
}

const DEFAULT_TEMPLATES = [
  {
    template_name: "Extração Dentária",
    category: "Cirurgia",
    default_reason: "Extração de elemento dentário",
    default_days: 1,
    default_text: "Atesto para os devidos fins que o(a) paciente {patientName} esteve sob meus cuidados profissionais, sendo submetido(a) a procedimento de extração dentária, necessitando de repouso de {days} dia(s).",
  },
  {
    template_name: "Tratamento de Canal",
    category: "Endodontia",
    default_reason: "Tratamento endodôntico",
    default_days: 1,
    default_text: "Atesto para os devidos fins que o(a) paciente {patientName} esteve sob meus cuidados profissionais para tratamento endodôntico (canal), necessitando de afastamento de {days} dia(s) de suas atividades.",
  },
  {
    template_name: "Implante Dentário",
    category: "Implantodontia",
    default_reason: "Colocação de implante dentário",
    default_days: 2,
    default_text: "Atesto que o(a) paciente {patientName} foi submetido(a) a procedimento cirúrgico de implante dentário, necessitando de repouso de {days} dias para adequada recuperação pós-operatória.",
  },
  {
    template_name: "Urgência Odontológica",
    category: "Emergência",
    default_reason: "Urgência odontológica",
    default_days: 1,
    default_text: "Atesto para os devidos fins que o(a) paciente {patientName} necessitou de atendimento odontológico de urgência, sendo necessário o afastamento de {days} dia(s) de suas atividades habituais.",
  },
];

export const CertificateTemplateManager = () => {
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CertificateTemplate | null>(null);
  
  const [formData, setFormData] = useState({
    template_name: "",
    category: "",
    default_reason: "",
    default_days: "1",
    default_text: "",
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("certificate_templates")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("category, template_name");

      if (error) throw error;

      // If no templates exist, insert default ones
      if (!data || data.length === 0) {
        await insertDefaultTemplates(user.id);
        // Reload templates
        const { data: newData, error: newError } = await supabase
          .from("certificate_templates")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("category, template_name");

        if (newError) throw newError;
        setTemplates(newData || []);
      } else {
        setTemplates(data);
      }
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Erro ao carregar templates");
    } finally {
      setLoading(false);
    }
  };

  const insertDefaultTemplates = async (userId: string) => {
    try {
      const templatesWithUserId = DEFAULT_TEMPLATES.map(template => ({
        ...template,
        user_id: userId,
      }));

      const { error } = await supabase
        .from("certificate_templates")
        .insert(templatesWithUserId);

      if (error) throw error;
      toast.success("Templates padrão criados com sucesso!");
    } catch (error) {
      console.error("Error inserting default templates:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingTemplate) {
        const { error } = await supabase
          .from("certificate_templates")
          .update({
            ...formData,
            default_days: parseInt(formData.default_days),
          })
          .eq("id", editingTemplate.id);

        if (error) throw error;
        toast.success("Template atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("certificate_templates")
          .insert([{
            ...formData,
            default_days: parseInt(formData.default_days),
            user_id: user.id,
          }]);

        if (error) throw error;
        toast.success("Template criado com sucesso!");
      }

      setIsDialogOpen(false);
      resetForm();
      loadTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Erro ao salvar template");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente remover este template?")) return;

    try {
      const { error } = await supabase
        .from("certificate_templates")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
      toast.success("Template removido com sucesso!");
      loadTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Erro ao remover template");
    }
  };

  const handleEdit = (template: CertificateTemplate) => {
    setEditingTemplate(template);
    setFormData({
      template_name: template.template_name,
      category: template.category,
      default_reason: template.default_reason,
      default_days: template.default_days.toString(),
      default_text: template.default_text,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      template_name: "",
      category: "",
      default_reason: "",
      default_days: "1",
      default_text: "",
    });
    setEditingTemplate(null);
  };

  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, CertificateTemplate[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Templates de Atestado</CardTitle>
            <CardDescription>
              Crie e gerencie templates personalizados para diferentes situações
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? "Editar Template" : "Novo Template"}
                </DialogTitle>
                <DialogDescription>
                  Use variáveis: {"{patientName}"}, {"{days}"}, {"{startDate}"}, {"{endDate}"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="template_name">Nome do Template *</Label>
                    <Input
                      id="template_name"
                      value={formData.template_name}
                      onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                      placeholder="Ex: Extração Dentária"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Categoria *</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="Ex: Cirurgia"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="default_reason">Motivo Padrão *</Label>
                    <Input
                      id="default_reason"
                      value={formData.default_reason}
                      onChange={(e) => setFormData({ ...formData, default_reason: e.target.value })}
                      placeholder="Ex: Extração de elemento dentário"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="default_days">Dias Padrão *</Label>
                    <Input
                      id="default_days"
                      type="number"
                      min="1"
                      value={formData.default_days}
                      onChange={(e) => setFormData({ ...formData, default_days: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="default_text">Texto do Atestado *</Label>
                  <Textarea
                    id="default_text"
                    value={formData.default_text}
                    onChange={(e) => setFormData({ ...formData, default_text: e.target.value })}
                    placeholder="Use {patientName} e {days} como variáveis..."
                    rows={6}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    As variáveis serão substituídas automaticamente ao gerar o atestado
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editingTemplate ? "Atualizar" : "Criar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum template cadastrado</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
              <div key={category}>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  {category}
                  <Badge variant="secondary">{categoryTemplates.length}</Badge>
                </h3>
                <div className="grid gap-3">
                  {categoryTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <h4 className="font-semibold">{template.template_name}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {template.default_reason} • {template.default_days} dia(s)
                        </p>
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {template.default_text}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
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
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};