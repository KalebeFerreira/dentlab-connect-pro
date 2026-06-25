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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [paymentMethod, setPaymentMethod] = useState<"a_vista" | "a_prazo">("a_vista");
  const [dueDate, setDueDate] = useState("");
  const [paidAt, setPaidAt] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (service) {
      setServiceName(service.service_name);
      setServiceValue(service.service_value.toString().replace(".", ","));
      setClientName(service.client_name || "");
      setPatientName(service.patient_name || "");
      setServiceDate(service.service_date);
      setPaymentMethod((service.payment_method as "a_vista" | "a_prazo") || "a_vista");
      setDueDate(service.due_date || service.service_date);
      setPaidAt(service.paid_at || "");
    }
  }, [service]);

  const parseLooseNumber = (value: string): number => {
    if (!value) return 0;
    let v = value.replace(/[^\d.,-]/g, "").trim();
    if (!v) return 0;
    const lastComma = v.lastIndexOf(",");
    const lastDot = v.lastIndexOf(".");
    if (lastComma > -1 && lastComma > lastDot) {
      v = v.replace(/\./g, "").replace(",", ".");
    } else {
      v = v.replace(/,/g, "");
    }
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service) return;

    setLoading(true);

    try {
      const numericValue = parseLooseNumber(serviceValue);

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
          payment_method: paymentMethod,
          due_date: paymentMethod === "a_prazo" ? (dueDate || serviceDate) : serviceDate,
          paid_at: paidAt || null,
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 pointer-events-auto">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Editar Serviço</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">
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
                type="text"
                inputMode="decimal"
                value={serviceValue}
                onChange={(e) => setServiceValue(e.target.value)}
                placeholder="Ex: 150 ou 150,50"
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

            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "a_vista" | "a_prazo")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_vista">À vista</SelectItem>
                  <SelectItem value="a_prazo">A prazo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === "a_prazo" && (
              <div className="space-y-2">
                <Label htmlFor="edit_due_date">Data de Vencimento</Label>
                <Input
                  id="edit_due_date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit_paid_at">Data do Pagamento (vazio = não pago)</Label>
              <div className="flex gap-2">
                <Input
                  id="edit_paid_at"
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={() => setPaidAt(new Date().toISOString().split("T")[0])}>
                  Hoje
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 px-6 py-4 border-t bg-background shrink-0">
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
