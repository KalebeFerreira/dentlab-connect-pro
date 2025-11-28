import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useUserRole } from './useUserRole';

export interface FreemiumLimits {
  orders: { current: number; limit: number; percentage: number };
  patients: { current: number; limit: number; percentage: number };
  imageGenerations: { current: number; limit: number; percentage: number };
  pdfGenerations: { current: number; limit: number; percentage: number };
  priceTables: { current: number; limit: number; percentage: number };
  monthlyReports: { current: number; limit: number; percentage: number };
  canCreateOrder: boolean;
  canCreatePatient: boolean;
  canGenerateImage: boolean;
  canGeneratePdf: boolean;
  canCreatePriceTable: boolean;
  canGenerateMonthlyReport: boolean;
  isSubscribed: boolean;
  loading: boolean;
}

const PLAN_LIMITS = {
  free: {
    ORDERS_PER_MONTH: 50,
    PATIENTS: 50,
    IMAGE_GENERATIONS: 20,
    PDF_GENERATIONS: 30,
    PRICE_TABLES: 1,
    MONTHLY_REPORTS: 3,
  },
  basic: {
    ORDERS_PER_MONTH: 120,
    PATIENTS: 120,
    IMAGE_GENERATIONS: 70,
    PDF_GENERATIONS: 150,
    PRICE_TABLES: -1, // unlimited
    MONTHLY_REPORTS: 40,
  },
  professional: {
    ORDERS_PER_MONTH: -1, // unlimited
    PATIENTS: -1, // unlimited
    IMAGE_GENERATIONS: 140,
    PDF_GENERATIONS: 300,
    PRICE_TABLES: -1, // unlimited
    MONTHLY_REPORTS: -1, // unlimited
  },
  premium: {
    ORDERS_PER_MONTH: -1, // unlimited
    PATIENTS: -1, // unlimited
    IMAGE_GENERATIONS: -1, // unlimited
    PDF_GENERATIONS: -1, // unlimited
    PRICE_TABLES: -1, // unlimited
    MONTHLY_REPORTS: -1, // unlimited
  },
};

type PlanType = keyof typeof PLAN_LIMITS;

export const useFreemiumLimits = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const { role, loading: roleLoading } = useUserRole();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  const { data: limits, isLoading, refetch } = useQuery({
    queryKey: ['freemium-limits', userId, role],
    queryFn: async () => {
      if (!userId) throw new Error('No user');

      // Limites freemium aplicam-se APENAS a laboratórios e clínicas
      if (role !== 'laboratory' && role !== 'clinic') {
        return {
          orders: { current: 0, limit: -1, percentage: 0 },
          patients: { current: 0, limit: -1, percentage: 0 },
          imageGenerations: { current: 0, limit: -1, percentage: 0 },
          pdfGenerations: { current: 0, limit: -1, percentage: 0 },
          priceTables: { current: 0, limit: -1, percentage: 0 },
          monthlyReports: { current: 0, limit: -1, percentage: 0 },
          canCreateOrder: true,
          canCreatePatient: true,
          canGenerateImage: true,
          canGeneratePdf: true,
          canCreatePriceTable: true,
          canGenerateMonthlyReport: true,
          isSubscribed: true,
          loading: false,
        };
      }

      // Check subscription status
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('status, plan_name')
        .eq('user_id', userId)
        .single();

      const isSubscribed = subscription?.status === 'active' && subscription?.plan_name !== 'free';
      
      // Determine current plan
      let currentPlan: PlanType = 'free';
      if (isSubscribed && subscription?.plan_name) {
        const planName = subscription.plan_name.toLowerCase();
        if (planName.includes('basic') || planName.includes('basico')) {
          currentPlan = 'basic';
        } else if (planName.includes('professional') || planName.includes('profissional') || planName.includes('pro')) {
          currentPlan = 'professional';
        } else if (planName.includes('premium')) {
          currentPlan = 'premium';
        }
      }

      const limits = PLAN_LIMITS[currentPlan];

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

      // Count price tables
      const { count: priceTablesCount } = await supabase
        .from('price_tables')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Count monthly reports for current month
      const { count: monthlyReportsCount } = await supabase
        .from('report_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('month', `${currentYear}-${String(currentMonth).padStart(2, '0')}`);

      // Calculate percentages (handle unlimited plans)
      const ordersPercentage = limits.ORDERS_PER_MONTH === -1 ? 0 : ((ordersCount || 0) / limits.ORDERS_PER_MONTH) * 100;
      const patientsPercentage = limits.PATIENTS === -1 ? 0 : ((patientsCount || 0) / limits.PATIENTS) * 100;
      const imagesPercentage = limits.IMAGE_GENERATIONS === -1 ? 0 : (imageCount / limits.IMAGE_GENERATIONS) * 100;
      const pdfsPercentage = limits.PDF_GENERATIONS === -1 ? 0 : (pdfCount / limits.PDF_GENERATIONS) * 100;
      const priceTablesPercentage = limits.PRICE_TABLES === -1 ? 0 : ((priceTablesCount || 0) / limits.PRICE_TABLES) * 100;
      const monthlyReportsPercentage = limits.MONTHLY_REPORTS === -1 ? 0 : ((monthlyReportsCount || 0) / limits.MONTHLY_REPORTS) * 100;

      return {
        orders: {
          current: ordersCount || 0,
          limit: limits.ORDERS_PER_MONTH,
          percentage: Math.min(ordersPercentage, 100),
        },
        patients: {
          current: patientsCount || 0,
          limit: limits.PATIENTS,
          percentage: Math.min(patientsPercentage, 100),
        },
        imageGenerations: {
          current: imageCount,
          limit: limits.IMAGE_GENERATIONS,
          percentage: Math.min(imagesPercentage, 100),
        },
        pdfGenerations: {
          current: pdfCount,
          limit: limits.PDF_GENERATIONS,
          percentage: Math.min(pdfsPercentage, 100),
        },
        priceTables: {
          current: priceTablesCount || 0,
          limit: limits.PRICE_TABLES,
          percentage: Math.min(priceTablesPercentage, 100),
        },
        monthlyReports: {
          current: monthlyReportsCount || 0,
          limit: limits.MONTHLY_REPORTS,
          percentage: Math.min(monthlyReportsPercentage, 100),
        },
        canCreateOrder: limits.ORDERS_PER_MONTH === -1 || (ordersCount || 0) < limits.ORDERS_PER_MONTH,
        canCreatePatient: limits.PATIENTS === -1 || (patientsCount || 0) < limits.PATIENTS,
        canGenerateImage: limits.IMAGE_GENERATIONS === -1 || imageCount < limits.IMAGE_GENERATIONS,
        canGeneratePdf: limits.PDF_GENERATIONS === -1 || pdfCount < limits.PDF_GENERATIONS,
        canCreatePriceTable: limits.PRICE_TABLES === -1 || (priceTablesCount || 0) < limits.PRICE_TABLES,
        canGenerateMonthlyReport: limits.MONTHLY_REPORTS === -1 || (monthlyReportsCount || 0) < limits.MONTHLY_REPORTS,
        isSubscribed,
        loading: false,
      };
    },
    enabled: !!userId && !roleLoading,
  });

  return {
    ...limits,
    loading: isLoading,
    refresh: refetch,
  } as FreemiumLimits;
};
