import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wallet, CalendarClock, TrendingUp, TrendingDown, FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { startOfMonth, startOfYear, subDays, parseISO, isAfter, isBefore, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generatePDF } from "@/lib/pdfGenerator";
import { buildCsv, triggerDownload } from "@/lib/reportExport";
import { toast } from "sonner";

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

const fmt = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  const getCategory = (r: Receivable): PaymentCategory => {
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

  const aVistaRecs = receivables.filter((r) => getCategory(r) === "a_vista");
  const mensRecs = receivables.filter((r) => getCategory(r) === "mensalista");

  const totalRecebidoPeriodo = (recs: Receivable[], fromDate: string) =>
    recs.filter((r) => r.paid_at && r.date >= fromDate).reduce((s, r) => s + r.amount, 0);

  const periodFroms = PERIODS.map((p) => ({ key: p.key, label: p.label, from: p.from().toISOString().split("T")[0] }));
  const totalsAVista = periodFroms.map((p) => totalRecebidoPeriodo(aVistaRecs, p.from));
  const totalsMens = periodFroms.map((p) => totalRecebidoPeriodo(mensRecs, p.from));
  const totalsGeral = periodFroms.map((_, i) => totalsAVista[i] + totalsMens[i]);
  const acumuladoAno = totalsGeral[totalsGeral.length - 1];

  return (
    <div className="space-y-4">
      <Card className="shadow-card border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Total Recebido (À Vista + Mensalistas)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {periodFroms.map((p, i) => (
              <div key={p.key} className="p-3 rounded-md bg-background border">
                <div className="text-xs text-muted-foreground">{p.label}</div>
                <div className="text-lg font-bold text-green-600">{fmt(totalsGeral[i])}</div>
                <div className="text-[10px] text-muted-foreground">À vista: {fmt(totalsAVista[i])} · Mens.: {fmt(totalsMens[i])}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t flex items-center justify-between">
            <span className="text-sm font-medium">Acumulado no ano</span>
            <span className="text-2xl font-extrabold text-green-700">{fmt(acumuladoAno)}</span>
          </div>
        </CardContent>
      </Card>

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
            receivables={aVistaRecs}
            expenses={expenses.filter((e) => e.payment_method !== "a_prazo")}
            periodTotals={totalsAVista}
            periodLabels={periodFroms.map((p) => p.label)}
          />
        </TabsContent>
        <TabsContent value="mensalista">
          <CategoryReport
            category="mensalista"
            receivables={mensRecs}
            expenses={expenses.filter((e) => e.payment_method === "a_prazo")}
            periodTotals={totalsMens}
            periodLabels={periodFroms.map((p) => p.label)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const CategoryReport = ({
  category,
  receivables,
  expenses,
  periodTotals,
  periodLabels,
}: {
  category: PaymentCategory;
  receivables: Receivable[];
  expenses: Expense[];
  periodTotals: number[];
  periodLabels: string[];
}) => {
  const today = new Date().toISOString().split("T")[0];
  const [exportPeriod, setExportPeriod] = useState<string>("month");
  const [exporting, setExporting] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

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

  // Export data for selected period
  const selectedPeriod = PERIODS.find((p) => p.key === exportPeriod) || PERIODS[2];
  const selectedFrom = selectedPeriod.from().toISOString().split("T")[0];
  const exportRecs = receivables
    .filter((r) => r.date >= selectedFrom)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const exportStats = periodStats.find((p) => p.key === exportPeriod)!;

  const statusOf = (r: Receivable) => {
    if (r.paid_at) return "Recebido";
    if (r.due_date && r.due_date < today) return "Vencido";
    return "Pendente";
  };

  const categoryLabel = category === "a_vista" ? "À Vista" : "Mensalistas";
  const fileBase = `relatorio-${category}-${exportPeriod}-${format(new Date(), "yyyy-MM-dd")}`;

  const handleExportPDF = async () => {
    if (!pdfRef.current) return;
    setExporting(true);
    try {
      // Make visible for capture
      pdfRef.current.style.left = "0";
      pdfRef.current.style.top = "0";
      pdfRef.current.style.position = "fixed";
      pdfRef.current.style.zIndex = "-1";
      pdfRef.current.style.opacity = "1";
      await generatePDF(pdfRef.current, { filename: `${fileBase}.pdf`, orientation: "portrait" });
      toast.success("PDF gerado com sucesso");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar PDF");
    } finally {
      pdfRef.current.style.left = "-9999px";
      pdfRef.current.style.opacity = "0";
      setExporting(false);
    }
  };

  const handleExportCSV = () => {
    const rows: (string | number)[][] = [];
    rows.push([`Relatório ${categoryLabel} — ${selectedPeriod.label}`]);
    rows.push([`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`]);
    rows.push([]);
    rows.push(["Resumo"]);
    rows.push(["Recebido", fmtNum(exportStats.recebido)]);
    rows.push(["A receber", fmtNum(exportStats.aReceber)]);
    rows.push(["Vencido", fmtNum(exportStats.vencido)]);
    rows.push(["Despesas", fmtNum(exportStats.despesa)]);
    rows.push(["Lucro", fmtNum(exportStats.lucro)]);
    rows.push([]);
    rows.push(["Transações"]);
    rows.push(["Cliente/Paciente", "Data", "Vencimento", "Valor", "Status"]);
    exportRecs.forEach((r) => {
      rows.push([
        r.client,
        r.date ? format(parseISO(r.date), "dd/MM/yyyy") : "",
        r.due_date ? format(parseISO(r.due_date), "dd/MM/yyyy") : "",
        fmtNum(r.amount),
        statusOf(r),
      ]);
    });
    rows.push([]);
    rows.push(["Resumo por Cliente"]);
    rows.push(["Cliente", "Transações", "Recebido", "Pendente", "Vencido", "Total"]);
    clients.forEach((c) => {
      rows.push([c.client, c.count, fmtNum(c.recebido), fmtNum(c.pendente), fmtNum(c.vencido), fmtNum(c.recebido + c.pendente + c.vencido)]);
    });
    const csv = "\uFEFF" + buildCsv(rows);
    triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${fileBase}.csv`);
    toast.success("CSV baixado");
  };

  const handlePrint = () => {
    if (!pdfRef.current) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<html><head><title>${fileBase}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;color:#1f2937;}
      table{width:100%;border-collapse:collapse;margin:10px 0;font-size:12px;}
      th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left;}
      th{background:#f3f4f6;}
      h1{font-size:18px;margin:0 0 4px;} h2{font-size:14px;margin:16px 0 8px;color:#1c4587;}
      .summary{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:10px 0;}
      .summary div{border:1px solid #e5e7eb;padding:8px;border-radius:4px;}
      .summary .lbl{font-size:10px;color:#6b7280;text-transform:uppercase;}
      .summary .val{font-size:14px;font-weight:bold;}
      </style></head><body>${pdfRef.current.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 300);
  };

  return (
    <div className="space-y-4">
      {/* Export bar */}
      <Card className="shadow-card">
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Exportar relatório:</span>
          <Select value={exportPeriod} onValueChange={setExportPeriod}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={handleExportPDF} disabled={exporting}>
            <FileDown className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportCSV}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel (CSV)
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">{exportRecs.length} transações no período</span>
        </CardContent>
      </Card>

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
            Clientes / Pacientes — {categoryLabel}
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
      <Card className="shadow-card border-green-200 bg-green-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Resumo Recebido — {categoryLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {periodLabels.map((label, i) => (
              <div key={label} className="p-3 rounded-md bg-background border">
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-lg font-bold text-green-600">{fmt(periodTotals[i] || 0)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Hidden PDF/Print layout */}
      <div
        ref={pdfRef}
        style={{ position: "fixed", left: "-9999px", top: 0, width: "800px", background: "#fff", padding: "24px", opacity: 0, fontFamily: "Arial, sans-serif", color: "#1f2937" }}
      >
        <h1 style={{ fontSize: 20, margin: 0, color: "#1c4587" }}>Relatório {categoryLabel}</h1>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
          Período: {selectedPeriod.label} · Gerado em {format(new Date(), "dd/MM/yyyy HH:mm")}
        </div>

        <h2 style={{ fontSize: 14, color: "#1c4587", margin: "16px 0 8px" }}>Resumo</h2>
        <div className="summary" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
          {[
            ["Recebido", exportStats.recebido, "#16a34a"],
            ["A receber", exportStats.aReceber, "#2563eb"],
            ["Vencido", exportStats.vencido, "#dc2626"],
            ["Despesas", exportStats.despesa, "#dc2626"],
            ["Lucro", exportStats.lucro, exportStats.lucro >= 0 ? "#16a34a" : "#dc2626"],
          ].map(([l, v, c]) => (
            <div key={l as string} style={{ border: "1px solid #e5e7eb", padding: 8, borderRadius: 4 }}>
              <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase" }}>{l as string}</div>
              <div style={{ fontSize: 14, fontWeight: "bold", color: c as string }}>{fmt(v as number)}</div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 14, color: "#1c4587", margin: "16px 0 8px" }}>Transações ({exportRecs.length})</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              <th style={{ border: "1px solid #e5e7eb", padding: 6, textAlign: "left" }}>Cliente/Paciente</th>
              <th style={{ border: "1px solid #e5e7eb", padding: 6, textAlign: "left" }}>Data</th>
              <th style={{ border: "1px solid #e5e7eb", padding: 6, textAlign: "left" }}>Vencimento</th>
              <th style={{ border: "1px solid #e5e7eb", padding: 6, textAlign: "right" }}>Valor</th>
              <th style={{ border: "1px solid #e5e7eb", padding: 6, textAlign: "left" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {exportRecs.map((r, i) => (
              <tr key={i}>
                <td style={{ border: "1px solid #e5e7eb", padding: 6 }}>{r.client}</td>
                <td style={{ border: "1px solid #e5e7eb", padding: 6 }}>{r.date ? format(parseISO(r.date), "dd/MM/yyyy") : "—"}</td>
                <td style={{ border: "1px solid #e5e7eb", padding: 6 }}>{r.due_date ? format(parseISO(r.due_date), "dd/MM/yyyy") : "—"}</td>
                <td style={{ border: "1px solid #e5e7eb", padding: 6, textAlign: "right" }}>{fmt(r.amount)}</td>
                <td style={{ border: "1px solid #e5e7eb", padding: 6 }}>{statusOf(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 style={{ fontSize: 14, color: "#1c4587", margin: "16px 0 8px" }}>Resumo por Cliente</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              <th style={{ border: "1px solid #e5e7eb", padding: 6, textAlign: "left" }}>Cliente</th>
              <th style={{ border: "1px solid #e5e7eb", padding: 6, textAlign: "center" }}>Transações</th>
              <th style={{ border: "1px solid #e5e7eb", padding: 6, textAlign: "right" }}>Recebido</th>
              <th style={{ border: "1px solid #e5e7eb", padding: 6, textAlign: "right" }}>Pendente</th>
              <th style={{ border: "1px solid #e5e7eb", padding: 6, textAlign: "right" }}>Vencido</th>
              <th style={{ border: "1px solid #e5e7eb", padding: 6, textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.client}>
                <td style={{ border: "1px solid #e5e7eb", padding: 6 }}>{c.client}</td>
                <td style={{ border: "1px solid #e5e7eb", padding: 6, textAlign: "center" }}>{c.count}</td>
                <td style={{ border: "1px solid #e5e7eb", padding: 6, textAlign: "right" }}>{fmt(c.recebido)}</td>
                <td style={{ border: "1px solid #e5e7eb", padding: 6, textAlign: "right" }}>{fmt(c.pendente)}</td>
                <td style={{ border: "1px solid #e5e7eb", padding: 6, textAlign: "right" }}>{fmt(c.vencido)}</td>
                <td style={{ border: "1px solid #e5e7eb", padding: 6, textAlign: "right", fontWeight: "bold" }}>{fmt(c.recebido + c.pendente + c.vencido)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PaymentTypeReports;
