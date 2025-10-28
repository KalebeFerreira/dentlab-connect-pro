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
        toast.error("Você precisa estar logado");
        navigate("/auth");
        return;
      }

      const formData = new FormData(e.currentTarget);
      
      const { error } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          clinic_name: formData.get("clinicName") as string,
          dentist_name: formData.get("dentistName") as string,
          patient_name: formData.get("patientName") as string,
          work_type: formData.get("workType") as string,
          color: formData.get("color") as string,
          teeth_numbers: formData.get("teethNumbers") as string,
          observations: formData.get("observations") as string || null,
          status: "pending",
        });

      if (error) throw error;

      toast.success("Ordem criada!", {
        description: "Sua ordem de trabalho foi criada com sucesso.",
      });
      navigate("/orders");
    } catch (error: any) {
      console.error("Error creating order:", error);
      toast.error("Erro ao criar ordem", {
        description: error.message,
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
              {/* Clinic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clinic-name">Nome da Clínica *</Label>
                  <Input
                    id="clinic-name"
                    name="clinicName"
                    placeholder="Clínica Odontológica"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dentist-name">Nome do Dentista *</Label>
                  <Input
                    id="dentist-name"
                    name="dentistName"
                    placeholder="Dr. João Silva"
                    required
                  />
                </div>
              </div>

              {/* Patient Info */}
              <div className="space-y-2">
                <Label htmlFor="patient-name">Nome do Paciente *</Label>
                <Input
                  id="patient-name"
                  name="patientName"
                  placeholder="Nome completo do paciente"
                  required
                />
              </div>

              {/* Work Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="work-type">Tipo de Trabalho *</Label>
                  <Select name="workType" required>
                    <SelectTrigger id="work-type">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coroa">Coroa</SelectItem>
                      <SelectItem value="ponte">Ponte</SelectItem>
                      <SelectItem value="protocolo">Protocolo</SelectItem>
                      <SelectItem value="alinhador">Alinhador</SelectItem>
                      <SelectItem value="implante">Implante</SelectItem>
                      <SelectItem value="protese-parcial">Prótese Parcial</SelectItem>
                      <SelectItem value="protese-total">Prótese Total</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Cor do Trabalho *</Label>
                  <Select name="color" required>
                    <SelectTrigger id="color">
                      <SelectValue placeholder="Selecione a cor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A1">A1</SelectItem>
                      <SelectItem value="A2">A2</SelectItem>
                      <SelectItem value="A3">A3</SelectItem>
                      <SelectItem value="B1">B1</SelectItem>
                      <SelectItem value="B2">B2</SelectItem>
                      <SelectItem value="C1">C1</SelectItem>
                      <SelectItem value="C2">C2</SelectItem>
                      <SelectItem value="D2">D2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="teeth-numbers">Números dos Dentes *</Label>
                <Input
                  id="teeth-numbers"
                  name="teethNumbers"
                  placeholder="Ex: 11, 12, 13"
                  required
                />
              </div>

              {/* Observations */}
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
