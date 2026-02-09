import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Keyboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { serviceFormSchema } from "@/lib/validationSchemas";
import { ClientAutocomplete } from "@/components/ClientAutocomplete";
import { Switch } from "@/components/ui/switch";

const WORK_COLORS = [
  { value: "A1", label: "A1" }, { value: "A2", label: "A2" },
  { value: "A3", label: "A3" }, { value: "A3.5", label: "A3.5" },
  { value: "A4", label: "A4" }, { value: "B1", label: "B1" },
  { value: "B2", label: "B2" }, { value: "B3", label: "B3" },
  { value: "B4", label: "B4" }, { value: "C1", label: "C1" },
  { value: "C2", label: "C2" }, { value: "C3", label: "C3" },
  { value: "C4", label: "C4" }, { value: "D2", label: "D2" },
  { value: "D3", label: "D3" }, { value: "D4", label: "D4" },
  { value: "BL1", label: "BL1" }, { value: "BL2", label: "BL2" },
  { value: "BL3", label: "BL3" }, { value: "BL4", label: "BL4" },
];

interface ServiceFormProps {
  onServiceAdd: () => Promise<void>;
}

export const ServiceForm = ({ onServiceAdd }: ServiceFormProps) => {
  const [serviceName, setServiceName] = useState("");
  const [serviceValue, setServiceValue] = useState("");
  const [clientName, setClientName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [patientName, setPatientName] = useState("");
  const [dentistName, setDentistName] = useState("");
  const [workColor, setWorkColor] = useState("");
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
          dentist_name: dentistName?.trim() || null,
          color: workColor || null,
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
      setDentistName("");
      setWorkColor("");
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <Label htmlFor="service_name">Trabalho Realizado *</Label>
              <Input
                id="service_name"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="Ex: Coroa, Prótese, Faceta..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient_name">Nome do Paciente</Label>
              <Input
                id="patient_name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Nome do paciente"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dentist_name">Nome do Dentista</Label>
              <Input
                id="dentist_name"
                value={dentistName}
                onChange={(e) => setDentistName(e.target.value)}
                placeholder="Nome do dentista"
              />
            </div>

            <div className="space-y-2">
              <Label>Cor do Trabalho</Label>
              <Select value={workColor} onValueChange={setWorkColor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a cor" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_COLORS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      {color.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service_value">Valor do Serviço *</Label>
              <Input
                id="service_value"
                value={serviceValue}
                onChange={(e) => handleValueChange(e.target.value)}
                placeholder="R$ 0,00"
                required
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
