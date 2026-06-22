import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Clock, AlertCircle, CheckCircle2, TrendingUp, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AddBillDueDialog, type ManualBill } from "./AddBillDueDialog";

interface ApptRow {
  id: string;
  appointment_date: string;
  procedure_type: string | null;
  treatment_value: number;
  payment_method: string | null;
  paid_at: string | null;
  due_date: string | null;
  status: string;
  patient: { name: string } | null;
}

const fmt = (v: number) => `R$ ${v.toFixed(2)}`;
const stripTag = (s: string) => s.replace(/\s*\[(MANUAL-REC|MANUAL-DESP):[^\]]+\]/g, "").trim();

export const AppointmentsFinancialTab = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ApptRow[]>([]);
  const [bills, setBills] = useState<ManualBill[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<ManualBill | null>(null);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("appts-financial-tab")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "financial_transactions" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [apptRes, billRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, appointment_date, procedure_type, treatment_value, payment_method, paid_at, due_date, status, patient:patients(name)")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .gt("treatment_value", 0)
          .order("appointment_date", { ascending: false }),
        supabase
          .from("financial_transactions")
          .select("id, description, amount, due_date, paid_at, transaction_type, payment_method, payment_status")
          .eq("user_id", user.id)
          .or("description.ilike.%[MANUAL-REC:%,description.ilike.%[MANUAL-DESP:%")
          .order("due_date", { ascending: true }),
      ]);

      if (apptRes.error) throw apptRes.error;
      if (billRes.error) throw billRes.error;

      setRows((apptRes.data as any) || []);
      setBills((billRes.data as any) || []);
    } catch (e: any) {
      toast.error(e.message || "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  };

  const markApptPaid = async (id: string) => {
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("appointments").update({ paid_at: today }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pagamento registrado.");
    load();
  };

  const togglePaid = async (bill: ManualBill, paid: boolean) => {
    const today = new Date().toISOString().split("T")[0];
    const patch = paid
      ? { paid_at: today, payment_status: "pago", status: "completed" }
      : {
          paid_at: null,
          payment_status: bill.due_date && bill.due_date < today ? "vencido" : "pendente",
          status: "pending",
        };
    const { error } = await supabase.from("financial_transactions").update(patch).eq("id", bill.id);
    if (error) return toast.error(error.message);
    toast.success(paid ? "Marcado como pago." : "Marcado como não pago.");
    load();
  };

  const removeBill = async (id: string) => {
    if (!confirm("Excluir esta conta?")) return;
    const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Conta excluída.");
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const monthStart = startOfMonth(new Date()).toISOString().split("T")[0];
  const monthEnd = endOfMonth(new Date()).toISOString().split("T")[0];

  // Appointments slices
  const aVencer = rows.filter((r) => !r.paid_at && r.due_date && r.due_date >= today);
  const vencidas = rows.filter((r) => !r.paid_at && r.due_date && r.due_date < today);
  const pagasMes = rows.filter((r) => r.paid_at && r.paid_at >= monthStart && r.paid_at <= monthEnd);
  const previstoMes = rows.filter((r) => {
    const d = (r.appointment_date || "").split("T")[0];
    return d >= monthStart && d <= monthEnd;
  });

  // Manual bills slices (combine with appointments in cards)
  const billsAVencer = bills.filter((b) => !b.paid_at && b.due_date && b.due_date >= today);
  const billsVencidas = bills.filter((b) => !b.paid_at && b.due_date && b.due_date < today);
  const billsPagasMes = bills.filter((b) => b.paid_at && b.paid_at >= monthStart && b.paid_at <= monthEnd);

  const sumA = (arr: ApptRow[]) => arr.reduce((s, r) => s + Number(r.treatment_value || 0), 0);
  const sumB = (arr: ManualBill[]) => arr.reduce((s, b) => s + Number(b.amount || 0) * (b.transaction_type === "expense" ? -1 : 1), 0);

  const cards = [
    {
      key: "vencer",
      title: "A vencer",
      icon: Clock,
      color: "text-blue-600",
      border: "border-blue-200",
      total: sumA(aVencer) + sumB(billsAVencer),
      count: aVencer.length + billsAVencer.length,
    },
    {
      key: "vencidas",
      title: "Vencidas",
      icon: AlertCircle,
      color: "text-red-600",
      border: "border-red-200",
      total: sumA(vencidas) + sumB(billsVencidas),
      count: vencidas.length + billsVencidas.length,
    },
    {
      key: "pagas",
      title: "Pagas (mês)",
      icon: CheckCircle2,
      color: "text-green-600",
      border: "border-green-200",
      total: sumA(pagasMes) + sumB(billsPagasMes),
      count: pagasMes.length + billsPagasMes.length,
    },
    {
      key: "previsto",
      title: "Total previsto (mês)",
      icon: TrendingUp,
      color: "text-primary",
      border: "border-primary/30",
      total: sumA(previstoMes),
      count: previstoMes.length,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditingBill(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nova conta a vencer
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.key} className={`shadow-card ${c.border}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">{c.title}</CardTitle>
                <Icon className={`h-4 w-4 ${c.color}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-xl md:text-2xl font-bold ${c.color}`}>{fmt(c.total)}</div>
                <p className="text-xs text-muted-foreground">{c.count} item(s)</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Manual bills */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Contas cadastradas manualmente</CardTitle>
        </CardHeader>
        <CardContent>
          {bills.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma conta cadastrada. Use o botão "Nova conta a vencer" acima.
            </p>
          ) : (
            <div className="space-y-2">
              {bills.map((b) => {
                const overdue = !b.paid_at && b.due_date && b.due_date < today;
                return (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm flex items-center gap-2">
                        {stripTag(b.description) || "Conta"}
                        <Badge variant="outline" className={b.transaction_type === "receipt" ? "text-green-700 border-green-300" : "text-red-700 border-red-300"}>
                          {b.transaction_type === "receipt" ? "Receber" : "Pagar"}
                        </Badge>
                        {b.payment_method === "a_vista" ? (
                          <Badge variant="secondary">À Vista</Badge>
                        ) : (
                          <Badge variant="secondary">Mensalista</Badge>
                        )}
                        {overdue && <Badge variant="destructive">Vencida</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Venc.: {b.due_date ? format(parseISO(b.due_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                        {b.paid_at && ` · Paga em ${format(parseISO(b.paid_at), "dd/MM/yyyy", { locale: ptBR })}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className={`font-bold text-sm ${b.transaction_type === "expense" ? "text-red-600" : "text-green-600"}`}>{fmt(Number(b.amount))}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Switch checked={!!b.paid_at} onCheckedChange={(v) => togglePaid(b, v)} />
                        <span className="text-xs text-muted-foreground w-12">{b.paid_at ? "Pago" : "Não pago"}</span>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => { setEditingBill(b); setDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removeBill(b.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Appointments accordion */}
      <Accordion type="multiple" className="space-y-2">
        {[
          { key: "vencer", title: "Agendamentos a vencer", items: aVencer },
          { key: "vencidas", title: "Agendamentos vencidos", items: vencidas },
          { key: "pagas", title: "Agendamentos pagos (mês)", items: pagasMes },
        ].map((c) => (
          <AccordionItem key={c.key} value={c.key} className="border rounded-md px-3">
            <AccordionTrigger className="text-sm hover:no-underline">
              {c.title} <Badge variant="secondary" className="ml-2">{c.items.length}</Badge>
            </AccordionTrigger>
            <AccordionContent>
              {c.items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum item.</p>
              ) : (
                <div className="space-y-2">
                  {c.items.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 border-b last:border-0">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm">{r.patient?.name || "Paciente"}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.procedure_type || "Procedimento"} ·{" "}
                          {r.appointment_date ? format(parseISO(r.appointment_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                          {r.due_date ? ` · venc. ${format(parseISO(r.due_date), "dd/MM/yyyy", { locale: ptBR })}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-sm">{fmt(Number(r.treatment_value))}</div>
                        {!r.paid_at ? (
                          <Button size="sm" variant="outline" className="mt-1" onClick={() => markApptPaid(r.id)}>
                            Marcar como pago
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-200">Pago</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <AddBillDueDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        bill={editingBill}
        onSaved={load}
      />
    </div>
  );
};

export default AppointmentsFinancialTab;
