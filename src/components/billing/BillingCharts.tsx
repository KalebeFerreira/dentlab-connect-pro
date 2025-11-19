import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Service } from "@/pages/Billing";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface BillingChartsProps {
  services: Service[];
}

export const BillingCharts = ({ services }: BillingChartsProps) => {
  const getMonthlyData = () => {
    const monthlyData: { [key: string]: number } = {};

    services.forEach((service) => {
      const date = new Date(service.service_date);
      const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;

      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = 0;
      }

      monthlyData[monthYear] += Number(service.service_value);
    });

    return Object.entries(monthlyData)
      .map(([month, value]) => ({
        month,
        valor: value,
      }))
      .sort((a, b) => {
        const [monthA, yearA] = a.month.split("/");
        const [monthB, yearB] = b.month.split("/");
        return (
          new Date(parseInt(yearA), parseInt(monthA) - 1).getTime() -
          new Date(parseInt(yearB), parseInt(monthB) - 1).getTime()
        );
      });
  };

  const data = getMonthlyData();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Faturamento Mensal (Área)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis 
                dataKey="month" 
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                stroke="hsl(var(--border))"
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                stroke="hsl(var(--border))"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))'
                }}
                formatter={(value: number) =>
                  value.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })
                }
              />
              <Legend 
                wrapperStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Area
                type="monotone"
                dataKey="valor"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                fill="url(#colorValor)"
                name="Faturamento"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Faturamento Mensal (Barras)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data}>
              <defs>
                <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.9}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.6}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis 
                dataKey="month"
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                stroke="hsl(var(--border))"
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                stroke="hsl(var(--border))"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))'
                }}
                formatter={(value: number) =>
                  value.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })
                }
              />
              <Legend 
                wrapperStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar 
                dataKey="valor" 
                fill="url(#colorBar)"
                name="Faturamento"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
