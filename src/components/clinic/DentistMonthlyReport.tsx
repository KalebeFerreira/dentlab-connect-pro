import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, DollarSign, TrendingUp, Activity } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DentistMonthlyReportProps {
  dentistId: string;
}

interface TreatmentStats {
  procedure_type: string;
  count: number;
  total: number;
}

export const DentistMonthlyReport = ({ dentistId }: DentistMonthlyReportProps) => {
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [totalAppointments, setTotalAppointments] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [treatmentStats, setTreatmentStats] = useState<TreatmentStats[]>([]);

  useEffect(() => {
    fetchMonthlyReport();
  }, [dentistId, selectedMonth]);

  const fetchMonthlyReport = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = startOfMonth(new Date(parseInt(year), parseInt(month) - 1));
      const endDate = endOfMonth(new Date(parseInt(year), parseInt(month) - 1));

      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('dentist_id', dentistId)
        .gte('appointment_date', startDate.toISOString())
        .lte('appointment_date', endDate.toISOString())
        .in('status', ['completed', 'confirmed', 'scheduled']);

      if (error) throw error;

      const total = appointments?.length || 0;
      const earnings = appointments?.reduce((sum, apt) => sum + (apt.dentist_payment || 0), 0) || 0;

      // Group by treatment type
      const stats: Record<string, TreatmentStats> = {};
      appointments?.forEach((apt) => {
        const treatmentType = apt.procedure_type || apt.type || 'Não especificado';
        if (!stats[treatmentType]) {
          stats[treatmentType] = {
            procedure_type: treatmentType,
            count: 0,
            total: 0,
          };
        }
        stats[treatmentType].count += 1;
        stats[treatmentType].total += apt.dentist_payment || 0;
      });

      setTotalAppointments(total);
      setTotalEarnings(earnings);
      setTreatmentStats(Object.values(stats).sort((a, b) => b.total - a.total));
    } catch (error) {
      console.error('Error fetching monthly report:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const value = format(date, "yyyy-MM");
      const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
      options.push({ value, label });
    }
    return options;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Relatório Mensal</CardTitle>
          <CardDescription>Carregando relatório...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Month Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Relatório Mensal</CardTitle>
              <CardDescription>Resumo de consultas e ganhos</CardDescription>
            </div>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {generateMonthOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Consultas
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAppointments}</div>
            <p className="text-xs text-muted-foreground">
              Consultas realizadas no mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Ganhos
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totalEarnings.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Valor total recebido
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Valor Médio
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totalAppointments > 0 ? (totalEarnings / totalAppointments).toFixed(2) : '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Por consulta
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Treatment Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Valores por Tipo de Tratamento
          </CardTitle>
          <CardDescription>
            Detalhamento de consultas por procedimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {treatmentStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma consulta encontrada no período selecionado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo de Tratamento</TableHead>
                    <TableHead className="text-center">Quantidade</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead className="text-right">Valor Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {treatmentStats.map((stat, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {stat.procedure_type}
                      </TableCell>
                      <TableCell className="text-center">
                        {stat.count}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {stat.total.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        R$ {(stat.total / stat.count).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-center">{totalAppointments}</TableCell>
                    <TableCell className="text-right">R$ {totalEarnings.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      R$ {totalAppointments > 0 ? (totalEarnings / totalAppointments).toFixed(2) : '0.00'}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
