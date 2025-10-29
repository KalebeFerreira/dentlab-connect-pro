import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

const NewOrder = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
    } catch (error) {
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const formData = new FormData(e.currentTarget);
      
      const orderData = {
        user_id: user.id,
        clinic_name: formData.get('clinic_name') as string,
        dentist_name: formData.get('dentist_name') as string,
        patient_name: formData.get('patient_name') as string,
        work_name: formData.get('work_name') as string,
        work_type: formData.get('work_type') as string,
        custom_color: formData.get('custom_color') as string,
        teeth_numbers: formData.get('teeth_numbers') as string,
        observations: formData.get('observations') as string,
        amount: formData.get('amount') ? parseFloat(formData.get('amount') as string) : null,
        delivery_date: formData.get('delivery_date') as string || null,
        status: 'pending'
      };

      const { error } = await supabase
        .from('orders')
        .insert([orderData]);

      if (error) throw error;

      toast.success("Ordem criada com sucesso!", {
        description: "A ordem de trabalho foi registrada no sistema.",
      });

      navigate('/orders');
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error("Erro ao criar ordem", {
        description: "Não foi possível criar a ordem. Tente novamente.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/orders")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Nova Ordem de Trabalho</h1>
              <p className="text-sm text-muted-foreground">
                Preencha os dados da ordem de trabalho
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <form onSubmit={handleSubmit}>
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Informações da Ordem</CardTitle>
              <CardDescription>
                Todos os campos marcados com * são obrigatórios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clinic_name">Nome da Clínica *</Label>
                  <Input
                    id="clinic_name"
                    name="clinic_name"
                    placeholder="Clínica Odontológica"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dentist_name">Nome do Dentista *</Label>
                  <Input
                    id="dentist_name"
                    name="dentist_name"
                    placeholder="Dr. João Silva"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="patient_name">Nome do Paciente *</Label>
                <Input
                  id="patient_name"
                  name="patient_name"
                  placeholder="Nome completo do paciente"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="work_name">Nome do Trabalho *</Label>
                <Input
                  id="work_name"
                  name="work_name"
                  placeholder="Ex: Coroa unitária, Ponte fixa"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="work_type">Tipo de Trabalho *</Label>
                  <select
                    id="work_type"
                    name="work_type"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  >
                    <option value="">Selecione o tipo</option>
                    <option value="coroa">Coroa</option>
                    <option value="ponte">Ponte</option>
                    <option value="protocolo">Protocolo</option>
                    <option value="alinhador">Alinhador</option>
                    <option value="protese_parcial">Prótese Parcial</option>
                    <option value="protese_total">Prótese Total</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="custom_color">Cor do Trabalho</Label>
                  <Input
                    id="custom_color"
                    name="custom_color"
                    placeholder="Ex: A1, A2, BL3, Personalizado"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="teeth_numbers">Números dos Dentes *</Label>
                  <Input
                    id="teeth_numbers"
                    name="teeth_numbers"
                    placeholder="Ex: 11, 12, 13"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delivery_date">Data de Entrega Prevista</Label>
                  <Input
                    id="delivery_date"
                    name="delivery_date"
                    type="date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observations">Observações</Label>
                <Textarea
                  id="observations"
                  name="observations"
                  placeholder="Adicione observações sobre o trabalho..."
                  rows={4}
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/orders")}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Criar Ordem
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </main>
    </div>
  );
};

export default NewOrder;
