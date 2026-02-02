import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Service } from "@/pages/Billing";
import { ClientAutocomplete } from "@/components/ClientAutocomplete";

interface EditServiceDialogProps {
  service: Service | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onServiceUpdate: () => Promise<void>;
}

export const EditServiceDialog = ({
  service,
  open,
  onOpenChange,
  onServiceUpdate,
}: EditServiceDialogProps) => {
  const [serviceName, setServiceName] = useState("");
  const [serviceValue, setServiceValue] = useState("");
  const [clientName, setClientName] = useState("");
  const [patientName, setPatientName] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (service) {
      setServiceName(service.service_name);
      setServiceValue(formatCurrency(service.service_value.toString()));
      setClientName(service.client_name || "");
      setPatientName(service.patient_name || "");
      setServiceDate(service.service_date);
    }
  }, [service]);

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    const amount = parseFloat(numbers) / 100;
    if (isNaN(amount)) return "R$ 0,00";
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
    if (!service) return;

    setLoading(true);

    try {
      const numericValue = parseFloat(
        serviceValue.replace("R$", "").replace(/\./g, "").replace(",", ".")
      );

      if (isNaN(numericValue) || numericValue <= 0) {
        toast.error("Valor inválido");
        return;
      }

      const { error } = await supabase
        .from("services")
        .update({
          service_name: serviceName.trim(),
          service_value: numericValue,
          client_name: clientName?.trim() || null,
          patient_name: patientName?.trim() || null,
          service_date: serviceDate,
        })
        .eq("id", service.id);

      if (error) throw error;

      toast.success("Serviço atualizado com sucesso!");
      onOpenChange(false);
      await onServiceUpdate();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar serviço");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Serviço</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit_service_name">Serviço Prestado</Label>
            <Input
              id="edit_service_name"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="Descrição do serviço"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_service_value">Valor do Serviço</Label>
            <Input
              id="edit_service_value"
              value={serviceValue}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder="R$ 0,00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_client_name">Nome da Clínica (Cliente)</Label>
            <ClientAutocomplete
              id="edit_client_name"
              value={clientName}
              onChange={setClientName}
              placeholder="Nome da clínica"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_patient_name">Nome do Paciente (Opcional)</Label>
            <Input
              id="edit_patient_name"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Nome do paciente"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_service_date">Data do Serviço</Label>
            <Input
              id="edit_service_date"
              type="date"
              value={serviceDate}
              onChange={(e) => setServiceDate(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
