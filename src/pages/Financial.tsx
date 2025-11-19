import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, DollarSign, TrendingUp, TrendingDown, Plus } from "lucide-react";
import { TransactionForm } from "@/components/TransactionForm";
import { TransactionList } from "@/components/TransactionList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadTransactions();
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
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Controle Financeiro</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie receitas, despesas e acompanhe seu lucro
              </p>
            </div>
            {!showForm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Transação
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Filters */}
        <div className="flex gap-4">
          <div className="w-48">
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
          <div className="w-32">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receitas</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {income.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Confirmadas</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Despesas</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                R$ {expense.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Confirmadas</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                R$ {profit.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Receitas - Despesas</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <DollarSign className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                R$ {pending.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Aguardando confirmação</p>
            </CardContent>
          </Card>
        </div>

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
      </main>
    </div>
  );
};
export default Financial;