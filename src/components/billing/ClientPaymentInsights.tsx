import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, AlertTriangle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ClientInsight {
  client_name: string;
  total_invoices: number;
  paid_on_time: number;
  paid_late: number;
  open_overdue: number;
  open_overdue_amount: number;
  total_amount: number;
  on_time_rate: number;
  classification: "bom_pagador" | "inadimplente" | "regular";
}

const formatBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const ClientPaymentInsights = () => {
  const [insights, setInsights] = useState<ClientInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.rpc("get_client_payment_insights", { p_user_id: user.id });
      if (error) throw error;
      setInsights((data as ClientInsight[]) || []);
    } catch (e) {
      console.error("insights error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("client-insights")
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const goodPayers = insights.filter((i) => i.classification === "bom_pagador").slice(0, 8);
  const delinquents = insights.filter((i) => i.classification === "inadimplente").slice(0, 8);

  const sendWhatsApp = (clientName: string, amount: number) => {
    const msg = `Olá ${clientName}, tudo bem? Identificamos faturas em aberto no valor de ${formatBRL(amount)}. Pode confirmar a data de pagamento? Obrigado!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">Carregando análise de clientes...</CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            Bons Pagadores
            <Badge variant="secondary">{goodPayers.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {goodPayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há clientes com histórico suficiente para classificar.</p>
          ) : (
            <ul className="space-y-2">
              {goodPayers.map((c) => (
                <li key={c.client_name} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium">{c.client_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.paid_on_time}/{c.total_invoices} pagas em dia · {c.on_time_rate}%
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-green-700">{formatBRL(c.total_amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Inadimplentes
            <Badge variant="destructive">{delinquents.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {delinquents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cliente com faturas vencidas há mais de 15 dias. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {delinquents.map((c) => (
                <li key={c.client_name} className="flex items-center justify-between gap-2 border-b pb-2 last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.client_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.open_overdue} fatura(s) vencida(s) · em dia: {c.on_time_rate}%
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-red-700">{formatBRL(c.open_overdue_amount)}</span>
                    <Button size="sm" variant="outline" onClick={() => sendWhatsApp(c.client_name, c.open_overdue_amount)}>
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Cobrar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
