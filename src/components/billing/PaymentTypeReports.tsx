import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Wallet, CalendarClock, TrendingUp, TrendingDown } from "lucide-react";
import { startOfMonth, startOfYear, subDays, parseISO, isAfter, isBefore, format } from "date-fns";
import { ptBR } from "date-fns/locale";

type PaymentCategory = "a_vista" | "mensalista";

interface Receivable {
  client: string;
  amount: number;
  paid_at: string | null;
  due_date: string | null;
  date: string; // base date (service_date / appointment_date)
  source: "service" | "appointment";
}

interface Expense {
  amount: number;
  date: string;
  payment_method: string | null;
}

const fmt = (v: number) => `R$ ${v.toFixed(2)}`;

const PERIODS: { key: string; label: string; from: () => Date }[] = [
  { key: "week", label: "Semanal (7d)", from: () => subDays(new Date(), 7) },
  { key: "fortnight", label: "Quinzenal (15d)", from: () => subDays(new Date(), 15) },
  { key: "month", label: "Mensal", from: () => startOfMonth(new Date()) },
  { key: "year", label: "Anual", from: () => startOfYear(new Date()) },
];

export const PaymentTypeReports = () => {
  const [loading, setLoading] = useState(true);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PaymentCategory>>({});

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const yearStart = startOfYear(new Date()).toISOString().split("T")[0];

      const [svcRes, apptRes, profRes, txRes] = await Promise.all([
        supabase
          .from("services")
          .select("client_name, service_value, payment_method, paid_at, due_date, service_date")
          .eq("user_id", user.id)
          .eq("status", "active")
          .gte("service_date", yearStart),
        supabase
          .from("appointments")
          .select("treatment_value, payment_method, paid_at, due_date, appointment_date, status, patient:patients(name)")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .gte("appointment_date", yearStart),
        supabase
          .from("client_payment_profiles")
          .select("client_name, payment_type")
          .eq("user_id", user.id),
        supabase
          .from("financial_transactions")
          .select("amount, created_at, payment_method, transaction_type, status")
          .eq("user_id", user.id)
          .eq("transaction_type", "payment")
          .eq("status", "completed")
          .gte("created_at", yearStart),
      ]);

      const profMap: Record<string, PaymentCategory> = {};
      (profRes.data || []).forEach((p: any) => {
        if (p.payment_type === "a_vista" || p.payment_type === "mensalista") {
          profMap[p.client_name?.trim().toLowerCase()] = p.payment_type;
        }
      });
      setProfiles(profMap);

      const recs: Receivable[] = [];
      (svcRes.data || []).forEach((s: any) => {
        if (!s.client_name) return;
        recs.push({
          client: s.client_name,
          amount: Number(s.service_value || 0),
          paid_at: s.paid_at,
          due_date: s.due_date,
          date: s.service_date,
          source: "service",
        });
      });
      (apptRes.data || []).forEach((a: any) => {
        const v = Number(a.treatment_value || 0);
        if (v <= 0) return;
        recs.push({
          client: a.patient?.name || "Paciente",
          amount: v,
          paid_at: a.paid_at,
          due_date: a.due_date,
          date: (a.appointment_date || "").split("T")[0],
          source: "appointment",
        });
      });
      setReceivables(recs);

      setExpenses(
        (txRes.data || []).map((t: any) => ({
          amount: Number(t.amount || 0),
          date: (t.created_at || "").split("T")[0],
          payment_method: t.payment_method,
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  const classify = (r: Receivable): PaymentCategory => {
    const p = profiles[r.client?.trim().toLowerCase()];
    if (p) return p;
    return r.payment_method_fallback === "a_prazo" ? "mensalista" : "a_vista";
  };

  // attach payment_method-based fallback during classification
  const getCategory = (r: any): PaymentCategory => {
    const p = profiles[r.client?.trim().toLowerCase()];
    if (p) return p;
    // we don't store payment_method on receivable; infer from due_date vs date
    if (r.due_date && r.date && r.due_date !== r.date) return "mensalista";
    return "a_vista";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="a_vista" className="space-y-4">
      <TabsList>
        <TabsTrigger value="a_vista" className="gap-2">
          <Wallet className="h-4 w-4" /> À Vista
        </TabsTrigger>
        <TabsTrigger value="mensalista" className="gap-2">
          <CalendarClock className="h-4 w-4" /> Mensalistas / Parcelado
        </TabsTrigger>
      </TabsList>

      <TabsContent value="a_vista">
        <CategoryReport
          category="a_vista"
          receivables={receivables.filter((r) => getCategory(r) === "a_vista")}
          expenses={expenses.filter((e) => e.payment_method !== "a_prazo")}
        />
      </TabsContent>
      <TabsContent value="mensalista">
        <CategoryReport
          category="mensalista"
          receivables={receivables.filter((r) => getCategory(r) === "mensalista")}
          expenses={expenses.filter((e) => e.payment_method === "a_prazo")}
        />
      </TabsContent>
    </Tabs>
  );
};

const CategoryReport = ({
  category,
  receivables,
  expenses,
}: {
  category: PaymentCategory;
  receivables: Receivable[];
  expenses: Expense[];
}) => {
  const today = new Date().toISOString().split("T")[0];

  const periodStats = PERIODS.map((p) => {
    const from = p.from().toISOString().split("T")[0];
    const inRange = receivables.filter((r) => r.date >= from);
    const recebido = inRange.filter((r) => r.paid_at).reduce((s, r) => s + r.amount, 0);
    const aReceber = inRange.filter((r) => !r.paid_at && (!r.due_date || r.due_date >= today)).reduce((s, r) => s + r.amount, 0);
    const vencido = inRange.filter((r) => !r.paid_at && r.due_date && r.due_date < today).reduce((s, r) => s + r.amount, 0);
    const desp = expenses.filter((e) => e.date >= from).reduce((s, e) => s + e.amount, 0);
    return { ...p, recebido, aReceber, vencido, despesa: desp, lucro: recebido - desp };
  });

  // Aggregate by client
  const clientMap = new Map<string, { client: string; count: number; recebido: number; pendente: number; vencido: number; ultima: string }>();
  receivables.forEach((r) => {
    const key = r.client?.trim() || "—";
    const cur = clientMap.get(key) || { client: key, count: 0, recebido: 0, pendente: 0, vencido: 0, ultima: r.date };
    cur.count += 1;
    if (r.paid_at) cur.recebido += r.amount;
    else if (r.due_date && r.due_date < today) cur.vencido += r.amount;
    else cur.pendente += r.amount;
    if (r.date > cur.ultima) cur.ultima = r.date;
    clientMap.set(key, cur);
  });
  const clients = Array.from(clientMap.values()).sort((a, b) => (b.recebido + b.pendente + b.vencido) - (a.recebido + a.pendente + a.vencido));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {periodStats.map((p) => (
          <Card key={p.key} className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{p.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Recebido</span><span className="text-green-600 font-semibold">{fmt(p.recebido)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">A receber</span><span className="text-blue-600">{fmt(p.aReceber)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Vencido</span><span className="text-red-600">{fmt(p.vencido)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Despesas</span><span className="text-red-500">{fmt(p.despesa)}</span></div>
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="font-semibold">Lucro</span>
                <span className={`font-bold ${p.lucro >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(p.lucro)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">
            Clientes / Pacientes — {category === "a_vista" ? "À Vista" : "Mensalistas"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum cliente nesta categoria.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente / Paciente</TableHead>
                    <TableHead className="text-center">Transações</TableHead>
                    <TableHead className="text-right">Recebido</TableHead>
                    <TableHead className="text-right">Pendente</TableHead>
                    <TableHead className="text-right">Vencido</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Última</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c) => (
                    <TableRow key={c.client}>
                      <TableCell className="font-medium">{c.client}</TableCell>
                      <TableCell className="text-center">{c.count}</TableCell>
                      <TableCell className="text-right text-green-600">{fmt(c.recebido)}</TableCell>
                      <TableCell className="text-right text-blue-600">{fmt(c.pendente)}</TableCell>
                      <TableCell className="text-right text-red-600">{fmt(c.vencido)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(c.recebido + c.pendente + c.vencido)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.ultima ? format(parseISO(c.ultima), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentTypeReports;
