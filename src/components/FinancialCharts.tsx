import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, PieChart as PieChartIcon } from "lucide-react";

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

interface FinancialChartsProps {
  transactions: Transaction[];
  filterYear: number;
}

const COLORS = {
  income: "hsl(142, 76%, 36%)",
  expense: "hsl(0, 72%, 51%)",
  pending: "hsl(45, 93%, 47%)",
  profit: "hsl(217, 91%, 60%)"
};

const monthNames = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

export const FinancialCharts = ({ transactions, filterYear }: FinancialChartsProps) => {
  // Calculate monthly data for the bar chart
  const monthlyData = monthNames.map((name, index) => {
    const month = index + 1;
    const monthTransactions = transactions.filter(t => t.month === month && t.year === filterYear);
    
    const income = monthTransactions
      .filter(t => t.transaction_type === "receipt" && t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expense = monthTransactions
      .filter(t => t.transaction_type === "payment" && t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0);
    
    return {
      name,
      month,
      receitas: income,
      despesas: expense,
      lucro: income - expense
    };
  });

  // Calculate totals for pie chart
  const totalIncome = transactions
    .filter(t => t.transaction_type === "receipt" && t.status === "completed")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.transaction_type === "payment" && t.status === "completed")
    .reduce((sum, t) => sum + t.amount, 0);

  const pieData = [
    { name: "Receitas", value: totalIncome, color: COLORS.income },
    { name: "Despesas", value: totalExpense, color: COLORS.expense }
  ];

  const chartConfig = {
    receitas: {
      label: "Receitas",
      color: COLORS.income
    },
    despesas: {
      label: "Despesas",
      color: COLORS.expense
    },
    lucro: {
      label: "Lucro",
      color: COLORS.profit
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Bar Chart - Receitas vs Despesas por Mês */}
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <TrendingDown className="h-5 w-5 text-red-600" />
            Receitas vs Despesas - {filterYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
                <Bar 
                  dataKey="receitas" 
                  name="Receitas"
                  fill={COLORS.income} 
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  dataKey="despesas" 
                  name="Despesas"
                  fill={COLORS.expense} 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Pie Chart - Distribuição */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-primary" />
            Distribuição Total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  formatter={(value: number) => formatCurrency(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.income }} />
              <span className="text-sm">{formatCurrency(totalIncome)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.expense }} />
              <span className="text-sm">{formatCurrency(totalExpense)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lucro por Mês */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Lucro Mensal - {filterYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar 
                  dataKey="lucro" 
                  name="Lucro"
                  fill={COLORS.profit}
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
