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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pencil, RotateCcw } from "lucide-react";

interface Order {
  id: string;
  clinic_name: string;
  dentist_name: string;
  patient_name: string;
  work_name: string | null;
  work_type: string;
  custom_color: string | null;
  amount: number | null;
  unit_price: number | null;
  quantity: number;
  status: string;
  teeth_numbers: string;
  observations: string | null;
  delivery_date: string | null;
}

interface EditOrderDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderUpdate: () => Promise<void>;
}

const WORK_TYPES = [
  { value: "coroa", label: "Coroa" },
  { value: "ponte", label: "Ponte" },
  { value: "protocolo", label: "Protocolo" },
  { value: "alinhador", label: "Alinhador" },
  { value: "protese_parcial", label: "Prótese Parcial" },
  { value: "protese_total", label: "Prótese Total" },
  { value: "outro", label: "Outro" },
];

export const EditOrderDialog = ({
  order,
  open,
  onOpenChange,
  onOrderUpdate,
}: EditOrderDialogProps) => {
  const [clinicName, setClinicName] = useState("");
  const [dentistName, setDentistName] = useState("");
  const [patientName, setPatientName] = useState("");
  const [workName, setWorkName] = useState("");
  const [workType, setWorkType] = useState("");
  const [customWorkType, setCustomWorkType] = useState("");
  const [customColor, setCustomColor] = useState("");
  const [teethNumbers, setTeethNumbers] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [totalAmount, setTotalAmount] = useState(0);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [observations, setObservations] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRedo, setIsRedo] = useState(false);

  useEffect(() => {
    if (order) {
      setClinicName(order.clinic_name);
      setDentistName(order.dentist_name);
      setPatientName(order.patient_name);
      setWorkName(order.work_name || "");
      
      const isKnownType = WORK_TYPES.some(t => t.value === order.work_type);
      if (isKnownType) {
        setWorkType(order.work_type);
        setCustomWorkType("");
      } else {
        setWorkType("outro");
        setCustomWorkType(order.work_type);
      }
      
      setCustomColor(order.custom_color || "");
      setTeethNumbers(order.teeth_numbers);
      setQuantity(order.quantity || 1);
      setUnitPrice(order.unit_price?.toString() || order.amount?.toString() || "");
      setDeliveryDate(order.delivery_date ? order.delivery_date.split("T")[0] : "");
      setObservations(order.observations || "");
      setStatus(order.status);
      setIsRedo(false);
    }
  }, [order]);

  useEffect(() => {
    const price = parseFloat(unitPrice) || 0;
    setTotalAmount(price * quantity);
  }, [unitPrice, quantity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    setLoading(true);

    try {
      const finalWorkType = workType === "outro" ? customWorkType : workType;
      
      if (!finalWorkType.trim()) {
        toast.error("Tipo de trabalho é obrigatório");
        return;
      }

      const price = parseFloat(unitPrice) || null;

      const { error } = await supabase
        .from("orders")
        .update({
          clinic_name: clinicName.trim(),
          dentist_name: dentistName.trim(),
          patient_name: patientName.trim(),
          work_name: workName.trim() || null,
          work_type: finalWorkType.trim(),
          custom_color: customColor.trim() || null,
          teeth_numbers: teethNumbers.trim(),
          unit_price: price,
          quantity: quantity,
          amount: price ? price * quantity : null,
          delivery_date: deliveryDate || null,
          observations: observations.trim() || null,
          status: status,
        })
        .eq("id", order.id);

      if (error) throw error;

      toast.success("Ordem atualizada com sucesso!");
      onOpenChange(false);
      await onOrderUpdate();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar ordem");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Editar Ordem de Trabalho
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit_clinic">Clínica *</Label>
              <Input
                id="edit_clinic"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_dentist">Dentista *</Label>
              <Input
                id="edit_dentist"
                value={dentistName}
                onChange={(e) => setDentistName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_patient">Paciente *</Label>
            <Input
              id="edit_patient"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_work_name">Nome do Trabalho</Label>
            <Input
              id="edit_work_name"
              value={workName}
              onChange={(e) => setWorkName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Trabalho *</Label>
              <Select value={workType} onValueChange={setWorkType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_color">Cor</Label>
              <Input
                id="edit_color"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
              />
            </div>
          </div>

          {workType === "outro" && (
            <div className="space-y-2">
              <Label htmlFor="edit_custom_work">Tipo Personalizado *</Label>
              <Input
                id="edit_custom_work"
                value={customWorkType}
                onChange={(e) => setCustomWorkType(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit_teeth">Dentes *</Label>
            <Input
              id="edit_teeth"
              value={teethNumbers}
              onChange={(e) => setTeethNumbers(e.target.value)}
              required
            />
          </div>

          {/* Seção de Quantidade e Valor com destaque */}
          <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              🔢 Quantidade de Trabalhos e Valor
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_unit_price">Valor Unitário (R$)</Label>
                <Input
                  id="edit_unit_price"
                  type="number"
                  step="0.01"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_quantity">Quantidade de Trabalhos</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    -
                  </Button>
                  <Input
                    id="edit_quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="text-center font-bold text-lg"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valor Total</Label>
                <div className="flex h-10 w-full items-center justify-center rounded-md border-2 border-primary/30 bg-primary/10 px-3 text-lg font-bold text-primary">
                  R$ {totalAmount.toFixed(2)}
                </div>
              </div>
            </div>

            {quantity > 1 && unitPrice && (
              <p className="text-xs text-muted-foreground text-center">
                {quantity}x R$ {(parseFloat(unitPrice) || 0).toFixed(2)} = <span className="font-semibold text-primary">R$ {totalAmount.toFixed(2)}</span>
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit_delivery">Data de Entrega</Label>
              <Input
                id="edit_delivery"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="in_production">Em Produção</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="delivered">Entregue</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_obs">Observações</Label>
            <Textarea
              id="edit_obs"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={3}
            />
          </div>

          {/* Botão Refazer/Correção */}
          <div className="rounded-lg border-2 border-orange-300 bg-orange-50 dark:bg-orange-950/20 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Refazer / Correção
            </h3>
            <p className="text-xs text-muted-foreground">
              Marque esta opção se o trabalho precisa ser refeito ou corrigido. O valor será zerado (R$ 0,00) e ficará registrado no histórico.
            </p>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant={isRedo ? "default" : "outline"}
                className={isRedo ? "bg-orange-600 hover:bg-orange-700" : "border-orange-400 text-orange-700 hover:bg-orange-100"}
                onClick={() => {
                  setIsRedo(!isRedo);
                  if (!isRedo) {
                    setUnitPrice("0");
                    setQuantity(1);
                    const redoNote = `[REFAZER/CORREÇÃO - ${new Date().toLocaleDateString("pt-BR")}] `;
                    if (!observations.includes("[REFAZER/CORREÇÃO")) {
                      setObservations(redoNote + observations);
                    }
                    setStatus("pending");
                  }
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {isRedo ? "Marcado como Refazer" : "Marcar como Refazer"}
              </Button>
            </div>
            {isRedo && (
              <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
                ⚠️ O valor será salvo como R$ 0,00 e o status voltará para Pendente.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
