import { useState, useMemo } from "react";
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

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const parseCurrencyInput = (value: string) => {
  const numbers = value.replace(/\D/g, "");
  if (!numbers) return { numeric: 0, formatted: "" };
  const numeric = parseFloat(numbers) / 100;
  return { numeric, formatted: formatBRL(numeric) };
};

export const ServiceForm = ({ onServiceAdd }: ServiceFormProps) => {
  const [serviceName, setServiceName] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitValue, setUnitValue] = useState("");
  const [unitNumeric, setUnitNumeric] = useState<number>(0);
  const [clientName, setClientName] = useState("");
  const [patientName, setPatientName] = useState("");
  const [dentistName, setDentistName] = useState("");
  const [workColor, setWorkColor] = useState("");
  const [loading, setLoading] = useState(false);
  const [useManualInput, setUseManualInput] = useState(false);

  const quantityNumber = Number.parseInt(quantity, 10) || 0;
  const totalValue = useMemo(
    () => (quantityNumber > 0 ? unitNumeric * quantityNumber : 0),
    [unitNumeric, quantityNumber]
  );

  const handleUnitValueChange = (value: string) => {
    const { numeric, formatted } = parseCurrencyInput(value);
    setUnitValue(formatted);
    setUnitNumeric(numeric);
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

      const qty = quantityNumber > 0 ? quantityNumber : 1;
      const numericTotal = unitNumeric * qty;
      const finalClientName = clientName?.trim() || null;

      const validationResult = serviceFormSchema.safeParse({
        service_name: serviceName,
        service_value: numericTotal,
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
          service_value: numericTotal,
          unit_value: unitNumeric,
          quantity: qty,
          order_number: orderNumber.trim() || null,
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
      setOrderNumber("");
      setQuantity("");
      setUnitValue("");
      setUnitNumeric(0);
      setClientName("");
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
              <div className="space-y-2">
                <Label htmlFor="clinic_name">Nome da Clínica (Cliente principal)</Label>
                <Input
                  id="clinic_name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Digite o nome da clínica"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="client_name">Nome da Clínica (Cliente principal)</Label>
                <ClientAutocomplete
                  id="client_name"
                  value={clientName}
                  onChange={setClientName}
                  placeholder="Nome da clínica"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="order_number">Nº da Ordem de Serviço</Label>
              <Input
                id="order_number"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="Ex: OS-001"
              />
            </div>

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
              <Label htmlFor="dentist_name">Nome do Dentista (apenas informativo)</Label>
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
              <Label htmlFor="quantity">Quantidade de Trabalhos *</Label>
              <Input
                id="quantity"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))}
                placeholder="Digite a quantidade"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_value">Valor Unitário *</Label>
              <Input
                id="unit_value"
                value={unitValue}
                onChange={(e) => handleUnitValueChange(e.target.value)}
                placeholder="R$ 0,00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_value">Valor Total</Label>
              <Input
                id="total_value"
                value={formatBRL(totalValue)}
                readOnly
                className="bg-muted font-semibold"
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
