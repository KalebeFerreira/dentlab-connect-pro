import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Calendar, CheckCircle2, AlertTriangle, XCircle, Clock, Receipt, ExternalLink, Loader2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Subscription {
  id: string;
  status: string;
  plan_name: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  trial_ends_at: string | null;
}

interface PixPayment {
  id: string;
  mercadopago_payment_id: string;
  plan_key: string;
  billing_cycle: string;
  original_amount: number;
  discounted_amount: number;
  status: string;
  paid_at: string | null;
  expires_at: string | null;
  created_at: string;
  ticket_url: string | null;
  subscription_end: string | null;
}

const PLAN_LABELS: Record<string, string> = {
  basic: "Básico",
  professional: "Profissional",
  premium: "Premium",
  super_premium: "Super Premium",
};

const planLabel = (key: string) => PLAN_LABELS[key] ?? key;

type SubStatus =
  | { kind: "active"; daysLeft: number; endsAt: Date }
  | { kind: "trial"; daysLeft: number; endsAt: Date }
  | { kind: "expiring_soon"; daysLeft: number; endsAt: Date }
  | { kind: "expired"; endsAt: Date }
  | { kind: "pending"; pendingPayment: PixPayment }
  | { kind: "canceled"; endsAt: Date | null }
  | { kind: "none" };

const computeStatus = (sub: Subscription | null, payments: PixPayment[]): SubStatus => {
  const pending = payments.find((p) => p.status === "pending" && p.expires_at && new Date(p.expires_at) > new Date());

  if (!sub) {
    if (pending) return { kind: "pending", pendingPayment: pending };
    return { kind: "none" };
  }

  const endsAt = sub.current_period_end ? new Date(sub.current_period_end) : null;
  const daysLeft = endsAt ? differenceInDays(endsAt, new Date()) : 0;

  if (sub.status === "trialing" && sub.trial_ends_at) {
    const trialEnd = new Date(sub.trial_ends_at);
    return { kind: "trial", daysLeft: differenceInDays(trialEnd, new Date()), endsAt: trialEnd };
  }

  if (sub.status === "active" && endsAt) {
    if (endsAt < new Date()) return { kind: "expired", endsAt };
    if (daysLeft <= 5) return { kind: "expiring_soon", daysLeft, endsAt };
    return { kind: "active", daysLeft, endsAt };
  }

  if (sub.status === "canceled") return { kind: "canceled", endsAt };
  if (pending) return { kind: "pending", pendingPayment: pending };
  return { kind: "expired", endsAt: endsAt ?? new Date() };
};

const StatusCard = ({ status }: { status: SubStatus }) => {
  const navigate = useNavigate();

  const map = {
    active: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-500/10", border: "border-green-500/30", label: "Ativa" },
    trial: { icon: Clock, color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-500/30", label: "Período de Teste" },
    expiring_soon: { icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-500/10", border: "border-yellow-500/30", label: "Vence em breve" },
    expired: { icon: XCircle, color: "text-red-600", bg: "bg-red-500/10", border: "border-red-500/30", label: "Vencida" },
    pending: { icon: Clock, color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-500/30", label: "Em análise" },
    canceled: { icon: XCircle, color: "text-gray-600", bg: "bg-gray-500/10", border: "border-gray-500/30", label: "Cancelada" },
    none: { icon: Crown, color: "text-muted-foreground", bg: "bg-muted", border: "border-border", label: "Sem assinatura" },
  } as const;

  const cfg = map[status.kind];
  const Icon = cfg.icon;

  return (
    <Card className={`${cfg.bg} ${cfg.border} border-2`}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className={`${cfg.bg} ${cfg.color} p-3 rounded-full border ${cfg.border}`}>
            <Icon className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <Badge className={`${cfg.bg} ${cfg.color} ${cfg.border} mb-2`}>{cfg.label}</Badge>

            {status.kind === "active" && (
              <>
                <h2 className="text-2xl font-bold">Sua assinatura está ativa 🎉</h2>
                <p className="text-muted-foreground mt-1">
                  Renova em <strong>{format(status.endsAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</strong>
                  {" "}({status.daysLeft} dias restantes)
                </p>
              </>
            )}

            {status.kind === "trial" && (
              <>
                <h2 className="text-2xl font-bold">Período de teste gratuito</h2>
                <p className="text-muted-foreground mt-1">
                  Termina em <strong>{format(status.endsAt, "dd/MM/yyyy", { locale: ptBR })}</strong>
                  {" "}({status.daysLeft} dias restantes)
                </p>
              </>
            )}

            {status.kind === "expiring_soon" && (
              <>
                <h2 className="text-2xl font-bold">⚠️ Sua assinatura vence em breve</h2>
                <p className="text-muted-foreground mt-1">
                  Restam apenas <strong>{status.daysLeft} {status.daysLeft === 1 ? "dia" : "dias"}</strong>.
                  Renove agora para evitar interrupção.
                </p>
                <Button onClick={() => navigate("/planos")} className="mt-3" size="sm">Renovar agora</Button>
              </>
            )}

            {status.kind === "expired" && (
              <>
                <h2 className="text-2xl font-bold">Assinatura vencida</h2>
                <p className="text-muted-foreground mt-1">
                  Venceu em <strong>{format(status.endsAt, "dd/MM/yyyy", { locale: ptBR })}</strong>
                  {" "}({formatDistanceToNow(status.endsAt, { locale: ptBR, addSuffix: true })})
                </p>
                <Button onClick={() => navigate("/planos")} className="mt-3" size="sm">Reativar assinatura</Button>
              </>
            )}

            {status.kind === "pending" && (
              <>
                <h2 className="text-2xl font-bold">Pagamento em análise</h2>
                <p className="text-muted-foreground mt-1">
                  Aguardando confirmação do PIX no valor de{" "}
                  <strong>R$ {status.pendingPayment.discounted_amount.toFixed(2)}</strong>.
                  A assinatura ativa automaticamente após o pagamento.
                </p>
                {status.pendingPayment.ticket_url && (
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <a href={status.pendingPayment.ticket_url} target="_blank" rel="noreferrer">
                      Ver QR Code <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                )}
              </>
            )}

            {status.kind === "canceled" && (
              <>
                <h2 className="text-2xl font-bold">Assinatura cancelada</h2>
                <p className="text-muted-foreground mt-1">
                  {status.endsAt
                    ? `Acesso até ${format(status.endsAt, "dd/MM/yyyy", { locale: ptBR })}`
                    : "Reative quando quiser."}
                </p>
                <Button onClick={() => navigate("/planos")} className="mt-3" size="sm">Reativar</Button>
              </>
            )}

            {status.kind === "none" && (
              <>
                <h2 className="text-2xl font-bold">Você ainda não tem assinatura</h2>
                <p className="text-muted-foreground mt-1">Escolha um plano e desbloqueie todos os recursos.</p>
                <Button onClick={() => navigate("/planos")} className="mt-3" size="sm">Ver planos</Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const paymentStatusBadge = (status: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: "Aprovado", cls: "bg-green-500/15 text-green-600 border-green-500/30" },
    pending: { label: "Aguardando", cls: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" },
    rejected: { label: "Rejeitado", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
    cancelled: { label: "Cancelado", cls: "bg-gray-500/15 text-gray-600 border-gray-500/30" },
    in_process: { label: "Processando", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-muted" };
  return <Badge className={cfg.cls}>{cfg.label}</Badge>;
};

export default function MinhaAssinatura() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<PixPayment[]>([]);

  const loadData = async () => {
    if (!user) return;
    const [subRes, payRes] = await Promise.all([
      supabase.from("user_subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("pix_payments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (subRes.error && subRes.error.code !== "PGRST116") {
      toast({ title: "Erro", description: subRes.error.message, variant: "destructive" });
    } else {
      setSubscription((subRes.data as Subscription | null) ?? null);
    }
    if (payRes.error) {
      toast({ title: "Erro", description: payRes.error.message, variant: "destructive" });
    } else {
      setPayments((payRes.data as PixPayment[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    if (!user) return;
    // Realtime: assinatura ativada via webhook
    const channel = supabase
      .channel(`my-sub-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_subscriptions", filter: `user_id=eq.${user.id}` },
        () => loadData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pix_payments", filter: `user_id=eq.${user.id}` },
        () => loadData()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast({ title: "Atualizado!" });
  };

  const status = computeStatus(subscription, payments);
  const lastApproved = payments.find((p) => p.status === "approved");

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Crown className="h-7 w-7 text-primary" /> Minha Assinatura
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Status, plano atual e histórico de pagamentos.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <StatusCard status={status} />

          {/* Detalhes do plano atual */}
          {subscription && (
            <div className="grid sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs flex items-center gap-1">
                    <Crown className="h-3 w-3" /> Plano
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {lastApproved ? planLabel(lastApproved.plan_key) : subscription.plan_name ?? "—"}
                  </div>
                  {lastApproved && (
                    <p className="text-xs text-muted-foreground capitalize">
                      {lastApproved.billing_cycle === "annual" ? "Anual" : "Mensal"}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Início do período
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {subscription.current_period_start
                      ? format(new Date(subscription.current_period_start), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Próxima renovação
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {subscription.current_period_end
                      ? format(new Date(subscription.current_period_end), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Histórico de pagamentos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" /> Histórico de Pagamentos
              </CardTitle>
              <CardDescription>Últimos {payments.length} pagamentos via PIX</CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <CreditCard className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Nenhum pagamento registrado ainda.</p>
                  <Button onClick={() => navigate("/planos")} variant="link" size="sm" className="mt-2">
                    Ver planos disponíveis
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 p-3 border rounded-lg hover:bg-muted/30 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`p-2 rounded-full ${
                          p.status === "approved" ? "bg-green-500/10 text-green-600" :
                          p.status === "pending" ? "bg-yellow-500/10 text-yellow-600" :
                          "bg-red-500/10 text-red-600"
                        }`}>
                          {p.status === "approved" ? <CheckCircle2 className="h-4 w-4" /> :
                           p.status === "pending" ? <Clock className="h-4 w-4" /> :
                           <XCircle className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">
                            {planLabel(p.plan_key)} • {p.billing_cycle === "annual" ? "Anual" : "Mensal"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(p.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            {" • "}ID: {p.mercadopago_payment_id}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="font-bold text-sm">R$ {p.discounted_amount.toFixed(2)}</div>
                        {paymentStatusBadge(p.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
