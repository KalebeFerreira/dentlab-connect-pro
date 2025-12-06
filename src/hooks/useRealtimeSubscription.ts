import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

type TableName = 'orders' | 'appointments' | 'services' | 'deliveries' | 'patients';

interface UseRealtimeSubscriptionOptions {
  table: TableName;
  queryKey: string[];
  enabled?: boolean;
}

export const useRealtimeSubscription = ({
  table,
  queryKey,
  enabled = true
}: UseRealtimeSubscriptionOptions) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`realtime-${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table
        },
        (payload) => {
          console.log(`Realtime update on ${table}:`, payload);
          // Invalidate the query to refetch data
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, queryKey, enabled, queryClient]);
};

// Hook para múltiplas tabelas
export const useMultipleRealtimeSubscriptions = (
  subscriptions: UseRealtimeSubscriptionOptions[]
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channels = subscriptions
      .filter(sub => sub.enabled !== false)
      .map(sub => {
        return supabase
          .channel(`realtime-${sub.table}-${sub.queryKey.join('-')}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: sub.table
            },
            (payload) => {
              console.log(`Realtime update on ${sub.table}:`, payload);
              queryClient.invalidateQueries({ queryKey: sub.queryKey });
            }
          )
          .subscribe();
      });

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [subscriptions, queryClient]);
};
