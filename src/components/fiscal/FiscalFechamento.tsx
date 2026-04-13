import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Calendar, DollarSign, TrendingUp, ExternalLink, AlertTriangle, Info } from "lucide-react";
import { format, addMonths, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const date = new Date();
  date.setMonth(date.getMonth() - i);
  const value = format(date, "yyyy-MM");
  const label = format(date, "MMMM yyyy", { locale: ptBR });
  return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
});

function calcularImposto(faturamento: number): number {
  if (faturamento <= 0) return 0;
  if (faturamento <= 15000) return faturamento * 0.06;
  if (faturamento <= 30000) return faturamento * 0.08;
  return faturamento * 0.10;
}

function getAliquota(faturamento: number): string {
  if (faturamento <= 0) return "0%";
  if (faturamento <= 15000) return "6%";
  if (faturamento <= 30000) return "8%";
  return "10%";
}

export function FiscalFechamento() {
  const { user } = useAuth();
  const [mesSelecionado, setMesSelecionado] = useState(format(new Date(), "yyyy-MM"));
  const [loading, setLoading] = useState(false);
  const [faturamentoTotal, setFaturamentoTotal] = useState(0);
  const [notasCount, setNotasCount] = useState(0);

  const impostoEstimado = useMemo(() => calcularImposto(faturamentoTotal), [faturamentoTotal]);
  const aliquota = useMemo(() => getAliquota(faturamentoTotal), [faturamentoTotal]);

  const vencimento = useMemo(() => {
    const [year, month] = mesSelecionado.split("-").map(Number);
    const mesRef = new Date(year, month - 1, 1);
    const mesSeguinte = addMonths(mesRef, 1);
    return new Date(mesSeguinte.getFullYear(), mesSeguinte.getMonth(), 20);
  }, [mesSelecionado]);

  const diasParaVencimento = useMemo(() => {
    return differenceInDays(vencimento, new Date());
  }, [vencimento]);

  useEffect(() => {
    if (user) fetchFaturamento();
  }, [user, mesSelecionado]);

  const fetchFaturamento = async () => {
    setLoading(true);
    try {
      const [year, month] = mesSelecionado.split("-").map(Number);
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

      const { data, error } = await supabase
        .from("invoices")
        .select("valor")
        .eq("user_id", user!.id)
        .eq("status", "emitida")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (error) throw error;

      const total = (data || []).reduce((sum, inv) => sum + parseFloat(String(inv.valor)), 0);
      setFaturamentoTotal(total);
      setNotasCount(data?.length || 0);

      // Salvar resumo
      const imposto = calcularImposto(total);
      await supabase
        .from("fiscal_summary")
        .upsert({
          user_id: user!.id,
          mes_referencia: mesSelecionado,
          faturamento_total: total,
          imposto_estimado: imposto,
        }, { onConflict: "user_id,mes_referencia" });

    } catch (err) {
      console.error("Erro ao buscar faturamento:", err);
      toast.error("Erro ao calcular fechamento fiscal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Alertas */}
      {diasParaVencimento > 0 && diasParaVencimento <= 10 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent border border-border text-accent-foreground text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Seu imposto vence em <strong>{diasParaVencimento} dias</strong> ({format(vencimento, "dd/MM/yyyy")})</span>
        </div>
      )}
      {diasParaVencimento < 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>O vencimento do imposto referente a este mês já passou ({format(vencimento, "dd/MM/yyyy")})</span>
        </div>
      )}

      {/* Seletor de mês */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Fechamento Fiscal Inteligente
          </CardTitle>
          <CardDescription>Resumo fiscal baseado nas notas emitidas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Mês de referência:</label>
            <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Cards de valores */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  Faturamento Total
                </div>
                <p className="text-2xl font-bold text-foreground">
                  R$ {faturamentoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{notasCount} nota(s) emitida(s)</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  Imposto Estimado
                </div>
                <p className="text-2xl font-bold text-foreground">
                  R$ {impostoEstimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <Badge variant="outline" className="mt-1 text-xs">Alíquota: {aliquota}</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  Vencimento
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {format(vencimento, "dd/MM/yyyy")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {diasParaVencimento > 0 ? `Em ${diasParaVencimento} dias` : diasParaVencimento === 0 ? "Hoje!" : "Vencido"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <ExternalLink className="h-4 w-4" />
                  Gerar Guia
                </div>
                <Button
                  className="mt-2 w-full"
                  onClick={() => window.open("https://www8.receita.fazenda.gov.br/SimplesNacional/", "_blank")}
                >
                  Simples Nacional
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p><strong>Este valor é apenas uma estimativa.</strong> O cálculo real pode variar conforme o regime tributário, anexo e fator R do Simples Nacional. Consulte seu contador para valores exatos.</p>
              <p className="mt-1 text-xs">Faixas utilizadas: até R$ 15.000 → 6% | até R$ 30.000 → 8% | acima → 10%</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
