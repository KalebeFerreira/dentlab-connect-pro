import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePushNotifications } from './usePushNotifications';
import { toast } from 'sonner';
import { differenceInDays, parseISO } from 'date-fns';

export const useDeadlineNotifications = (userId: string | undefined) => {
  const { sendNotification, permission } = usePushNotifications();

  useEffect(() => {
    if (!userId || permission !== 'granted') return;

    console.log('Setting up deadline notifications for user:', userId);

    // Check deadlines every hour
    const checkDeadlines = async () => {
      try {
        const { data: orders, error } = await supabase
          .from('orders')
          .select('id, os_number, patient_name, delivery_date, status')
          .eq('user_id', userId)
          .in('status', ['pending', 'in_production'])
          .not('delivery_date', 'is', null);

        if (error) throw error;

        const now = new Date();
        
        orders?.forEach((order) => {
          if (!order.delivery_date) return;
          
          const deliveryDate = parseISO(order.delivery_date);
          const daysUntilDeadline = differenceInDays(deliveryDate, now);

          // Notify for deadlines within 2 days
          if (daysUntilDeadline >= 0 && daysUntilDeadline <= 2) {
            const urgencyLevel = daysUntilDeadline === 0 ? '🚨' : '⏰';
            const message = daysUntilDeadline === 0 
              ? 'Entrega hoje!' 
              : `Entrega em ${daysUntilDeadline} dia(s)`;

            sendNotification(`${urgencyLevel} Prazo Próximo`, {
              body: `OS ${order.os_number} - ${order.patient_name}\n${message}`,
              tag: `deadline-${order.id}-${daysUntilDeadline}`,
              requireInteraction: daysUntilDeadline === 0,
            });
          }

          // Alert for overdue orders
          if (daysUntilDeadline < 0) {
            sendNotification('⚠️ Pedido Atrasado', {
              body: `OS ${order.os_number} - ${order.patient_name}\nAtrasado há ${Math.abs(daysUntilDeadline)} dia(s)`,
              tag: `overdue-${order.id}`,
              requireInteraction: true,
            });
          }
        });
      } catch (error) {
        console.error('Error checking deadlines:', error);
      }
    };

    // Check immediately
    checkDeadlines();

    // Then check every hour
    const interval = setInterval(checkDeadlines, 60 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [userId, permission, sendNotification]);
};
