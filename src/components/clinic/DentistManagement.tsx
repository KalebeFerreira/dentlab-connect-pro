import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2, Edit, UserCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Dentist {
  id: string;
  name: string;
  specialty: string | null;
  cro: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  user_id: string | null;
  auth_enabled: boolean;
}

export const DentistManagement = () => {
  const [dentists, setDentists] = useState<Dentist[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDentist, setEditingDentist] = useState<Dentist | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    specialty: "",
    cro: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    loadDentists();
  }, []);

  const loadDentists = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("dentists")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setDentists(data || []);
    } catch (error) {
      console.error("Error loading dentists:", error);
      toast.error("Erro ao carregar dentistas");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingDentist) {
        const { error } = await supabase
          .from("dentists")
          .update(formData)
          .eq("id", editingDentist.id);

        if (error) throw error;
        toast.success("Dentista atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("dentists")
          .insert([{ ...formData, user_id: user.id }]);

        if (error) throw error;
        toast.success("Dentista cadastrado com sucesso!");
      }

      setIsDialogOpen(false);
      resetForm();
      loadDentists();
    } catch (error) {
      console.error("Error saving dentist:", error);
      toast.error("Erro ao salvar dentista");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente remover este dentista?")) return;

    try {
      const { error } = await supabase
        .from("dentists")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
      toast.success("Dentista removido com sucesso!");
      loadDentists();
    } catch (error) {
      console.error("Error deleting dentist:", error);
      toast.error("Erro ao remover dentista");
    }
  };

  const handleCreateAccess = async (dentist: Dentist) => {
    if (!dentist.email) {
      toast.error("Dentista precisa ter um email cadastrado");
      return;
    }

    const defaultPassword = prompt(
      `Criar acesso para ${dentist.name}?\nDigite a senha inicial (mínimo 6 caracteres):`
    );

    if (!defaultPassword || defaultPassword.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-dentist-access', {
        body: {
          dentistId: dentist.id,
          email: dentist.email,
          password: defaultPassword,
          name: dentist.name
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.success) {
        throw new Error('Falha ao criar acesso');
      }

      toast.success(data.message || `Acesso criado com sucesso!\nLogin: ${dentist.email}\nO dentista deve fazer login em: ${window.location.origin}/auth`);
      loadDentists();
    } catch (error: any) {
      console.error("Error creating access:", error);
      const errorMessage = error.message || 'Erro desconhecido ao criar acesso';
      toast.error(`Erro ao criar acesso: ${errorMessage}`);
    }
  };

  const handleEdit = (dentist: Dentist) => {
    setEditingDentist(dentist);
    setFormData({
      name: dentist.name,
      specialty: dentist.specialty || "",
      cro: dentist.cro || "",
      phone: dentist.phone || "",
      email: dentist.email || "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      specialty: "",
      cro: "",
      phone: "",
      email: "",
    });
    setEditingDentist(null);
  };

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
            <CardTitle>Gestão de Dentistas</CardTitle>
            <CardDescription>Gerencie os dentistas da sua clínica</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Dentista
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingDentist ? "Editar Dentista" : "Novo Dentista"}
                </DialogTitle>
                <DialogDescription>
                  Preencha as informações do dentista
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="specialty">Especialidade</Label>
                  <Input
                    id="specialty"
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="cro">CRO</Label>
                  <Input
                    id="cro"
                    value={formData.cro}
                    onChange={(e) => setFormData({ ...formData, cro: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editingDentist ? "Atualizar" : "Cadastrar"}
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
        {dentists.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UserCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum dentista cadastrado</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {dentists.map((dentist) => (
              <div
                key={dentist.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                   <h4 className="font-semibold">{dentist.name}</h4>
                  <div className="text-sm text-muted-foreground space-y-1 mt-1">
                    {dentist.specialty && <p>Especialidade: {dentist.specialty}</p>}
                    {dentist.cro && <p>CRO: {dentist.cro}</p>}
                    {dentist.phone && <p>Telefone: {dentist.phone}</p>}
                    {dentist.email && <p>Email: {dentist.email}</p>}
                    {dentist.auth_enabled && (
                      <p className="text-green-600 font-medium">✓ Acesso ao sistema ativado</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!dentist.auth_enabled && dentist.email && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCreateAccess(dentist)}
                    >
                      Criar Acesso
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(dentist)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(dentist.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};