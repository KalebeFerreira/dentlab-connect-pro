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
      "30 PDFs gerados por mês",
      "1 tabela de valores",
      "3 relatórios mensais",
      "Suporte por email",
    ],
    limit: 20,
  },
  basic: {
    name: "Plano Básico",
    price: "R$ 44,00",
    price_id: "price_1SYVOhF2249riykhzMKCVXNw",
    annual_price: "R$ 396,00",
    annual_price_id: "price_1SYVOhF2249riykh1HAwzkce",
    product_id: "prod_TVWRXeZuqfWe86",
    features: [
      "200 pedidos por mês",
      "200 pacientes cadastrados",
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
    price: "R$ 84,00",
    price_id: "price_1SYVOiF2249riykhLo07A0Lx",
    annual_price: "R$ 756,00",
    annual_price_id: "price_1SYVOiF2249riykhphMkNE0w",
    product_id: "prod_TVWRJ8WPfSfMWc",
    features: [
      "Pedidos ilimitados",
      "Pacientes ilimitados",
      "150 gerações de imagem IA por mês",
      "300 PDFs gerados por mês",
      "Tabelas de valores ilimitadas",
      "Relatórios mensais ilimitados",
      "Suporte prioritário",
    ],
    limit: 150,
  },
  premium: {
    name: "Plano Premium",
    price: "R$ 140,00",
    price_id: "price_1SYVOjF2249riykhJmw4RoVM",
    annual_price: "R$ 1.260,00",
    annual_price_id: "price_1SYVOjF2249riykhi2o98hEf",
    product_id: "prod_TVWR6sSh4O5ln8",
    features: [
      "Tudo ilimitado",
      "Pedidos sem limite",
      "Pacientes sem limite",
      "Gerações de imagem IA ilimitadas",
      "PDFs ilimitados",
      "Tabelas de valores ilimitadas",
      "Relatórios mensais ilimitados",
      "Suporte VIP 24/7",
      "Assistente IA Premium",
    ],
    limit: 0,
  },
  super_premium: {
    name: "Plano Super Premium",
    price: "R$ 199,00",
    price_id: "price_super_premium_monthly",
    annual_price: "R$ 1.790,00",
    annual_price_id: "price_super_premium_annual",
    product_id: "prod_super_premium",
    features: [
      "Tudo do Premium +",
      "Assistente IA Multifuncional",
      "Chat por texto e voz",
      "Análise inteligente de dados",
      "Suporte técnico odontológico",
      "Insights de negócio personalizados",
      "Prioridade máxima no suporte",
      "Acesso antecipado a novidades",
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
