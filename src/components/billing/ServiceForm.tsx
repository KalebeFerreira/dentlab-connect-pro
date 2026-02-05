import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Keyboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { serviceFormSchema } from "@/lib/validationSchemas";
import { ClientAutocomplete } from "@/components/ClientAutocomplete";
import { Switch } from "@/components/ui/switch";

interface ServiceFormProps {
  onServiceAdd: () => Promise<void>;
}

export const ServiceForm = ({ onServiceAdd }: ServiceFormProps) => {
  const [serviceName, setServiceName] = useState("");
  const [serviceValue, setServiceValue] = useState("");
  const [clientName, setClientName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [patientName, setPatientName] = useState("");
  const [loading, setLoading] = useState(false);
  const [useManualInput, setUseManualInput] = useState(false);

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    const amount = parseFloat(numbers) / 100;
    return amount.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const handleValueChange = (value: string) => {
    const formatted = formatCurrency(value);
    setServiceValue(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const numericValue = parseFloat(
        serviceValue.replace("R$", "").replace(/\./g, "").replace(",", ".")
      );

      // Combine clinic name with client name if both are provided
      const finalClientName = useManualInput 
        ? (clinicName && clientName ? `${clinicName} - ${clientName}` : clinicName || clientName || null)
        : (clientName || null);

      // Validate input
      const validationResult = serviceFormSchema.safeParse({
        service_name: serviceName,
        service_value: numericValue,
        client_name: finalClientName,
        patient_name: patientName || null,
      });

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => err.message).join(", ");
        toast.error("Erro de validação", { description: errors });
        return;
      }

      const { error } = await supabase.from("services").insert([
        {
          user_id: user.id,
          service_name: serviceName.trim(),
          service_value: numericValue,
          client_name: finalClientName?.trim() || null,
          patient_name: patientName?.trim() || null,
          service_date: new Date().toISOString().split("T")[0],
          status: "active",
        },
      ]);

      if (error) throw error;

      toast.success("Serviço adicionado com sucesso!");
      setServiceName("");
      setServiceValue("");
      setClientName("");
      setClinicName("");
      setPatientName("");
      await onServiceAdd();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao adicionar serviço");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Adicionar Serviço</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="manual-input" className="text-sm text-muted-foreground">
              Digitação manual
            </Label>
            <Switch
              id="manual-input"
              checked={useManualInput}
              onCheckedChange={setUseManualInput}
            />
            <Keyboard className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service_name">Serviço Prestado</Label>
              <Input
                id="service_name"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="Descrição do serviço"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service_value">Valor do Serviço</Label>
              <Input
                id="service_value"
                value={serviceValue}
                onChange={(e) => handleValueChange(e.target.value)}
                placeholder="R$ 0,00"
                required
              />
            </div>

            {useManualInput ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="clinic_name">Nome da Clínica</Label>
                  <Input
                    id="clinic_name"
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="Digite o nome da clínica"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client_name_manual">Nome do Cliente</Label>
                  <Input
                    id="client_name_manual"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Digite o nome do cliente"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="client_name">Nome da Clínica (Cliente)</Label>
                <ClientAutocomplete
                  id="client_name"
                  value={clientName}
                  onChange={setClientName}
                  placeholder="Nome da clínica"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="patient_name">Nome do Paciente (Opcional)</Label>
              <Input
                id="patient_name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Nome do paciente"
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Serviço
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
