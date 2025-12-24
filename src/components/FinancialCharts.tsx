import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { TrendingUp, TrendingDown, PieChart as PieChartIcon, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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

const CLIENT_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(142, 76%, 36%)",
  "hsl(280, 65%, 60%)",
  "hsl(25, 95%, 53%)",
  "hsl(340, 82%, 52%)",
  "hsl(180, 70%, 45%)"
];

const monthNames = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

export const FinancialCharts = ({ transactions, filterYear }: FinancialChartsProps) => {
  const [selectedClient, setSelectedClient] = useState<string>("all");

  // Extract unique clients from descriptions
  const clients = useMemo(() => {
    const clientSet = new Set<string>();
    transactions.forEach(t => {
      if (t.description) {
        // Extract client name from description patterns
        const clientMatch = t.description.match(/Cliente:\s*([^-]+)/i);
        if (clientMatch) {
          clientSet.add(clientMatch[1].trim());
        } else {
          // Use first part of description as client identifier
          const firstPart = t.description.split(' - ')[0].trim();
          if (firstPart.length > 2) {
            clientSet.add(firstPart);
          }
        }
      }
    });
    return Array.from(clientSet).sort();
  }, [transactions]);

  // Filter transactions by selected client
  const filteredTransactions = useMemo(() => {
    if (selectedClient === "all") return transactions;
    return transactions.filter(t => 
      t.description?.toLowerCase().includes(selectedClient.toLowerCase())
    );
  }, [transactions, selectedClient]);

  // Calculate monthly data for the bar chart
  const monthlyData = monthNames.map((name, index) => {
    const month = index + 1;
    const monthTransactions = filteredTransactions.filter(t => t.month === month && t.year === filterYear);
    
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

  // Calculate client evolution data (top 5 clients by total)
  const clientEvolutionData = useMemo(() => {
    // Get totals per client
    const clientTotals: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.transaction_type === "receipt" && t.status === "completed") {
        const clientMatch = t.description?.match(/Cliente:\s*([^-]+)/i);
        const clientName = clientMatch ? clientMatch[1].trim() : (t.description?.split(' - ')[0]?.trim() || 'Outros');
        clientTotals[clientName] = (clientTotals[clientName] || 0) + t.amount;
      }
    });

    // Get top 5 clients
    const topClients = Object.entries(clientTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    // Build monthly data per client
    return monthNames.map((name, index) => {
      const month = index + 1;
      const monthTransactions = transactions.filter(t => 
        t.month === month && t.year === filterYear && 
        t.transaction_type === "receipt" && t.status === "completed"
      );

      const dataPoint: Record<string, any> = { name };
      
      topClients.forEach(client => {
        const clientTotal = monthTransactions
          .filter(t => t.description?.toLowerCase().includes(client.toLowerCase()))
          .reduce((sum, t) => sum + t.amount, 0);
        dataPoint[client] = clientTotal;
      });

      return dataPoint;
    });
  }, [transactions, filterYear]);

  const topClientsForChart = useMemo(() => {
    const clientTotals: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.transaction_type === "receipt" && t.status === "completed") {
        const clientMatch = t.description?.match(/Cliente:\s*([^-]+)/i);
        const clientName = clientMatch ? clientMatch[1].trim() : (t.description?.split(' - ')[0]?.trim() || 'Outros');
        clientTotals[clientName] = (clientTotals[clientName] || 0) + t.amount;
      }
    });
    return Object.entries(clientTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);
  }, [transactions]);

  // Calculate totals for pie chart
  const totalIncome = filteredTransactions
    .filter(t => t.transaction_type === "receipt" && t.status === "completed")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = filteredTransactions
    .filter(t => t.transaction_type === "payment" && t.status === "completed")
    .reduce((sum, t) => sum + t.amount, 0);

  const pieData = [
    { name: "Receitas", value: totalIncome, color: COLORS.income },
    { name: "Despesas", value: totalExpense, color: COLORS.expense }
  ];

  const chartConfig = {
    receitas: { label: "Receitas", color: COLORS.income },
    despesas: { label: "Despesas", color: COLORS.expense },
    lucro: { label: "Lucro", color: COLORS.profit }
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
    <div className="space-y-6">
      {/* Client Filter */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <Label className="text-sm text-muted-foreground mb-2 block">Filtrar por Cliente</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-full sm:w-[250px]">
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients.map(client => (
                    <SelectItem key={client} value={client}>{client}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedClient !== "all" && (
              <div className="text-sm text-muted-foreground">
                Mostrando dados de: <span className="font-medium text-foreground">{selectedClient}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Receitas vs Despesas por Mês */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <TrendingDown className="h-5 w-5 text-red-600" />
              Receitas vs Despesas - {filterYear}
              {selectedClient !== "all" && <span className="text-sm font-normal text-muted-foreground">({selectedClient})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value)} />
                  <ChartTooltip content={<ChartTooltipContent />} formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="receitas" name="Receitas" fill={COLORS.income} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill={COLORS.expense} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Client Evolution Chart */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Evolução por Cliente - Top 5 - {filterYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={clientEvolutionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value)} />
                  <ChartTooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  {topClientsForChart.map((client, index) => (
                    <Line
                      key={client}
                      type="monotone"
                      dataKey={client}
                      name={client}
                      stroke={CLIENT_COLORS[index % CLIENT_COLORS.length]}
                      strokeWidth={2}
                      dot={{ fill: CLIENT_COLORS[index % CLIENT_COLORS.length], strokeWidth: 2 }}
                    />
                  ))}
                </LineChart>
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
              {selectedClient !== "all" && <span className="text-sm font-normal text-muted-foreground">({selectedClient})</span>}
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
                  <ChartTooltip content={<ChartTooltipContent />} formatter={(value: number) => formatCurrency(value)} />
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
              {selectedClient !== "all" && <span className="text-sm font-normal text-muted-foreground">({selectedClient})</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value)} />
                  <ChartTooltip content={<ChartTooltipContent />} formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="lucro" name="Lucro" fill={COLORS.profit} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
