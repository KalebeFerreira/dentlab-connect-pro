import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Plus, Scan, List, BarChart3, GitCompare, History } from "lucide-react";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionList } from "@/components/TransactionList";
import { FinancialDocumentScanner } from "@/components/FinancialDocumentScanner";
import { FinancialCharts } from "@/components/FinancialCharts";
import { FinancialExportOptions } from "@/components/FinancialExportOptions";
import { FinancialComparativeReport } from "@/components/FinancialComparativeReport";
import { FinancialScanHistory } from "@/components/FinancialScanHistory";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFreemiumLimits } from "@/hooks/useFreemiumLimits";

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

const Financial = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allYearTransactions, setAllYearTransactions] = useState<Transaction[]>([]);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState("transactions");
  const [companyName, setCompanyName] = useState("Minha Empresa");
  const [scanHistoryRefresh, setScanHistoryRefresh] = useState(0);
  const { isSubscribed } = useFreemiumLimits();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadTransactions();
      loadAllYearTransactions();
    }
  }, [loading, filterMonth, filterYear]);

  useEffect(() => {
    // Setup realtime subscription for financial transactions
    const channel = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financial_transactions'
        },
        () => {
          loadTransactions();
          loadAllYearTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterMonth, filterYear]);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      
      // Load company name for exports
      const { data: companyInfo } = await supabase
        .from("company_info")
        .select("company_name")
        .eq("user_id", user.id)
        .single();
      
      if (companyInfo?.company_name) {
        setCompanyName(companyInfo.company_name);
      }
    } catch (error) {
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .eq("month", filterMonth)
        .eq("year", filterYear)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Erro ao carregar transações:", error);
    }
  };

  const loadAllYearTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .eq("year", filterYear)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAllYearTransactions(data || []);
    } catch (error) {
      console.error("Erro ao carregar transações do ano:", error);
    }
  };

  const calculateTotals = () => {
    const income = transactions
      .filter((t) => t.transaction_type === "receipt" && t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = transactions
      .filter((t) => t.transaction_type === "payment" && t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0);

    const pending = transactions
      .filter((t) => t.status === "pending")
      .reduce((sum, t) => sum + t.amount, 0);

    return { income, expense, pending, profit: income - expense };
  };

  const { income, expense, pending, profit } = calculateTotals();

  const handleEdit = (transaction: Transaction) => {
    setEditTransaction(transaction);
    setShowForm(true);
    setActiveTab("transactions");
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditTransaction(null);
    loadTransactions();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditTransaction(null);
  };

  const handleScanComplete = () => {
    loadTransactions();
    setScanHistoryRefresh(prev => prev + 1);
  };

  // handleExportPDF removed - now using FinancialExportOptions component

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-bold truncate">Controle Financeiro</h1>
              <p className="text-sm text-muted-foreground hidden sm:block">
                Gerencie receitas, despesas e acompanhe seu lucro
              </p>
            </div>
            <div className="flex gap-2">
              <FinancialExportOptions
                transactions={transactions}
                month={filterMonth}
                year={filterYear}
                income={income}
                expense={expense}
                profit={profit}
                pending={pending}
                companyName={companyName}
              />
              {!showForm && activeTab === "transactions" && (
                <Button onClick={() => setShowForm(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Nova Transação</span>
                  <span className="sm:hidden">Nova</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 md:py-8 space-y-6 md:space-y-8">
        {/* Filters */}
        <div className="flex gap-2 md:gap-4">
          <div className="flex-1 max-w-[180px]">
            <Select
              value={filterMonth.toString()}
              onValueChange={(value) => setFilterMonth(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...Array(12)].map((_, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>
                    {new Date(2000, i).toLocaleString("pt-BR", { month: "long" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-24 md:w-32">
            <Select
              value={filterYear.toString()}
              onValueChange={(value) => setFilterYear(parseInt(value))}
            >
              <SelectTrigger>
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
          </div>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
              <CardTitle className="text-xs md:text-sm font-medium">Receitas</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              <div className="text-lg md:text-2xl font-bold text-green-600">
                R$ {income.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">Confirmadas</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
              <CardTitle className="text-xs md:text-sm font-medium">Despesas</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              <div className="text-lg md:text-2xl font-bold text-red-600">
                R$ {expense.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">Confirmadas</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
              <CardTitle className="text-xs md:text-sm font-medium">Lucro</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              <div className={`text-lg md:text-2xl font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                R$ {profit.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">Líquido</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
              <CardTitle className="text-xs md:text-sm font-medium">Pendentes</CardTitle>
              <DollarSign className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent className="px-3 md:px-6">
              <div className="text-lg md:text-2xl font-bold text-yellow-600">
                R$ {pending.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">Aguardando</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Transactions, Scanner, and Charts */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-3xl grid-cols-5">
            <TabsTrigger value="transactions" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Transações</span>
              <span className="sm:hidden">Lista</span>
            </TabsTrigger>
            <TabsTrigger value="scanner" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <Scan className="h-4 w-4" />
              Scanner
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
              <span className="sm:hidden">Hist.</span>
            </TabsTrigger>
            <TabsTrigger value="charts" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Gráficos</span>
              <span className="sm:hidden">Graf.</span>
            </TabsTrigger>
            <TabsTrigger value="comparative" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
              <GitCompare className="h-4 w-4" />
              <span className="hidden sm:inline">Comparativo</span>
              <span className="sm:hidden">Comp.</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-6">
            {/* Transaction Form */}
            {showForm && (
              <TransactionForm
                onSuccess={handleFormSuccess}
                onCancel={handleFormCancel}
                editTransaction={editTransaction}
              />
            )}

            {/* Transaction List */}
            <TransactionList
              transactions={transactions}
              onEdit={handleEdit}
              onDelete={loadTransactions}
            />
          </TabsContent>

          <TabsContent value="scanner" className="space-y-6">
            <FinancialDocumentScanner
              onTransactionAdd={loadTransactions}
              onScanComplete={handleScanComplete}
              defaultMonth={filterMonth}
              defaultYear={filterYear}
            />
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <FinancialScanHistory refreshTrigger={scanHistoryRefresh} />
          </TabsContent>

          <TabsContent value="charts" className="space-y-6">
            <FinancialCharts 
              transactions={allYearTransactions} 
              filterYear={filterYear}
            />
          </TabsContent>

          <TabsContent value="comparative" className="space-y-6">
            <FinancialComparativeReport 
              transactions={allYearTransactions} 
              filterYear={filterYear}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Financial;
