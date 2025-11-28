import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SubscriptionInfo {
  subscribed: boolean;
  product_id: string | null;
  price_id: string | null;
  subscription_end: string | null;
  loading: boolean;
}

export const PLANS = {
  free: {
    name: "Plano Gratuito",
    price: "R$ 0,00",
    price_id: null,
    annual_price: "R$ 0,00",
    annual_price_id: null,
    product_id: null,
    features: [
      "50 pedidos por mês",
      "50 pacientes cadastrados",
      "20 gerações de imagem IA por mês",
      "40 PDFs gerados por mês",
      "1 tabela de valores",
      "3 relatórios mensais",
      "Suporte por email",
    ],
    limit: 20,
  },
  basic: {
    name: "Plano Básico",
    price: "R$ 44,00",
    price_id: "price_1SYU8j2X6ylDIgldsI1zYoTK",
    annual_price: "R$ 448,80",
    annual_price_id: "price_1SYU9F2X6ylDIgldhyiS2VVe",
    product_id: "prod_TVV9zYSZkUzEmA",
    features: [
      "120 pedidos por mês",
      "120 pacientes cadastrados",
      "70 gerações de imagem IA por mês",
      "150 PDFs gerados por mês",
      "Tabelas de valores ilimitadas",
      "40 relatórios mensais",
      "Suporte por email",
    ],
    limit: 70,
  },
  professional: {
    name: "Plano Profissional",
    price: "R$ 89,00",
    price_id: "price_1SYU9W2X6ylDIgld5AskblY8",
    annual_price: "R$ 907,80",
    annual_price_id: "price_1SYU9l2X6ylDIgldp57I7fTQ",
    product_id: "prod_TVV9zJfsQ4ZwPs",
    features: [
      "Pedidos ilimitados",
      "Pacientes ilimitados",
      "140 gerações de imagem IA por mês",
      "300 PDFs gerados por mês",
      "Tabelas de valores ilimitadas",
      "Relatórios mensais ilimitados",
      "Suporte prioritário",
      "Recursos profissionais",
    ],
    limit: 140,
  },
  premium: {
    name: "Plano Premium",
    price: "R$ 179,00",
    price_id: "price_1SYU9z2X6ylDIgldI9uQ2XN3",
    annual_price: "R$ 1.825,80",
    annual_price_id: "price_1SYUAC2X6ylDIgld55NCVkuM",
    product_id: "prod_TVVA9PzSiQUVQ2",
    features: [
      "Tudo ilimitado",
      "Pedidos sem limite",
      "Pacientes sem limite",
      "Gerações de imagem IA ilimitadas",
      "PDFs ilimitados",
      "Tabelas de valores ilimitadas",
      "Relatórios mensais ilimitados",
      "Suporte VIP 24/7",
      "Recursos exclusivos",
    ],
    limit: 0,
  },
};

export const useSubscription = () => {
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo>({
    subscribed: false,
    product_id: null,
    price_id: null,
    subscription_end: null,
    loading: true,
  });

  const checkSubscription = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // Se não houver sessão ou o token for inválido, retorna não inscrito
      if (sessionError || !session?.access_token || session.access_token === "undefined") {
        setSubscriptionInfo({
          subscribed: false,
          product_id: null,
          price_id: null,
          subscription_end: null,
          loading: false,
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("check-subscription", {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      
      // Qualquer erro, trata como não inscrito silenciosamente
      if (error) {
        console.log("Subscription check returned error, treating as not subscribed");
        setSubscriptionInfo({
          subscribed: false,
          product_id: null,
          price_id: null,
          subscription_end: null,
          loading: false,
        });
        return;
      }

      setSubscriptionInfo({
        ...data,
        loading: false,
      });
    } catch (error) {
      console.log("Error checking subscription:", error);
      setSubscriptionInfo({
        subscribed: false,
        product_id: null,
        price_id: null,
        subscription_end: null,
        loading: false,
      });
    }
  };

  useEffect(() => {
    checkSubscription();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkSubscription();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const getCurrentPlan = () => {
    if (!subscriptionInfo.subscribed || !subscriptionInfo.price_id) {
      return null;
    }

    for (const [key, plan] of Object.entries(PLANS)) {
      if (plan.price_id === subscriptionInfo.price_id || plan.annual_price_id === subscriptionInfo.price_id) {
        return { key, ...plan };
      }
    }
    return null;
  };

  return {
    ...subscriptionInfo,
    currentPlan: getCurrentPlan(),
    refresh: checkSubscription,
  };
};
