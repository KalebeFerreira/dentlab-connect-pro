import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Clock, AlertCircle } from "lucide-react";
import type { Service } from "@/pages/Billing";

interface Props {
  services: Service[];
}

const formatBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const PaymentSummaryCards = ({ services }: Props) => {
  const today = new Date().toISOString().split("T")[0];

  const cashIn = services
    .filter((s) => s.paid_at != null || (s.payment_method !== "a_prazo" && s.payment_status === "pago"))
    .reduce((sum, s) => sum + Number(s.service_value || 0), 0);

  const toReceive = services
    .filter(
      (s) =>
        !s.paid_at &&
        s.payment_method === "a_prazo" &&
        (!s.due_date || s.due_date >= today)
    )
    .reduce((sum, s) => sum + Number(s.service_value || 0), 0);

  const overdue = services
    .filter((s) => !s.paid_at && s.due_date != null && s.due_date < today)
    .reduce((sum, s) => sum + Number(s.service_value || 0), 0);

  const cards = [
    {
      title: "Recebido à vista",
      sub: "Já entrou no caixa",
      value: cashIn,
      Icon: Wallet,
      border: "border-green-200",
      color: "text-green-600",
    },
    {
      title: "A receber",
      sub: "A prazo, dentro do vencimento",
      value: toReceive,
      Icon: Clock,
      border: "border-blue-200",
      color: "text-blue-600",
    },
    {
      title: "Vencido",
      sub: "Faturas em atraso",
      value: overdue,
      Icon: AlertCircle,
      border: "border-red-200",
      color: "text-red-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 w-full">
      {cards.map(({ title, sub, value, Icon, border, color }) => (
        <Card key={title} className={`shadow-card overflow-hidden min-w-0 ${border}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-4 md:px-6 gap-2">
            <CardTitle className="text-xs sm:text-sm font-medium truncate min-w-0">
              {title}
            </CardTitle>
            <Icon className={`h-4 w-4 shrink-0 ${color}`} />
          </CardHeader>
          <CardContent className="px-3 sm:px-4 md:px-6 min-w-0">
            <div className={`text-base sm:text-lg md:text-2xl font-bold break-words leading-tight ${color}`}>
              {formatBRL(value)}
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
