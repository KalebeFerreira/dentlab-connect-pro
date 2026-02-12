import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from './useUserRole';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const SCANNER_LIMITS = {
  free: 30,
  basic: 100,
  professional: 200,
  premium: -1, // unlimited
};

type PlanType = keyof typeof SCANNER_LIMITS;

export const useScannerLimits = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUsage, setCurrentUsage] = useState(0);
  const [limit, setLimit] = useState(15);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const { role } = useUserRole();

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      // Non-lab/clinic roles have unlimited
      if (role !== 'laboratory' && role !== 'clinic') {
        setLimit(-1);
        setIsSubscribed(true);
        setLoading(false);
        return;
      }

      // Check subscription
      const { data: sub } = await supabase
        .from('user_subscriptions')
        .select('status, plan_name')
        .eq('user_id', user.id)
        .single();

      const hasActiveSub = sub?.status === 'active' && sub?.plan_name !== 'free';
      setIsSubscribed(hasActiveSub);

      let plan: PlanType = 'free';
      if (hasActiveSub && sub?.plan_name) {
        const name = sub.plan_name.toLowerCase();
        if (name.includes('basic') || name.includes('basico')) plan = 'basic';
        else if (name.includes('professional') || name.includes('profissional') || name.includes('pro')) plan = 'professional';
        else if (name.includes('premium') || name.includes('super')) plan = 'premium';
      }
      setLimit(SCANNER_LIMITS[plan]);

      // Get current usage
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear();
      const { data: usage } = await supabase
        .from('scanner_usage')
        .select('count')
        .eq('user_id', user.id)
        .eq('month', month)
        .eq('year', year)
        .single();

      setCurrentUsage(usage?.count || 0);
      setLoading(false);
    };
    init();
  }, [role]);

  const percentage = limit === -1 ? 0 : (currentUsage / limit) * 100;
  const canScan = limit === -1 || currentUsage < limit;

  const incrementUsage = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.rpc('increment_scanner_usage', { p_user_id: userId });
    if (data) setCurrentUsage(data);
  }, [userId]);

  const checkAndWarn = useCallback(() => {
    if (limit === -1) return true;
    if (currentUsage >= limit) {
      toast.error('Limite de scanner atingido!', {
        description: `Você usou ${currentUsage}/${limit} scans este mês. Faça upgrade para continuar.`,
        duration: 8000,
      });
      return false;
    }
    if (percentage >= 90) {
      toast.warning('⚠️ Scanner quase no limite!', {
        description: `${currentUsage}/${limit} scans usados. Faça upgrade para mais scans.`,
        duration: 6000,
      });
    } else if (percentage >= 70) {
      toast.info('📊 Uso do scanner: ' + Math.round(percentage) + '%', {
        description: `${currentUsage}/${limit} scans usados este mês.`,
        duration: 4000,
      });
    }
    return true;
  }, [currentUsage, limit, percentage]);

  return {
    currentUsage,
    limit,
    percentage: Math.min(percentage, 100),
    canScan,
    loading,
    incrementUsage,
    checkAndWarn,
    isSubscribed,
  };
};
