import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Crown, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSubscription, PLANS } from "@/hooks/useSubscription";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const Planos = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const { subscribed, currentPlan, loading: subLoading, refresh } = useSubscription();

  useEffect(() => {
    checkAuth();
    
    if (searchParams.get("success") === "true") {
      toast({
        title: "Assinatura ativada!",
        description: "Sua assinatura foi ativada com sucesso.",
      });
      refresh();
    }
    
    if (searchParams.get("canceled") === "true") {
      toast({
        title: "Checkout cancelado",
        description: "Você cancelou o processo de checkout.",
        variant: "destructive",
      });
    }
  }, [searchParams]);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
      }
    } catch (error) {
      navigate("/auth");
    }
  };

  const handleSubscribe = async (priceId: string) => {
    try {
      setLoading(priceId);
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });

      if (error) throw error;

      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar o checkout. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setLoading("portal");
      const { data, error } = await supabase.functions.invoke("customer-portal");

      if (error) throw error;

      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error opening portal:", error);
      toast({
        title: "Erro",
        description: "Não foi possível abrir o portal de gerenciamento.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  if (subLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Planos e Assinaturas</h1>
              <p className="text-sm text-muted-foreground">
                Escolha o plano ideal para suas necessidades
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {subscribed && currentPlan && (
          <div className="mb-8 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Plano Atual</p>
                <p className="text-lg font-bold">{currentPlan.name}</p>
              </div>
              <Button
                onClick={handleManageSubscription}
                disabled={loading === "portal"}
                variant="outline"
              >
                {loading === "portal" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Gerenciar Assinatura"
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-4 mb-8">
          <Label htmlFor="billing-toggle" className={!isAnnual ? "font-semibold" : ""}>
            Mensal
          </Label>
          <Switch
            id="billing-toggle"
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
          />
          <Label htmlFor="billing-toggle" className={isAnnual ? "font-semibold" : ""}>
            Anual
          </Label>
          {isAnnual && (
            <Badge variant="secondary" className="bg-green-500/10 text-green-600">
              Economize 15%
            </Badge>
          )}
        </div>

        {isAnnual && (
          <div className="mb-8 p-6 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 border border-green-500/20 rounded-lg">
            <h3 className="text-lg font-bold mb-4 text-center">💰 Economia Anual vs Mensal</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {Object.entries(PLANS).map(([key, plan]) => {
                const monthlyTotal = parseFloat(plan.price.replace('R$ ', '').replace(',', '.')) * 12;
                const annualPrice = parseFloat(plan.annual_price.replace('R$ ', '').replace('.', '').replace(',', '.')) / 100;
                const savings = monthlyTotal - annualPrice;
                
                return (
                  <div key={key} className="bg-background/80 backdrop-blur-sm p-4 rounded-lg border border-border">
                    <p className="font-semibold text-sm mb-2">{plan.name}</p>
                    <div className="space-y-1 text-sm">
                      <p className="text-muted-foreground">
                        Mensal: <span className="line-through">R$ {monthlyTotal.toFixed(2)}</span>
                      </p>
                      <p className="text-muted-foreground">
                        Anual: {plan.annual_price}
                      </p>
                      <p className="text-green-600 font-bold text-lg">
                        Economize R$ {savings.toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {Object.entries(PLANS).map(([key, plan]) => {
            const currentPriceId = isAnnual ? plan.annual_price_id : plan.price_id;
            const isCurrentPlan = currentPlan?.price_id === currentPriceId;
            const isPremium = key === "premium";

            return (
              <Card key={key} className={`relative ${isCurrentPlan ? "border-primary shadow-lg" : ""}`}>
                {isCurrentPlan && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Plano Atual
                  </Badge>
                )}
                {isPremium && (
                  <div className="absolute -top-3 right-4">
                    <Crown className="h-6 w-6 text-yellow-500" />
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>
                    <div className="space-y-1">
                      <div>
                        <span className="text-3xl font-bold text-foreground">
                          {isAnnual ? plan.annual_price : plan.price}
                        </span>
                        <span className="text-muted-foreground">
                          {isAnnual ? "/ano" : "/mês"}
                        </span>
                      </div>
                      {isAnnual && (
                        <p className="text-sm text-muted-foreground">
                          ou {plan.price}/mês
                        </p>
                      )}
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                        1º mês grátis
                      </Badge>
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    onClick={() => handleSubscribe(currentPriceId)}
                    disabled={loading === currentPriceId || isCurrentPlan}
                    variant={isPremium ? "default" : "outline"}
                  >
                    {loading === currentPriceId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCurrentPlan ? (
                      "Plano Ativo"
                    ) : (
                      "Assinar Agora"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default Planos;
