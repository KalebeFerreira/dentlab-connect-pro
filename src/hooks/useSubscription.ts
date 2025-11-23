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
  basic: {
    name: "Plano Básico",
    price: "R$ 49,00",
    price_id: "price_1SVYnh2X6ylDIgldatijXVCS",
    annual_price: "R$ 499,80",
    annual_price_id: "price_1SVaDz2X6ylDIgldqfDF6bWW",
    product_id: "prod_RnOcvwzovB68GJ",
    features: [
      "100 pedidos por mês",
      "110 pacientes cadastrados",
      "50 gerações de imagem IA por mês",
      "110 PDFs gerados por mês",
      "Todos os recursos básicos",
      "Suporte por email",
    ],
    limit: 50,
  },
  professional: {
    name: "Plano Profissional",
    price: "R$ 99,00",
    price_id: "price_1SVYyx2X6ylDIgld3AQAlS8h",
    annual_price: "R$ 1.009,80",
    annual_price_id: "price_1SVaEQ2X6ylDIgld6KEjptJn",
    product_id: "prod_SLaYaNRg51EX4H",
    features: [
      "Pedidos ilimitados",
      "Pacientes ilimitados",
      "110 gerações de imagem IA por mês",
      "200 PDFs gerados por mês",
      "Todos os recursos avançados",
      "Suporte prioritário",
      "Recursos profissionais",
    ],
    limit: 110,
  },
  premium: {
    name: "Plano Premium",
    price: "R$ 199,00",
    price_id: "price_1SVYsz2X6ylDIgldiuS3Yh2z",
    annual_price: "R$ 2.029,80",
    annual_price_id: "price_1SVaEk2X6ylDIgldqtSK3LHu",
    product_id: "prod_SLaT5AjT2GUu39",
    features: [
      "Tudo ilimitado",
      "Pedidos sem limite",
      "Pacientes sem limite",
      "Gerações de imagem IA ilimitadas",
      "PDFs ilimitados",
      "Todos os recursos premium",
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSubscriptionInfo({
          subscribed: false,
          product_id: null,
          price_id: null,
          subscription_end: null,
          loading: false,
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("check-subscription");
      
      if (error) throw error;

      setSubscriptionInfo({
        ...data,
        loading: false,
      });
    } catch (error) {
      console.error("Error checking subscription:", error);
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
      if (plan.price_id === subscriptionInfo.price_id) {
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
