import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export interface FreemiumLimits {
  orders: { current: number; limit: number; percentage: number };
  patients: { current: number; limit: number; percentage: number };
  imageGenerations: { current: number; limit: number; percentage: number };
  pdfGenerations: { current: number; limit: number; percentage: number };
  canCreateOrder: boolean;
  canCreatePatient: boolean;
  canGenerateImage: boolean;
  canGeneratePdf: boolean;
  isSubscribed: boolean;
  loading: boolean;
}

const FREE_PLAN_LIMITS = {
  ORDERS_PER_MONTH: 10,
  PATIENTS: 10,
  IMAGE_GENERATIONS: 10,
  PDF_GENERATIONS: 2,
};

export const useFreemiumLimits = () => {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  const { data: limits, isLoading, refetch } = useQuery({
    queryKey: ['freemium-limits', userId],
    queryFn: async () => {
      if (!userId) throw new Error('No user');

      // Check subscription status
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('status, plan_name')
        .eq('user_id', userId)
        .single();

      const isSubscribed = subscription?.status === 'active' && subscription?.plan_name !== 'free';

      // If subscribed, return unlimited
      if (isSubscribed) {
        return {
          orders: { current: 0, limit: -1, percentage: 0 },
          patients: { current: 0, limit: -1, percentage: 0 },
          imageGenerations: { current: 0, limit: -1, percentage: 0 },
          pdfGenerations: { current: 0, limit: -1, percentage: 0 },
          canCreateOrder: true,
          canCreatePatient: true,
          canGenerateImage: true,
          canGeneratePdf: true,
          isSubscribed: true,
          loading: false,
        };
      }

      // Count orders for current month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: ordersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString());

      // Count total patients
      const { count: patientsCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Get image generation usage for current month
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const { data: imageUsage } = await supabase
        .from('image_generation_usage')
        .select('count')
        .eq('user_id', userId)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .single();

      const imageCount = imageUsage?.count || 0;

      // Get PDF generation usage for current month
      const { data: pdfUsage } = await supabase
        .from('pdf_generation_usage')
        .select('count')
        .eq('user_id', userId)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .single();

      const pdfCount = pdfUsage?.count || 0;

      const ordersPercentage = ((ordersCount || 0) / FREE_PLAN_LIMITS.ORDERS_PER_MONTH) * 100;
      const patientsPercentage = ((patientsCount || 0) / FREE_PLAN_LIMITS.PATIENTS) * 100;
      const imagesPercentage = (imageCount / FREE_PLAN_LIMITS.IMAGE_GENERATIONS) * 100;
      const pdfsPercentage = (pdfCount / FREE_PLAN_LIMITS.PDF_GENERATIONS) * 100;

      return {
        orders: {
          current: ordersCount || 0,
          limit: FREE_PLAN_LIMITS.ORDERS_PER_MONTH,
          percentage: Math.min(ordersPercentage, 100),
        },
        patients: {
          current: patientsCount || 0,
          limit: FREE_PLAN_LIMITS.PATIENTS,
          percentage: Math.min(patientsPercentage, 100),
        },
        imageGenerations: {
          current: imageCount,
          limit: FREE_PLAN_LIMITS.IMAGE_GENERATIONS,
          percentage: Math.min(imagesPercentage, 100),
        },
        pdfGenerations: {
          current: pdfCount,
          limit: FREE_PLAN_LIMITS.PDF_GENERATIONS,
          percentage: Math.min(pdfsPercentage, 100),
        },
        canCreateOrder: (ordersCount || 0) < FREE_PLAN_LIMITS.ORDERS_PER_MONTH,
        canCreatePatient: (patientsCount || 0) < FREE_PLAN_LIMITS.PATIENTS,
        canGenerateImage: imageCount < FREE_PLAN_LIMITS.IMAGE_GENERATIONS,
        canGeneratePdf: pdfCount < FREE_PLAN_LIMITS.PDF_GENERATIONS,
        isSubscribed: false,
        loading: false,
      };
    },
    enabled: !!userId,
  });

  return {
    ...limits,
    loading: isLoading,
    refresh: refetch,
  } as FreemiumLimits;
};
