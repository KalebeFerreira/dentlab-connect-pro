import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface EmployeeServiceFormProps {
  ownerUserId: string;
  employeeName: string;
  employeeId: string;
  onServiceAdded?: () => void;
}

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

export const EmployeeServiceForm = ({ ownerUserId, employeeName, employeeId, onServiceAdded }: EmployeeServiceFormProps) => {
  const [serviceName, setServiceName] = useState("");
  const [serviceValue, setServiceValue] = useState("");
  const [clientName, setClientName] = useState("");
  const [patientName, setPatientName] = useState("");
  const [dentistName, setDentistName] = useState("");
  const [workColor, setWorkColor] = useState("");
  const [workType, setWorkType] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    const amount = parseFloat(numbers) / 100;
    return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const handleValueChange = (value: string) => {
    setServiceValue(formatCurrency(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const numericValue = parseFloat(
        serviceValue.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()
      );

      if (!serviceName.trim() || isNaN(numericValue) || numericValue <= 0) {
        toast.error("Preencha o serviço e o valor corretamente");
        setLoading(false);
        return;
      }

      console.log("[EmployeeServiceForm] Inserting work_record:", {
        user_id: ownerUserId,
        employee_id: employeeId,
        work_type: workType.trim() || serviceName.trim(),
        start_date: startDate,
        end_date: endDate || null,
        value: numericValue,
      });

      // 1. Insert into work_records FIRST (production tracking - syncs with lab dashboard)
      const { data: workData, error: workError } = await supabase.from("work_records").insert([{
        user_id: ownerUserId,
        employee_id: employeeId,
        work_type: workType.trim() || serviceName.trim(),
        start_date: startDate,
        end_date: endDate || null,
        status: endDate ? "finished" : "in_progress",
        value: numericValue,
        patient_name: patientName.trim() || null,
        color: workColor || null,
        notes: `Dentista: ${dentistName || "-"} | Cliente: ${clientName || "-"} | Registrado por ${employeeName}`,
      }]).select();

      console.log("[EmployeeServiceForm] work_records result:", { workData, workError });

      if (workError) {
        console.error("[EmployeeServiceForm] work_records insert failed:", workError);
        throw workError;
      }

      toast.success("Trabalho registrado com sucesso!", {
        description: `Registrado por ${employeeName}. Dados sincronizados com o laboratório.`,
      });

      // Reset form
      setServiceName("");
      setServiceValue("");
      setClientName("");
      setPatientName("");
      setDentistName("");
      setWorkColor("");
      setWorkType("");
      setStartDate(format(new Date(), "yyyy-MM-dd"));
      setEndDate("");
      onServiceAdded?.();
    } catch (error: any) {
      console.error("[EmployeeServiceForm] Error:", error);
      toast.error("Erro ao adicionar serviço", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Adicionar Serviço</CardTitle>
        <p className="text-sm text-muted-foreground">
          O serviço será registrado automaticamente na produção do laboratório.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emp_work_type">Nome do Trabalho *</Label>
              <Input
                id="emp_work_type"
                value={workType}
                onChange={(e) => setWorkType(e.target.value)}
                placeholder="Ex: Coroa, Prótese, Faceta..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp_service_name">Serviço Prestado *</Label>
              <Input
                id="emp_service_name"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="Descrição do serviço"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp_service_value">Valor (Comissão) *</Label>
              <Input
                id="emp_service_value"
                value={serviceValue}
                onChange={(e) => handleValueChange(e.target.value)}
                placeholder="R$ 0,00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp_dentist_name">Nome do Dentista</Label>
              <Input
                id="emp_dentist_name"
                value={dentistName}
                onChange={(e) => setDentistName(e.target.value)}
                placeholder="Nome do dentista"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp_client_name">Cliente</Label>
              <Input
                id="emp_client_name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nome do cliente/clínica"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp_patient_name">Paciente</Label>
              <Input
                id="emp_patient_name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Nome do paciente"
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
              <Label htmlFor="emp_start_date">Data de Entrada *</Label>
              <Input
                id="emp_start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp_end_date">Data de Finalização</Label>
              <Input
                id="emp_end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Deixe vazio se ainda em andamento
              </p>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            {loading ? "Adicionando..." : "Adicionar Serviço"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
