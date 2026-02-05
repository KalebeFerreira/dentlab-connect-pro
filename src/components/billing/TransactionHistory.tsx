import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Calendar, Filter, FileSpreadsheet, Download } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import ExcelJS from 'exceljs';

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string | null;
  status: string;
  month: number | null;
  year: number | null;
  created_at: string;
  category: string | null;
}

type FilterPeriod = "all" | "week" | "month" | "year";
type FilterType = "all" | "receipt" | "expense" | "payment";

export const TransactionHistory = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("month");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    loadTransactions();
  }, [filterPeriod, filterType, filterYear, filterMonth]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("financial_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // Apply period filter
      const now = new Date();
      if (filterPeriod === "week") {
        const weekStart = startOfWeek(now, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
        query = query
          .gte("created_at", weekStart.toISOString())
          .lte("created_at", weekEnd.toISOString());
      } else if (filterPeriod === "month") {
        query = query
          .eq("month", filterMonth)
          .eq("year", filterYear);
      } else if (filterPeriod === "year") {
        query = query.eq("year", filterYear);
      }

      // Apply type filter
      if (filterType !== "all") {
        query = query.eq("transaction_type", filterType);
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      receipt: "Receita",
      expense: "Despesa",
      payment: "Pagamento",
      income: "Entrada",
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendente",
      completed: "Confirmado",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const calculateTotals = () => {
    const receipts = transactions
      .filter(t => t.transaction_type === "receipt" && t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = transactions
      .filter(t => (t.transaction_type === "expense" || t.transaction_type === "payment") && t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0);

    return { receipts, expenses, balance: receipts - expenses };
  };

  const { receipts, expenses, balance } = calculateTotals();

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Histórico de Transações');
    
    worksheet.addRow(['Histórico de Transações']);
    worksheet.addRow([`Período: ${filterPeriod === 'all' ? 'Todos' : filterPeriod === 'week' ? 'Esta Semana' : filterPeriod === 'month' ? `${format(new Date(filterYear, filterMonth - 1), 'MMMM yyyy', { locale: ptBR })}` : filterYear}`]);
    worksheet.addRow([`Total Receitas: ${formatCurrency(receipts)}`]);
    worksheet.addRow([`Total Despesas: ${formatCurrency(expenses)}`]);
    worksheet.addRow([`Saldo: ${formatCurrency(balance)}`]);
    worksheet.addRow([]);
    
    worksheet.addRow(['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Status']);
    
    transactions.forEach(transaction => {
      worksheet.addRow([
        format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
        getTransactionLabel(transaction.transaction_type),
        transaction.description || '-',
        transaction.category || '-',
        transaction.amount,
        getStatusLabel(transaction.status)
      ]);
    });

    worksheet.columns = [
      { width: 18 },
      { width: 12 },
      { width: 35 },
      { width: 15 },
      { width: 15 },
      { width: 12 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historico_transacoes_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Histórico de Transações
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={filterPeriod} onValueChange={(v) => setFilterPeriod(v as FilterPeriod)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mês</SelectItem>
              <SelectItem value="year">Ano</SelectItem>
            </SelectContent>
          </Select>

          {filterPeriod === "month" && (
            <Select value={filterMonth.toString()} onValueChange={(v) => setFilterMonth(parseInt(v))}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...Array(12)].map((_, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>
                    {format(new Date(2000, i), 'MMMM', { locale: ptBR })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {(filterPeriod === "month" || filterPeriod === "year") && (
            <Select value={filterYear.toString()} onValueChange={(v) => setFilterYear(parseInt(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="receipt">Receitas</SelectItem>
              <SelectItem value="expense">Despesas</SelectItem>
              <SelectItem value="payment">Pagamentos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Receitas</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(receipts)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Despesas</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(expenses)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className={`text-lg font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(balance)}
            </p>
          </div>
        </div>

        {/* Transaction List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhuma transação encontrada para o período selecionado.
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      transaction.transaction_type === "receipt" || transaction.transaction_type === "income"
                        ? "bg-green-100"
                        : "bg-red-100"
                    }`}
                  >
                    {transaction.transaction_type === "receipt" || transaction.transaction_type === "income" ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate max-w-[200px]">
                      {transaction.description || getTransactionLabel(transaction.transaction_type)}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(transaction.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${getStatusColor(transaction.status)}`}>
                        {getStatusLabel(transaction.status)}
                      </span>
                    </div>
                  </div>
                </div>
                <p
                  className={`text-sm font-bold ${
                    transaction.transaction_type === "receipt" || transaction.transaction_type === "income"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {transaction.transaction_type === "receipt" || transaction.transaction_type === "income" ? "+" : "-"}
                  {formatCurrency(transaction.amount)}
                </p>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Exibindo até 100 transações
        </p>
      </CardContent>
    </Card>
  );
};
