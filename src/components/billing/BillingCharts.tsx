import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Service } from "@/pages/Billing";
import {
  LineChart,
  Line,
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
          <CardTitle>Faturamento Mensal (Linha)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                formatter={(value: number) =>
                  value.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })
                }
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="valor"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                name="Faturamento"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Faturamento Mensal (Barras)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                formatter={(value: number) =>
                  value.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })
                }
              />
              <Legend />
              <Bar dataKey="valor" fill="hsl(var(--primary))" name="Faturamento" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
