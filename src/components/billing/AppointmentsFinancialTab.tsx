import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Clock, AlertCircle, CheckCircle2, TrendingUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { startOfMonth, endOfMonth, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export const AppointmentsFinancialTab = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ApptRow[]>([]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("appts-financial-tab")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => load())
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
      const { data, error } = await supabase
        .from("appointments")
        .select("id, appointment_date, procedure_type, treatment_value, payment_method, paid_at, due_date, status, patient:patients(name)")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .gt("treatment_value", 0)
        .order("appointment_date", { ascending: false });
      if (error) throw error;
      setRows((data as any) || []);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const markPaid = async (id: string) => {
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("appointments").update({ paid_at: today }).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pagamento registrado", description: "Refletido no financeiro." });
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

  const aVencer = rows.filter((r) => !r.paid_at && r.due_date && r.due_date >= today);
  const vencidas = rows.filter((r) => !r.paid_at && r.due_date && r.due_date < today);
  const pagasMes = rows.filter((r) => r.paid_at && r.paid_at >= monthStart && r.paid_at <= monthEnd);
  const previstoMes = rows.filter((r) => {
    const d = (r.appointment_date || "").split("T")[0];
    return d >= monthStart && d <= monthEnd;
  });

  const sum = (arr: ApptRow[]) => arr.reduce((s, r) => s + Number(r.treatment_value || 0), 0);

  const cards = [
    { key: "vencer", title: "A vencer", icon: Clock, color: "text-blue-600", border: "border-blue-200", items: aVencer },
    { key: "vencidas", title: "Vencidas", icon: AlertCircle, color: "text-red-600", border: "border-red-200", items: vencidas },
    { key: "pagas", title: "Pagas (mês)", icon: CheckCircle2, color: "text-green-600", border: "border-green-200", items: pagasMes },
    { key: "previsto", title: "Total previsto (mês)", icon: TrendingUp, color: "text-primary", border: "border-primary/30", items: previstoMes },
  ];

  return (
    <div className="space-y-4">
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
                <div className={`text-xl md:text-2xl font-bold ${c.color}`}>{fmt(sum(c.items))}</div>
                <p className="text-xs text-muted-foreground">{c.items.length} agendamento(s)</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Accordion type="multiple" className="space-y-2">
        {cards.map((c) => (
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
                        {!r.paid_at && (
                          <Button size="sm" variant="outline" className="mt-1" onClick={() => markPaid(r.id)}>
                            Marcar como pago
                          </Button>
                        )}
                        {r.paid_at && (
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
    </div>
  );
};

export default AppointmentsFinancialTab;
