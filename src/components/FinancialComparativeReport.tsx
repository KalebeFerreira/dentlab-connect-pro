import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp, FileDown, Loader2 } from "lucide-react";
import { ChartContainer } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend, LineChart, Line, CartesianGrid, Tooltip } from "recharts";
import html2canvas from "html2canvas";
import * as ExcelJS from "exceljs";
import { toast } from "sonner";
import { generatePDFBlob } from "@/lib/pdfGenerator";

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  status: string;
  month: number;
  year: number;
  created_at: string;
}

interface FinancialComparativeReportProps {
  transactions: Transaction[];
  filterYear: number;
}

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const monthNamesShort = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

const COLORS = {
  income: "hsl(142, 76%, 36%)",
  expense: "hsl(0, 72%, 51%)",
  profit: "hsl(217, 91%, 60%)",
  growth: "hsl(142, 76%, 36%)",
  decline: "hsl(0, 72%, 51%)"
};

export const FinancialComparativeReport = ({ transactions, filterYear }: FinancialComparativeReportProps) => {
  const [compareMonth1, setCompareMonth1] = useState<number>(new Date().getMonth());
  const [compareMonth2, setCompareMonth2] = useState<number>(new Date().getMonth() + 1);
  const [isExporting, setIsExporting] = useState(false);

  // Calculate monthly summaries
  const monthlySummaries = useMemo(() => {
    return monthNames.map((name, index) => {
      const month = index + 1;
      const monthTransactions = transactions.filter(t => t.month === month && t.year === filterYear);
      
      const income = monthTransactions
        .filter(t => t.transaction_type === "receipt" && t.status === "completed")
        .reduce((sum, t) => sum + t.amount, 0);
      
      const expense = monthTransactions
        .filter(t => t.transaction_type === "payment" && t.status === "completed")
        .reduce((sum, t) => sum + t.amount, 0);
      
      const pending = monthTransactions
        .filter(t => t.status === "pending")
        .reduce((sum, t) => sum + t.amount, 0);
      
      const transactionCount = monthTransactions.length;
      
      return {
        month,
        name,
        nameShort: monthNamesShort[index],
        income,
        expense,
        profit: income - expense,
        pending,
        transactionCount
      };
    });
  }, [transactions, filterYear]);

  // Calculate year-to-date totals
  const yearTotals = useMemo(() => {
    return monthlySummaries.reduce(
      (acc, month) => ({
        income: acc.income + month.income,
        expense: acc.expense + month.expense,
        profit: acc.profit + month.profit,
        pending: acc.pending + month.pending,
        transactionCount: acc.transactionCount + month.transactionCount
      }),
      { income: 0, expense: 0, profit: 0, pending: 0, transactionCount: 0 }
    );
  }, [monthlySummaries]);

  // Calculate month averages
  const monthAverages = useMemo(() => {
    const monthsWithData = monthlySummaries.filter(m => m.transactionCount > 0).length || 1;
    return {
      income: yearTotals.income / monthsWithData,
      expense: yearTotals.expense / monthsWithData,
      profit: yearTotals.profit / monthsWithData
    };
  }, [monthlySummaries, yearTotals]);

  // Compare two specific months
  const monthComparison = useMemo(() => {
    const month1 = monthlySummaries[compareMonth1];
    const month2 = monthlySummaries[compareMonth2];

    if (!month1 || !month2) return null;

    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      month1,
      month2,
      incomeChange: calculateChange(month2.income, month1.income),
      expenseChange: calculateChange(month2.expense, month1.expense),
      profitChange: calculateChange(month2.profit, month1.profit),
      incomeDiff: month2.income - month1.income,
      expenseDiff: month2.expense - month1.expense,
      profitDiff: month2.profit - month1.profit
    };
  }, [monthlySummaries, compareMonth1, compareMonth2]);

  // Chart data for cumulative growth
  const cumulativeData = useMemo(() => {
    let cumIncome = 0;
    let cumExpense = 0;
    let cumProfit = 0;

    return monthlySummaries.map(month => {
      cumIncome += month.income;
      cumExpense += month.expense;
      cumProfit += month.profit;

      return {
        name: month.nameShort,
        receitasAcumuladas: cumIncome,
        despesasAcumuladas: cumExpense,
        lucroAcumulado: cumProfit
      };
    });
  }, [monthlySummaries]);

  // Growth rate data
  const growthData = useMemo(() => {
    return monthlySummaries.map((month, index) => {
      if (index === 0) {
        return { name: month.nameShort, crescimentoReceita: 0, crescimentoDespesa: 0 };
      }
      
      const prevMonth = monthlySummaries[index - 1];
      const incomeGrowth = prevMonth.income === 0 ? 0 : ((month.income - prevMonth.income) / prevMonth.income) * 100;
      const expenseGrowth = prevMonth.expense === 0 ? 0 : ((month.expense - prevMonth.expense) / prevMonth.expense) * 100;

      return {
        name: month.nameShort,
        crescimentoReceita: Math.round(incomeGrowth * 10) / 10,
        crescimentoDespesa: Math.round(expenseGrowth * 10) / 10
      };
    });
  }, [monthlySummaries]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getChangeIcon = (value: number, inverse = false) => {
    if (value === 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
    const isPositive = inverse ? value < 0 : value > 0;
    return isPositive ? (
      <ArrowUpRight className="h-4 w-4 text-green-600" />
    ) : (
      <ArrowDownRight className="h-4 w-4 text-red-600" />
    );
  };

  const getChangeBadge = (value: number, inverse = false) => {
    const isPositive = inverse ? value < 0 : value > 0;
    const variant = value === 0 ? "secondary" : isPositive ? "default" : "destructive";
    return (
      <Badge variant={variant} className={isPositive ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
        {formatPercent(value)}
      </Badge>
    );
  };

  const chartConfig = {
    receitasAcumuladas: { label: "Receitas Acumuladas", color: COLORS.income },
    despesasAcumuladas: { label: "Despesas Acumuladas", color: COLORS.expense },
    lucroAcumulado: { label: "Lucro Acumulado", color: COLORS.profit },
    crescimentoReceita: { label: "Crescimento Receita (%)", color: COLORS.income },
    crescimentoDespesa: { label: "Crescimento Despesa (%)", color: COLORS.expense }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const reportElement = document.getElementById("comparative-report");
      if (!reportElement) {
        toast.error("Erro ao encontrar relatório");
        return;
      }

      const pdfBlob = await generatePDFBlob(reportElement, {
        margin: 10,
        format: "a4",
        orientation: "portrait",
        scale: 2,
      });

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio-comparativo-${filterYear}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast.error("Erro ao exportar PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Relatório Comparativo");

      // Title
      worksheet.mergeCells("A1:F1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = `Relatório Comparativo - ${filterYear}`;
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: "center" };

      worksheet.addRow([]);

      // Headers
      worksheet.addRow(["Mês", "Receitas", "Despesas", "Lucro", "Pendentes", "Transações"]);
      const headerRow = worksheet.lastRow;
      if (headerRow) {
        headerRow.eachCell((cell) => {
          cell.font = { bold: true };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE5E7EB" }
          };
        });
      }

      // Monthly data
      monthlySummaries.forEach((month) => {
        worksheet.addRow([
          month.name,
          month.income,
          month.expense,
          month.profit,
          month.pending,
          month.transactionCount
        ]);
      });

      // Totals row
      worksheet.addRow([]);
      const totalsRow = worksheet.addRow([
        "TOTAL ANO",
        yearTotals.income,
        yearTotals.expense,
        yearTotals.profit,
        yearTotals.pending,
        yearTotals.transactionCount
      ]);
      if (totalsRow) {
        totalsRow.eachCell((cell) => {
          cell.font = { bold: true };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDBEAFE" }
          };
        });
      }

      // Averages row
      const avgRow = worksheet.addRow([
        "MÉDIA MENSAL",
        monthAverages.income,
        monthAverages.expense,
        monthAverages.profit,
        "-",
        "-"
      ]);
      if (avgRow) {
        avgRow.eachCell((cell) => {
          cell.font = { bold: true };
        });
      }

      // Format columns
      worksheet.columns = [
        { width: 15 },
        { width: 18 },
        { width: 18 },
        { width: 18 },
        { width: 15 },
        { width: 12 }
      ];

      // Format currency columns
      worksheet.getColumn(2).numFmt = '"R$"#,##0.00';
      worksheet.getColumn(3).numFmt = '"R$"#,##0.00';
      worksheet.getColumn(4).numFmt = '"R$"#,##0.00';
      worksheet.getColumn(5).numFmt = '"R$"#,##0.00';

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio-comparativo-${filterYear}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Excel exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar Excel:", error);
      toast.error("Erro ao exportar Excel");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6" id="comparative-report">
      {/* Header with Export Options */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Relatório Comparativo - {filterYear}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
              Excel
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Month-to-Month Comparison Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comparação entre Meses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">De:</span>
              <Select value={compareMonth1.toString()} onValueChange={(v) => setCompareMonth1(parseInt(v))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((name, index) => (
                    <SelectItem key={index} value={index.toString()}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Para:</span>
              <Select value={compareMonth2.toString()} onValueChange={(v) => setCompareMonth2(parseInt(v))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((name, index) => (
                    <SelectItem key={index} value={index.toString()}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {monthComparison && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">Receitas</span>
                  {getChangeIcon(monthComparison.incomeChange)}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold">{formatCurrency(monthComparison.month2.income)}</span>
                  {getChangeBadge(monthComparison.incomeChange)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  vs {formatCurrency(monthComparison.month1.income)} ({monthComparison.month1.name})
                </p>
                <p className="text-sm font-medium mt-2">
                  Diferença: <span className={monthComparison.incomeDiff >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatCurrency(monthComparison.incomeDiff)}
                  </span>
                </p>
              </div>

              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">Despesas</span>
                  {getChangeIcon(monthComparison.expenseChange, true)}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold">{formatCurrency(monthComparison.month2.expense)}</span>
                  {getChangeBadge(monthComparison.expenseChange, true)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  vs {formatCurrency(monthComparison.month1.expense)} ({monthComparison.month1.name})
                </p>
                <p className="text-sm font-medium mt-2">
                  Diferença: <span className={monthComparison.expenseDiff <= 0 ? "text-green-600" : "text-red-600"}>
                    {formatCurrency(monthComparison.expenseDiff)}
                  </span>
                </p>
              </div>

              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">Lucro</span>
                  {getChangeIcon(monthComparison.profitChange)}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold">{formatCurrency(monthComparison.month2.profit)}</span>
                  {getChangeBadge(monthComparison.profitChange)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  vs {formatCurrency(monthComparison.month1.profit)} ({monthComparison.month1.name})
                </p>
                <p className="text-sm font-medium mt-2">
                  Diferença: <span className={monthComparison.profitDiff >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatCurrency(monthComparison.profitDiff)}
                  </span>
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo Mensal Completo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Receitas</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Pendentes</TableHead>
                  <TableHead className="text-right">Transações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlySummaries.map((month, index) => {
                  const prevMonth = index > 0 ? monthlySummaries[index - 1] : null;
                  const profitChange = prevMonth && prevMonth.profit !== 0 
                    ? ((month.profit - prevMonth.profit) / Math.abs(prevMonth.profit)) * 100 
                    : 0;

                  return (
                    <TableRow key={month.month} className={month.transactionCount === 0 ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{month.name}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(month.income)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(month.expense)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className={month.profit >= 0 ? "text-blue-600" : "text-red-600"}>
                            {formatCurrency(month.profit)}
                          </span>
                          {prevMonth && month.transactionCount > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ({formatPercent(profitChange)})
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-yellow-600">{formatCurrency(month.pending)}</TableCell>
                      <TableCell className="text-right">{month.transactionCount}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>TOTAL ANO</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(yearTotals.income)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatCurrency(yearTotals.expense)}</TableCell>
                  <TableCell className="text-right text-blue-600">{formatCurrency(yearTotals.profit)}</TableCell>
                  <TableCell className="text-right text-yellow-600">{formatCurrency(yearTotals.pending)}</TableCell>
                  <TableCell className="text-right">{yearTotals.transactionCount}</TableCell>
                </TableRow>
                <TableRow className="bg-muted/30">
                  <TableCell className="font-medium">MÉDIA MENSAL</TableCell>
                  <TableCell className="text-right">{formatCurrency(monthAverages.income)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(monthAverages.expense)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(monthAverages.profit)}</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">-</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Cumulative Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Evolução Acumulada - {filterYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulativeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="receitasAcumuladas" 
                  name="Receitas Acumuladas" 
                  stroke={COLORS.income} 
                  strokeWidth={2}
                  dot={{ fill: COLORS.income }}
                />
                <Line 
                  type="monotone" 
                  dataKey="despesasAcumuladas" 
                  name="Despesas Acumuladas" 
                  stroke={COLORS.expense} 
                  strokeWidth={2}
                  dot={{ fill: COLORS.expense }}
                />
                <Line 
                  type="monotone" 
                  dataKey="lucroAcumulado" 
                  name="Lucro Acumulado" 
                  stroke={COLORS.profit} 
                  strokeWidth={3}
                  dot={{ fill: COLORS.profit }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Growth Rate Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Taxa de Crescimento Mensal (%)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={growthData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Legend />
                <Bar 
                  dataKey="crescimentoReceita" 
                  name="Crescimento Receita" 
                  fill={COLORS.income} 
                  radius={[4, 4, 0, 0]} 
                />
                <Bar 
                  dataKey="crescimentoDespesa" 
                  name="Crescimento Despesa" 
                  fill={COLORS.expense} 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};
