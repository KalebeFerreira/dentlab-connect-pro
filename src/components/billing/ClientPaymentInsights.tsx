import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, AlertTriangle, Send, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [clientToSettle, setClientToSettle] = useState<ClientInsight | null>(null);
  const [settling, setSettling] = useState(false);

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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reloadSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 350);
    };
    const channel = supabase
      .channel("client-insights")
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, reloadSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "financial_transactions" }, reloadSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "client_payment_profiles" }, reloadSoon)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  const goodPayers = insights.filter((i) => i.classification === "bom_pagador").slice(0, 8);
  const delinquents = insights.filter((i) => i.classification === "inadimplente").slice(0, 8);

  const sendWhatsApp = (clientName: string, amount: number) => {
    const msg = `Olá ${clientName}, tudo bem? Identificamos faturas em aberto no valor de ${formatBRL(amount)}. Pode confirmar a data de pagamento? Obrigado!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const settleOverdueInvoices = async () => {
    if (!clientToSettle || settling) return;
    setSettling(true);
    try {
      const { data, error } = await supabase.rpc("mark_client_overdue_paid", {
        p_client_name: clientToSettle.client_name,
      });
      if (error) throw error;

      const result = data?.[0];
      if (!result || result.updated_count === 0) {
        toast.info("Nenhuma cobrança vencida estava em aberto");
      } else {
        toast.success(
          `${result.updated_count} cobrança${result.updated_count === 1 ? "" : "s"} marcada${result.updated_count === 1 ? "" : "s"} como paga${result.updated_count === 1 ? "" : "s"}`
        );
      }
      setClientToSettle(null);
      await load();
    } catch (error) {
      console.error("settle overdue invoices error", error);
      toast.error("Não foi possível retirar o cliente da inadimplência");
    } finally {
      setSettling(false);
    }
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
                <li key={c.client_name} className="flex flex-col gap-2 border-b pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.client_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.open_overdue} fatura(s) vencida(s) · em dia: {c.on_time_rate}%
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="text-sm font-semibold text-red-700">{formatBRL(c.open_overdue_amount)}</span>
                    <Button size="sm" variant="outline" onClick={() => sendWhatsApp(c.client_name, c.open_overdue_amount)}>
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Cobrar
                    </Button>
                    <Button size="sm" onClick={() => setClientToSettle(c)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Marcar como pago
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(clientToSettle)} onOpenChange={(open) => !open && !settling && setClientToSettle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar cobranças vencidas?</AlertDialogTitle>
            <AlertDialogDescription>
              {clientToSettle && (
                <>
                  Serão marcadas como pagas {clientToSettle.open_overdue} cobrança(s) vencida(s) de <strong>{clientToSettle.client_name}</strong>, no total de <strong>{formatBRL(clientToSettle.open_overdue_amount)}</strong>. O cliente continuará ativo e todo o histórico será preservado.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={settling}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={settleOverdueInvoices} disabled={settling}>
              {settling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar pagamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
