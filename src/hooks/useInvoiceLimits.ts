import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

const INVOICE_LIMITS: Record<string, number> = {
  free: 5,
  basic: 5,
  professional: 15,
  premium: 30,
  super_premium: Infinity,
};

export function useInvoiceLimits() {
  const { user } = useAuth();
  const { planName } = useSubscription();
  const [usage, setUsage] = useState(0);
  const [loading, setLoading] = useState(true);

  const normalizedPlan = (planName || 'free').toLowerCase().replace(/\s+/g, '_');
  const limit = INVOICE_LIMITS[normalizedPlan] ?? INVOICE_LIMITS.free;
  const isUnlimited = limit === Infinity;
  const remaining = isUnlimited ? Infinity : Math.max(0, limit - usage);
  const canEmit = remaining > 0;

  useEffect(() => {
    if (user) loadUsage();
  }, [user]);

  const loadUsage = async () => {
    try {
      const { data, error } = await supabase.rpc('get_monthly_invoice_usage', { p_user_id: user!.id });
      if (!error) setUsage(data || 0);
    } catch (err) {
      console.error("Erro ao carregar uso de notas:", err);
    } finally {
      setLoading(false);
    }
  };

  const refreshUsage = () => loadUsage();

  return { usage, limit, remaining, canEmit, isUnlimited, loading, planName: normalizedPlan, refreshUsage };
}
