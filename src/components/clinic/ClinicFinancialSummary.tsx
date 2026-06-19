import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, TrendingDown, Wallet, Clock } from "lucide-react";
import { useHideValues } from "@/hooks/useHideValues";
import { HideValuesToggle } from "@/components/HideValuesToggle";

interface Stats {
  receita: number;
  despesa: number;
  resultado: number;
  aReceber: number;
}

export const ClinicFinancialSummary = () => {
  const navigate = useNavigate();
  const { hidden, toggle } = useHideValues();
  const [stats, setStats] = useState<Stats>({ receita: 0, despesa: 0, resultado: 0, aReceber: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("clinic-financial-summary")
      .on("postgres_changes", { event: "*", schema: "public", table: "financial_transactions" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const load = async () => {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("amount, transaction_type, status, payment_status, month, year")
        .eq("month", month)
        .eq("year", year);
      if (error) throw error;

      let receita = 0, despesa = 0, aReceber = 0;
      (data || []).forEach((t: any) => {
        const amt = Number(t.amount) || 0;
        if (t.status === "cancelled") return;
        if (t.transaction_type === "receipt") {
          if (t.status === "completed" || t.payment_status === "pago") receita += amt;
          else aReceber += amt;
        } else if (t.transaction_type === "expense" && t.status === "completed") {
          despesa += amt;
        }
      });
      setStats({ receita, despesa, resultado: receita - despesa, aReceber });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (v: number) =>
    hidden ? "••••••" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const cards = [
    { label: "Receita do mês", value: stats.receita, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { label: "Despesa do mês", value: stats.despesa, icon: TrendingDown, color: "text-red-600", bg: "bg-red-500/10" },
    { label: "Resultado", value: stats.resultado, icon: Wallet, color: stats.resultado >= 0 ? "text-blue-600" : "text-orange-600", bg: stats.resultado >= 0 ? "bg-blue-500/10" : "bg-orange-500/10" },
    { label: "A receber", value: stats.aReceber, icon: Clock, color: "text-amber-600", bg: "bg-amber-500/10" },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Resumo Financeiro do Mês</CardTitle>
        <div className="flex items-center gap-2">
          <HideValuesToggle hidden={hidden} onToggle={toggle} />
          <Button variant="ghost" size="sm" onClick={() => navigate("/financial")}>
            Ver Financeiro <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((c) => (
            <div key={c.label} className={`rounded-lg p-4 ${c.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <p className={`text-xl font-bold ${c.color}`}>
                {loading ? "..." : fmt(c.value)}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Valores integrados automaticamente de Agendamentos, Ordens de Laboratório, Serviços e Pagamentos a funcionários.
        </p>
      </CardContent>
    </Card>
  );
};
