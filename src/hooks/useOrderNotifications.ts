import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePushNotifications } from './usePushNotifications';
import { toast } from 'sonner';

export const useOrderNotifications = (userId: string | undefined) => {
  const { sendNotification, permission } = usePushNotifications();

  useEffect(() => {
    if (!userId || permission !== 'granted') return;

    console.log('Setting up order notifications for user:', userId);

    // Listen for new orders
    const ordersChannel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('New order detected:', payload);
          const order = payload.new as any;
          
          sendNotification('🆕 Novo Pedido Criado', {
            body: `OS: ${order.os_number} - Paciente: ${order.patient_name}`,
            tag: `order-${order.id}`,
          });

          toast.success('Novo pedido criado!', {
            description: `OS: ${order.os_number}`,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Order updated:', payload);
          const oldOrder = payload.old as any;
          const newOrder = payload.new as any;
          
          // Check if status changed
          if (oldOrder.status !== newOrder.status) {
            const statusMessages: Record<string, string> = {
              pending: 'Pendente',
              in_production: 'Em Produção',
              completed: 'Concluído',
              delivered: 'Entregue',
            };

            sendNotification('📋 Status do Pedido Atualizado', {
              body: `OS ${newOrder.os_number}: ${statusMessages[newOrder.status] || newOrder.status}`,
              tag: `order-update-${newOrder.id}`,
            });

            toast.info('Status atualizado', {
              description: `OS ${newOrder.os_number}: ${statusMessages[newOrder.status]}`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up order notifications');
      supabase.removeChannel(ordersChannel);
    };
  }, [userId, permission, sendNotification]);
};
