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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
      <Card className="shadow-card border-green-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
          <CardTitle className="text-xs md:text-sm font-medium">Recebido à vista</CardTitle>
          <Wallet className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent className="px-3 md:px-6">
          <div className="text-lg md:text-2xl font-bold text-green-600">{formatBRL(cashIn)}</div>
          <p className="text-xs text-muted-foreground">Já entrou no caixa</p>
        </CardContent>
      </Card>

      <Card className="shadow-card border-blue-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
          <CardTitle className="text-xs md:text-sm font-medium">A receber (próx. mês)</CardTitle>
          <Clock className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent className="px-3 md:px-6">
          <div className="text-lg md:text-2xl font-bold text-blue-600">{formatBRL(toReceive)}</div>
          <p className="text-xs text-muted-foreground">A prazo, dentro do vencimento</p>
        </CardContent>
      </Card>

      <Card className="shadow-card border-red-200">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 md:px-6">
          <CardTitle className="text-xs md:text-sm font-medium">Vencido</CardTitle>
          <AlertCircle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent className="px-3 md:px-6">
          <div className="text-lg md:text-2xl font-bold text-red-600">{formatBRL(overdue)}</div>
          <p className="text-xs text-muted-foreground">Faturas em atraso</p>
        </CardContent>
      </Card>
    </div>
  );
};
