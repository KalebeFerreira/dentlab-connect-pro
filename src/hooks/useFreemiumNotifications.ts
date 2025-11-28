import { useEffect, useRef } from 'react';
import { useFreemiumLimits } from './useFreemiumLimits';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface NotificationState {
  orders70: boolean;
  orders90: boolean;
  patients70: boolean;
  patients90: boolean;
  images70: boolean;
  images90: boolean;
  pdfs70: boolean;
  pdfs90: boolean;
  priceTables70: boolean;
  priceTables90: boolean;
  monthlyReports70: boolean;
  monthlyReports90: boolean;
}

const STORAGE_KEY = 'freemium-notifications';

export const useFreemiumNotifications = () => {
  const limits = useFreemiumLimits();
  const { toast } = useToast();
  const navigate = useNavigate();
  const hasShownNotifications = useRef<NotificationState | null>(null);

  useEffect(() => {
    if (limits.loading || limits.isSubscribed) return;

    // Load notification state from localStorage
    if (!hasShownNotifications.current) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          hasShownNotifications.current = JSON.parse(stored);
        } catch {
          hasShownNotifications.current = {
            orders70: false,
            orders90: false,
            patients70: false,
            patients90: false,
            images70: false,
            images90: false,
            pdfs70: false,
            pdfs90: false,
            priceTables70: false,
            priceTables90: false,
            monthlyReports70: false,
            monthlyReports90: false,
          };
        }
      } else {
        hasShownNotifications.current = {
          orders70: false,
          orders90: false,
          patients70: false,
          patients90: false,
          images70: false,
          images90: false,
          pdfs70: false,
          pdfs90: false,
          priceTables70: false,
          priceTables90: false,
          monthlyReports70: false,
          monthlyReports90: false,
        };
      }
    }

    const state = hasShownNotifications.current;
    const newState = { ...state };
    let shouldSave = false;

    // Check orders limit
    if (limits.orders) {
      const percentage = limits.orders.percentage;
      
      if (percentage >= 90 && !state.orders90) {
        toast({
          title: "⚠️ Limite Crítico: Pedidos",
          description: `Você usou ${limits.orders.current} de ${limits.orders.limit} pedidos este mês. Faça upgrade para continuar!`,
          variant: "destructive",
          duration: 8000,
        });
        newState.orders90 = true;
        shouldSave = true;
      } else if (percentage >= 70 && percentage < 90 && !state.orders70) {
        toast({
          title: "⚠️ Alerta: Pedidos",
          description: `Você usou ${limits.orders.current} de ${limits.orders.limit} pedidos. Considere fazer upgrade para não perder acesso.`,
          duration: 6000,
        });
        newState.orders70 = true;
        shouldSave = true;
      }
    }

    // Check patients limit
    if (limits.patients) {
      const percentage = limits.patients.percentage;
      
      if (percentage >= 90 && !state.patients90) {
        toast({
          title: "⚠️ Limite Crítico: Clientes",
          description: `Você tem ${limits.patients.current} de ${limits.patients.limit} clientes cadastrados. Faça upgrade para adicionar mais!`,
          variant: "destructive",
          duration: 8000,
        });
        newState.patients90 = true;
        shouldSave = true;
      } else if (percentage >= 70 && percentage < 90 && !state.patients70) {
        toast({
          title: "⚠️ Alerta: Clientes",
          description: `Você tem ${limits.patients.current} de ${limits.patients.limit} clientes. Considere fazer upgrade.`,
          duration: 6000,
        });
        newState.patients70 = true;
        shouldSave = true;
      }
    }

    // Check image generations limit
    if (limits.imageGenerations) {
      const percentage = limits.imageGenerations.percentage;
      
      if (percentage >= 90 && !state.images90) {
        toast({
          title: "⚠️ Limite Crítico: Imagens IA",
          description: `Você usou ${limits.imageGenerations.current} de ${limits.imageGenerations.limit} gerações de imagem este mês. Faça upgrade!`,
          variant: "destructive",
          duration: 8000,
        });
        newState.images90 = true;
        shouldSave = true;
      } else if (percentage >= 70 && percentage < 90 && !state.images70) {
        toast({
          title: "⚠️ Alerta: Imagens IA",
          description: `Você usou ${limits.imageGenerations.current} de ${limits.imageGenerations.limit} gerações de imagem. Considere fazer upgrade.`,
          duration: 6000,
        });
        newState.images70 = true;
        shouldSave = true;
      }
    }

    // Check PDF generations limit
    if (limits.pdfGenerations) {
      const percentage = limits.pdfGenerations.percentage;
      
      if (percentage >= 90 && !state.pdfs90) {
        toast({
          title: "⚠️ Limite Crítico: PDFs",
          description: `Você gerou ${limits.pdfGenerations.current} de ${limits.pdfGenerations.limit} PDFs este mês. Faça upgrade!`,
          variant: "destructive",
          duration: 8000,
        });
        newState.pdfs90 = true;
        shouldSave = true;
      } else if (percentage >= 70 && percentage < 90 && !state.pdfs70) {
        toast({
          title: "⚠️ Alerta: PDFs",
          description: `Você gerou ${limits.pdfGenerations.current} de ${limits.pdfGenerations.limit} PDFs este mês. Considere fazer upgrade.`,
          duration: 6000,
        });
        newState.pdfs70 = true;
        shouldSave = true;
      }
    }

    // Check price tables limit
    if (limits.priceTables && limits.priceTables.limit !== -1) {
      const percentage = limits.priceTables.percentage;
      
      if (percentage >= 90 && !state.priceTables90) {
        toast({
          title: "⚠️ Limite Crítico: Tabelas de Valores",
          description: `Você criou ${limits.priceTables.current} de ${limits.priceTables.limit} tabelas de valores. Faça upgrade!`,
          variant: "destructive",
          duration: 8000,
        });
        newState.priceTables90 = true;
        shouldSave = true;
      } else if (percentage >= 70 && percentage < 90 && !state.priceTables70) {
        toast({
          title: "⚠️ Alerta: Tabelas de Valores",
          description: `Você criou ${limits.priceTables.current} de ${limits.priceTables.limit} tabelas de valores. Considere fazer upgrade.`,
          duration: 6000,
        });
        newState.priceTables70 = true;
        shouldSave = true;
      }
    }

    // Check monthly reports limit
    if (limits.monthlyReports && limits.monthlyReports.limit !== -1) {
      const percentage = limits.monthlyReports.percentage;
      
      if (percentage >= 90 && !state.monthlyReports90) {
        toast({
          title: "⚠️ Limite Crítico: Relatórios Mensais",
          description: `Você enviou ${limits.monthlyReports.current} de ${limits.monthlyReports.limit} relatórios este mês. Faça upgrade!`,
          variant: "destructive",
          duration: 8000,
        });
        newState.monthlyReports90 = true;
        shouldSave = true;
      } else if (percentage >= 70 && percentage < 90 && !state.monthlyReports70) {
        toast({
          title: "⚠️ Alerta: Relatórios Mensais",
          description: `Você enviou ${limits.monthlyReports.current} de ${limits.monthlyReports.limit} relatórios este mês. Considere fazer upgrade.`,
          duration: 6000,
        });
        newState.monthlyReports70 = true;
        shouldSave = true;
      }
    }

    // Save state if changed
    if (shouldSave) {
      hasShownNotifications.current = newState;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    }
  }, [limits, toast, navigate]);

  // Reset notifications at the start of each month
  useEffect(() => {
    const checkMonthReset = () => {
      const lastCheck = localStorage.getItem('freemium-notifications-last-check');
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthKey = `${currentYear}-${currentMonth}`;

      if (lastCheck !== monthKey) {
        localStorage.removeItem(STORAGE_KEY);
        hasShownNotifications.current = null;
        localStorage.setItem('freemium-notifications-last-check', monthKey);
      }
    };

    checkMonthReset();
    // Check daily
    const interval = setInterval(checkMonthReset, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
};
