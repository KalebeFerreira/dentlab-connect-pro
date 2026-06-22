import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export interface ManualBill {
  id: string;
  description: string;
  amount: number;
  due_date: string | null;
  paid_at: string | null;
  transaction_type: "receipt" | "expense";
  payment_method: string | null;
  payment_status: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bill?: ManualBill | null;
  onSaved: () => void;
}

const stripTag = (s: string) =>
  s.replace(/\s*\[(MANUAL-REC|MANUAL-DESP):[^\]]+\]/g, "").trim();

export const AddBillDueDialog = ({ open, onOpenChange, bill, onSaved }: Props) => {
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState("");
  const [payer, setPayer] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState<"a_vista" | "a_prazo">("a_prazo");
  const [type, setType] = useState<"receipt" | "expense">("receipt");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      if (bill) {
        const parts = stripTag(bill.description).split(" — ");
        setDescription(parts[0] || "");
        setPayer(parts[1] || "");
        setNotes(parts[2] || "");
        setAmount(String(bill.amount));
        setDueDate(bill.due_date || "");
        setCategory((bill.payment_method as any) === "a_vista" ? "a_vista" : "a_prazo");
        setType(bill.transaction_type);
      } else {
        setDescription("");
        setPayer("");
        setAmount("");
        setDueDate(new Date().toISOString().split("T")[0]);
        setCategory("a_prazo");
        setType("receipt");
        setNotes("");
      }
    }
  }, [open, bill]);

  const save = async () => {
    if (!description.trim() || !amount || !dueDate) {
      toast.error("Preencha descrição, valor e data de vencimento.");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada.");
      const value = Number(amount.replace(",", "."));
      if (!(value > 0)) throw new Error("Valor inválido.");

      const tag = type === "receipt" ? "MANUAL-REC" : "MANUAL-DESP";
      const fullDesc = [description.trim(), payer.trim(), notes.trim()].filter(Boolean).join(" — ");
      const today = new Date().toISOString().split("T")[0];
      const month = Number(dueDate.split("-")[1]);
      const year = Number(dueDate.split("-")[0]);

      if (bill) {
        const { error } = await supabase
          .from("financial_transactions")
          .update({
            description: `${fullDesc} [${tag}:${bill.id}]`,
            amount: value,
            due_date: dueDate,
            payment_method: category,
            transaction_type: type,
            month,
            year,
            payment_status: bill.paid_at ? "pago" : dueDate < today ? "vencido" : "pendente",
          })
          .eq("id", bill.id);
        if (error) throw error;
        toast.success("Conta atualizada.");
      } else {
        // Pre-insert to get id, then patch description with id tag
        const { data: ins, error: insErr } = await supabase
          .from("financial_transactions")
          .insert({
            user_id: user.id,
            description: fullDesc,
            amount: value,
            due_date: dueDate,
            paid_at: null,
            payment_method: category,
            payment_status: dueDate < today ? "vencido" : "pendente",
            transaction_type: type,
            status: "pending",
            month,
            year,
            category: type === "receipt" ? "Conta a Receber" : "Conta a Pagar",
          })
          .select("id")
          .single();
        if (insErr) throw insErr;
        await supabase
          .from("financial_transactions")
          .update({ description: `${fullDesc} [${tag}:${ins.id}]` })
          .eq("id", ins.id);
        toast.success("Conta cadastrada.");
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{bill ? "Editar conta" : "Nova conta a vencer"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Descrição *</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Aluguel, Mensalidade João..." />
          </div>
          <div>
            <Label>Cliente / Pagador</Label>
            <Input value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Vencimento *</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Tipo</Label>
            <RadioGroup value={type} onValueChange={(v) => setType(v as any)} className="flex gap-4 mt-1">
              <div className="flex items-center gap-2"><RadioGroupItem value="receipt" id="t-rec" /><Label htmlFor="t-rec" className="font-normal">A receber</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="expense" id="t-exp" /><Label htmlFor="t-exp" className="font-normal">A pagar</Label></div>
            </RadioGroup>
          </div>
          <div>
            <Label>Categoria</Label>
            <RadioGroup value={category} onValueChange={(v) => setCategory(v as any)} className="flex gap-4 mt-1">
              <div className="flex items-center gap-2"><RadioGroupItem value="a_vista" id="c-av" /><Label htmlFor="c-av" className="font-normal">À Vista</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="a_prazo" id="c-pr" /><Label htmlFor="c-pr" className="font-normal">Mensalista / Parcelado</Label></div>
            </RadioGroup>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {bill ? "Salvar" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddBillDueDialog;
