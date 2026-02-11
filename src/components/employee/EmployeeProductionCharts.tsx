import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from "recharts";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface EmployeeProductionChartsProps {
  workRecords: WorkRecord[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(340, 65%, 50%)",
  "hsl(45, 80%, 50%)",
  "hsl(280, 60%, 55%)",
];

export const EmployeeProductionCharts = ({ workRecords }: EmployeeProductionChartsProps) => {
  // Monthly production data (last 6 months)
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { month: string; label: string; quantidade: number; valor: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const key = format(d, "yyyy-MM");
      months.push({
        month: key,
        label: format(d, "MMM/yy", { locale: ptBR }),
        quantidade: 0,
        valor: 0,
      });
    }
    for (const r of workRecords) {
      const key = format(parseISO(r.start_date), "yyyy-MM");
      const m = months.find(x => x.month === key);
      if (m) {
        m.quantidade++;
        m.valor += r.value || 0;
      }
    }
    return months;
  }, [workRecords]);

  // By status
  const statusData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of workRecords) {
      const label = r.status === "finished" ? "Finalizado" : r.status === "in_progress" ? "Em Andamento" : "Pendente";
      map[label] = (map[label] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [workRecords]);

  // By work type
  const typeData = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    for (const r of workRecords) {
      if (!map[r.work_type]) map[r.work_type] = { count: 0, value: 0 };
      map[r.work_type].count++;
      map[r.work_type].value += r.value || 0;
    }
    return Object.entries(map)
      .map(([name, d]) => ({ name: name.length > 15 ? name.slice(0, 15) + "…" : name, quantidade: d.count, valor: d.value }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 8);
  }, [workRecords]);

  if (workRecords.length === 0) return null;

  const monthlyChartConfig = {
    quantidade: { label: "Quantidade", color: "hsl(var(--primary))" },
    valor: { label: "Valor (R$)", color: "hsl(210, 70%, 55%)" },
  };

  const typeChartConfig = {
    quantidade: { label: "Quantidade", color: "hsl(var(--primary))" },
    valor: { label: "Valor (R$)", color: "hsl(150, 60%, 45%)" },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Monthly production trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Produção Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={monthlyChartConfig} className="h-[250px] w-full">
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="quantidade" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Monthly value trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Faturamento Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={monthlyChartConfig} className="h-[250px] w-full">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />} />
              <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Status distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Distribuição por Status</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <div className="h-[250px] w-full max-w-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* By work type */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Produção por Tipo</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={typeChartConfig} className="h-[250px] w-full">
            <BarChart data={typeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" fontSize={11} />
              <YAxis dataKey="name" type="category" fontSize={10} width={100} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="quantidade" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};
