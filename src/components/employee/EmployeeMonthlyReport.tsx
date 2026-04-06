import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, DollarSign, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
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

interface EmployeeMonthlyReportProps {
  workRecords: WorkRecord[];
  employeeName: string;
}

export const EmployeeMonthlyReport = ({ workRecords, employeeName }: EmployeeMonthlyReportProps) => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // Generate last 12 months for selector
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: format(d, "MMMM yyyy", { locale: ptBR }),
      });
    }
    return options;
  }, []);

  const reportData = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const refDate = new Date(year, month - 1, 1);
    const start = startOfMonth(refDate);
    const end = endOfMonth(refDate);

    // Filter records by start_date within the selected month
    const monthRecords = workRecords.filter((r) => {
      const recordDate = new Date(r.start_date);
      return isWithinInterval(recordDate, { start, end });
    });

    const finished = monthRecords.filter((r) => r.status === "finished");
    const inProgress = monthRecords.filter((r) => r.status === "in_progress");
    const totalValue = monthRecords.reduce((sum, r) => sum + (r.value || 0), 0);
    const finishedValue = finished.reduce((sum, r) => sum + (r.value || 0), 0);

    return {
      records: monthRecords,
      totalCount: monthRecords.length,
      finishedCount: finished.length,
      inProgressCount: inProgress.length,
      totalValue,
      finishedValue,
      monthLabel: format(refDate, "MMMM 'de' yyyy", { locale: ptBR }),
    };
  }, [workRecords, selectedMonth]);

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      in_progress: { label: "Em andamento", variant: "default" },
      finished: { label: "Finalizado", variant: "secondary" },
      pending: { label: "Pendente", variant: "outline" },
    };
    const s = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Relatório Mensal
        </h3>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground capitalize">
        {employeeName} — {reportData.monthLabel}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{reportData.totalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Finalizados</p>
                <p className="text-xl font-bold">{reportData.finishedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Em andamento</p>
                <p className="text-xl font-bold">{reportData.inProgressCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold">
                  {reportData.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {reportData.records.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trabalhos do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Cor</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Finalização</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.work_type}</TableCell>
                      <TableCell>{record.patient_name || "-"}</TableCell>
                      <TableCell>{record.color || "-"}</TableCell>
                      <TableCell>
                        {record.value
                          ? record.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                          : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(record.status)}</TableCell>
                      <TableCell>
                        {format(new Date(record.start_date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {record.end_date
                          ? format(new Date(record.end_date), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 pt-3 border-t flex justify-end">
              <p className="text-sm font-semibold">
                Total do mês:{" "}
                <span className="text-primary">
                  {reportData.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum trabalho registrado neste mês</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
