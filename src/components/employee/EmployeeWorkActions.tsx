import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface WorkRecord {
  id: string;
  work_type: string;
  patient_name: string | null;
  value: number | null;
  status: string;
  start_date: string;
  end_date: string | null;
  deadline: string | null;
  color: string | null;
  notes: string | null;
}

const WORK_COLORS = [
  "A1","A2","A3","A3.5","A4","B1","B2","B3","B4",
  "C1","C2","C3","C4","D2","D3","D4","BL1","BL2","BL3","BL4",
];

interface Props {
  record: WorkRecord;
  onUpdated: () => void;
}

export const EmployeeWorkActions = ({ record, onUpdated }: Props) => {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const canManageRecord = record.status !== "finished";

  const [workType, setWorkType] = useState(record.work_type);
  const [patientName, setPatientName] = useState(record.patient_name || "");
  const [color, setColor] = useState(record.color || "");
  const [status, setStatus] = useState(record.status);
  const [startDate, setStartDate] = useState(record.start_date.split("T")[0]);
  const [endDate, setEndDate] = useState(record.end_date?.split("T")[0] || "");
  const [value, setValue] = useState(
    record.value !== null && record.value !== undefined
      ? record.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : ""
  );

  const handleEdit = async () => {
    if (!canManageRecord) {
      toast.error("Só é possível alterar trabalhos pendentes ou em andamento.");
      return;
    }

    setLoading(true);
    try {
      const numericValue = parseFloat(
        value.replace("R$", "").replace(/\./g, "").replace(",", ".").trim()
      );

      const { data, error } = await supabase.functions.invoke("manage-employee-work-record", {
        body: {
          action: "update",
          recordId: record.id,
          updates: {
            work_type: workType.trim(),
            patient_name: patientName.trim() || null,
            color: color || null,
            status,
            start_date: startDate,
            end_date: endDate || null,
            value: isNaN(numericValue) ? null : numericValue,
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Trabalho atualizado!");
      setEditOpen(false);
      onUpdated();
    } catch (err: any) {
      toast.error("Erro ao atualizar", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!canManageRecord) {
      toast.error("Só é possível excluir trabalhos pendentes ou em andamento.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-employee-work-record", {
        body: {
          action: "delete",
          recordId: record.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Trabalho excluído!");
      setDeleteOpen(false);
      onUpdated();
    } catch (err: any) {
      toast.error("Erro ao excluir", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: string) => {
    const numbers = val.replace(/\D/g, "");
    const amount = parseFloat(numbers) / 100;
    return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  return (
    <>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setEditOpen(true)}
          disabled={!canManageRecord}
          title={canManageRecord ? "Editar trabalho" : "Somente pendentes ou em andamento podem ser alterados"}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={() => setDeleteOpen(true)}
          disabled={!canManageRecord}
          title={canManageRecord ? "Excluir trabalho" : "Somente pendentes ou em andamento podem ser excluídos"}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Trabalho</DialogTitle>
            <DialogDescription>Altere os dados do trabalho registrado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Tipo de Trabalho</Label>
              <Input value={workType} onChange={(e) => setWorkType(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Paciente</Label>
              <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Cor</Label>
                <Select value={color} onValueChange={setColor}>
                  <SelectTrigger><SelectValue placeholder="Cor" /></SelectTrigger>
                  <SelectContent>
                    {WORK_COLORS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="in_progress">Em andamento</SelectItem>
                    <SelectItem value="finished">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Valor (Comissão)</Label>
              <Input value={value} onChange={(e) => setValue(formatCurrency(e.target.value))} placeholder="R$ 0,00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Entrada</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Finalização</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir trabalho?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O trabalho "{record.work_type}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={loading}>
              {loading ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
