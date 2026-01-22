import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Lightbulb, 
  PartyPopper,
  PiggyBank,
  Target,
  Scissors,
  AlertCircle,
  CheckCircle2
} from "lucide-react";

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  status: string;
  month: number;
  year: number;
  category?: string;
}

interface FinancialInsightsProps {
  transactions: Transaction[];
  allYearTransactions: Transaction[];
  currentMonth: number;
  currentYear: number;
}

interface Insight {
  type: "warning" | "success" | "tip" | "info";
  icon: React.ReactNode;
  title: string;
  description: string;
}

export const FinancialInsights = ({
  transactions,
  allYearTransactions,
  currentMonth,
  currentYear,
}: FinancialInsightsProps) => {
  const insights = useMemo(() => {
    const results: Insight[] = [];

    // Calculate current month totals
    const currentIncome = transactions
      .filter((t) => t.transaction_type === "receipt" && t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0);

    const currentExpense = transactions
      .filter((t) => t.transaction_type === "payment" && t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0);

    const currentProfit = currentIncome - currentExpense;

    // Calculate previous month totals
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    
    const prevMonthTransactions = allYearTransactions.filter(
      (t) => t.month === prevMonth && t.year === prevYear
    );

    const prevIncome = prevMonthTransactions
      .filter((t) => t.transaction_type === "receipt" && t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0);

    const prevExpense = prevMonthTransactions
      .filter((t) => t.transaction_type === "payment" && t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0);

    const prevProfit = prevIncome - prevExpense;

    // Calculate expense ratio
    const expenseRatio = currentIncome > 0 ? (currentExpense / currentIncome) * 100 : 0;

    // Group expenses by category
    const expensesByCategory = transactions
      .filter((t) => t.transaction_type === "payment" && t.status === "completed")
      .reduce((acc, t) => {
        const category = t.category || "outros";
        acc[category] = (acc[category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>);

    // Find highest expense category
    const sortedCategories = Object.entries(expensesByCategory).sort(
      ([, a], [, b]) => b - a
    );
    const highestCategory = sortedCategories[0];

    // Calculate year average
    const yearExpenses = allYearTransactions
      .filter((t) => t.transaction_type === "payment" && t.status === "completed");
    const yearAvgExpense = yearExpenses.length > 0
      ? yearExpenses.reduce((sum, t) => sum + t.amount, 0) / 
        new Set(yearExpenses.map(t => `${t.month}-${t.year}`)).size
      : 0;

    // Generate insights based on analysis

    // 1. Excessive expense warning
    if (expenseRatio > 80 && currentIncome > 0) {
      results.push({
        type: "warning",
        icon: <AlertTriangle className="h-5 w-5" />,
        title: "⚠️ Gastos Excessivos!",
        description: `Suas despesas representam ${expenseRatio.toFixed(0)}% da receita este mês. Considere revisar seus gastos para manter uma margem saudável de pelo menos 20%.`,
      });
    }

    // 2. Negative profit warning
    if (currentProfit < 0 && currentIncome > 0) {
      results.push({
        type: "warning",
        icon: <TrendingDown className="h-5 w-5" />,
        title: "📉 Prejuízo no Mês",
        description: `Você está no vermelho em R$ ${Math.abs(currentProfit).toFixed(2)}. Analise as despesas e busque formas de aumentar a receita ou cortar custos.`,
      });
    }

    // 3. Praise for good savings
    if (expenseRatio <= 50 && currentIncome > 0 && currentExpense > 0) {
      results.push({
        type: "success",
        icon: <PartyPopper className="h-5 w-5" />,
        title: "🎉 Excelente Economia!",
        description: `Parabéns! Suas despesas são apenas ${expenseRatio.toFixed(0)}% da receita. Continue assim! Você está mantendo uma margem saudável de lucro.`,
      });
    }

    // 4. Profit growth praise
    if (prevProfit > 0 && currentProfit > prevProfit) {
      const growth = ((currentProfit - prevProfit) / prevProfit) * 100;
      if (growth > 10) {
        results.push({
          type: "success",
          icon: <TrendingUp className="h-5 w-5" />,
          title: "📈 Lucro Crescendo!",
          description: `Seu lucro aumentou ${growth.toFixed(0)}% em relação ao mês anterior. Ótimo trabalho!`,
        });
      }
    }

    // 5. High spending in specific category
    if (highestCategory && currentExpense > 0) {
      const categoryPercent = (highestCategory[1] / currentExpense) * 100;
      const categoryLabels: Record<string, string> = {
        materials: "Materiais",
        fixed_costs: "Contas Fixas",
        suppliers: "Fornecedores",
        equipment: "Equipamentos",
        salaries: "Salários",
        marketing: "Marketing",
        outros: "Outros",
      };
      
      if (categoryPercent > 50) {
        results.push({
          type: "tip",
          icon: <Scissors className="h-5 w-5" />,
          title: `💡 Maior Gasto: ${categoryLabels[highestCategory[0]] || highestCategory[0]}`,
          description: `${categoryPercent.toFixed(0)}% das suas despesas são com ${(categoryLabels[highestCategory[0]] || highestCategory[0]).toLowerCase()}. Considere negociar melhores condições ou buscar alternativas.`,
        });
      }
    }

    // 6. Expense above year average
    if (yearAvgExpense > 0 && currentExpense > yearAvgExpense * 1.3) {
      const aboveAvg = ((currentExpense - yearAvgExpense) / yearAvgExpense) * 100;
      results.push({
        type: "warning",
        icon: <AlertCircle className="h-5 w-5" />,
        title: "📊 Acima da Média",
        description: `Suas despesas estão ${aboveAvg.toFixed(0)}% acima da média anual (R$ ${yearAvgExpense.toFixed(2)}). Verifique se há gastos extraordinários ou oportunidades de redução.`,
      });
    }

    // 7. Expense below year average - praise
    if (yearAvgExpense > 0 && currentExpense < yearAvgExpense * 0.8 && currentExpense > 0) {
      const belowAvg = ((yearAvgExpense - currentExpense) / yearAvgExpense) * 100;
      results.push({
        type: "success",
        icon: <PiggyBank className="h-5 w-5" />,
        title: "🐷 Economia Notável!",
        description: `Você gastou ${belowAvg.toFixed(0)}% menos que sua média anual. Continue assim para construir uma reserva financeira!`,
      });
    }

    // 8. Cost cutting tips based on categories
    if (expensesByCategory.materials && expensesByCategory.materials > currentExpense * 0.3) {
      results.push({
        type: "tip",
        icon: <Lightbulb className="h-5 w-5" />,
        title: "💰 Dica de Economia em Materiais",
        description: "Considere comprar materiais em maior quantidade para obter descontos, ou busque fornecedores alternativos para comparar preços.",
      });
    }

    if (expensesByCategory.fixed_costs && expensesByCategory.fixed_costs > currentExpense * 0.4) {
      results.push({
        type: "tip",
        icon: <Target className="h-5 w-5" />,
        title: "🎯 Renegociar Contas Fixas",
        description: "Suas contas fixas representam uma parte significativa. Considere renegociar contratos de aluguel, internet, ou planos de serviços.",
      });
    }

    // 9. Consistent profit praise
    const profitableMonths = allYearTransactions
      .reduce((acc, t) => {
        const key = `${t.month}-${t.year}`;
        if (!acc[key]) acc[key] = { income: 0, expense: 0 };
        if (t.transaction_type === "receipt" && t.status === "completed") {
          acc[key].income += t.amount;
        } else if (t.transaction_type === "payment" && t.status === "completed") {
          acc[key].expense += t.amount;
        }
        return acc;
      }, {} as Record<string, { income: number; expense: number }>);

    const consecutiveProfitMonths = Object.values(profitableMonths)
      .filter((m) => m.income > m.expense).length;

    if (consecutiveProfitMonths >= 3) {
      results.push({
        type: "success",
        icon: <CheckCircle2 className="h-5 w-5" />,
        title: "🏆 Consistência Financeira!",
        description: `Você teve lucro em ${consecutiveProfitMonths} meses este ano. Sua gestão financeira está no caminho certo!`,
      });
    }

    // Limit to top 4 insights
    return results.slice(0, 4);
  }, [transactions, allYearTransactions, currentMonth, currentYear]);

  if (insights.length === 0) {
    return null;
  }

  const getAlertVariant = (type: Insight["type"]) => {
    switch (type) {
      case "warning":
        return "destructive";
      default:
        return "default";
    }
  };

  const getAlertClasses = (type: Insight["type"]) => {
    switch (type) {
      case "success":
        return "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400 [&>svg]:text-green-600";
      case "tip":
        return "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400 [&>svg]:text-blue-600";
      case "info":
        return "border-primary/50 bg-primary/10 text-primary [&>svg]:text-primary";
      default:
        return "";
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Insights Financeiros
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight, index) => (
          <Alert
            key={index}
            variant={getAlertVariant(insight.type)}
            className={getAlertClasses(insight.type)}
          >
            {insight.icon}
            <AlertTitle className="text-sm font-semibold">
              {insight.title}
            </AlertTitle>
            <AlertDescription className="text-xs mt-1">
              {insight.description}
            </AlertDescription>
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
};
