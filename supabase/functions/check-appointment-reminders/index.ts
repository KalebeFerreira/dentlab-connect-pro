import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Appointment {
  id: string;
  appointment_date: string;
  patients: {
    name: string;
    phone: string;
  };
  type: string;
  user_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Checking for appointments in the next 24 hours...');

    // Calculate time window (next 24 hours)
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dayAfterTomorrow = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    // Fetch appointments in the next 24 hours that haven't been sent reminders
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        type,
        user_id,
        whatsapp_sent,
        patients (
          name,
          phone
        )
      `)
      .gte('appointment_date', tomorrow.toISOString())
      .lt('appointment_date', dayAfterTomorrow.toISOString())
      .eq('status', 'scheduled')
      .eq('whatsapp_sent', false);

    if (error) {
      console.error('Error fetching appointments:', error);
      throw error;
    }

    console.log(`Found ${appointments?.length || 0} appointments needing reminders`);

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No appointments found needing reminders',
          count: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    const notifications = [];

    // Process each appointment
    for (const appointment of appointments as any[]) {
      try {
        const appointmentDate = new Date(appointment.appointment_date);
        const formattedDate = appointmentDate.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        const formattedTime = appointmentDate.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        });

        // Here you would send actual push notification or WhatsApp message
        // For now, we'll just log and mark as sent
        console.log(`Sending reminder for appointment ${appointment.id}`);
        console.log(`Patient: ${appointment.patients.name}`);
        console.log(`Date: ${formattedDate} at ${formattedTime}`);
        console.log(`Phone: ${appointment.patients.phone}`);

        notifications.push({
          appointment_id: appointment.id,
          patient_name: appointment.patients.name,
          appointment_time: `${formattedDate} às ${formattedTime}`,
          phone: appointment.patients.phone,
        });

        // Mark as sent
        await supabase
          .from('appointments')
          .update({ whatsapp_sent: true })
          .eq('id', appointment.id);

        console.log(`✓ Reminder sent for appointment ${appointment.id}`);
      } catch (error) {
        console.error(`Error processing appointment ${appointment.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Appointment reminders processed',
        count: notifications.length,
        notifications 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: any) {
    console.error('Error in check-appointment-reminders function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
