import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePushNotifications } from './usePushNotifications';
import { toast } from 'sonner';

export const useAppointmentNotifications = (dentistId: string | null) => {
  const { permission, requestPermission, sendNotification } = usePushNotifications();

  useEffect(() => {
    if (!dentistId) return;

    // Request notification permission on mount if not already granted
    if (permission === 'default') {
      requestPermission();
    }

    // Subscribe to new appointments for this dentist
    const channel = supabase
      .channel('dentist-appointments')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `dentist_id=eq.${dentistId}`,
        },
        async (payload) => {
          console.log('New appointment detected:', payload);
          
          // Get patient info for the notification
          const { data: patient } = await supabase
            .from('patients')
            .select('name')
            .eq('id', payload.new.patient_id)
            .single();

          const appointmentDate = new Date(payload.new.appointment_date);
          const dateStr = appointmentDate.toLocaleDateString('pt-BR');
          const timeStr = appointmentDate.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });

          const notificationTitle = 'Novo Agendamento!';
          const notificationBody = patient 
            ? `Paciente: ${patient.name}\nData: ${dateStr} às ${timeStr}`
            : `Novo agendamento para ${dateStr} às ${timeStr}`;

          // Send browser notification if permission is granted
          if (permission === 'granted') {
            sendNotification(notificationTitle, {
              body: notificationBody,
              tag: `appointment-${payload.new.id}`,
              requireInteraction: true,
            });
          }

          // Also show toast notification
          toast.success(notificationTitle, {
            description: notificationBody,
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dentistId, permission, requestPermission, sendNotification]);

  return {
    permission,
    requestPermission,
  };
};
