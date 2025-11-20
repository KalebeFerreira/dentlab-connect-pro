import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Checking for appointments in the next 24 hours...');

    // Calculate time window (next 24 hours)
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dayAfterTomorrow = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    // Fetch appointments in the next 24 hours that haven't been sent reminders
    // Only fetch appointments for the authenticated user
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
      .eq('user_id', user.id)
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

        // Buscar template personalizado
        const { data: templates } = await supabase
          .from('message_templates')
          .select('*')
          .eq('user_id', appointment.user_id)
          .eq('template_type', 'appointment_reminder')
          .eq('is_active', true)
          .limit(1);

        let message = '';
        if (templates && templates.length > 0) {
          // Usar template personalizado
          message = templates[0].message_content
            .replace(/{patient_name}/g, appointment.patients.name)
            .replace(/{appointment_date}/g, formattedDate)
            .replace(/{appointment_time}/g, formattedTime)
            .replace(/{appointment_type}/g, appointment.type);
        } else {
          // Usar mensagem padrão
          message = `Olá ${appointment.patients.name}! Lembrando seu agendamento para ${formattedDate} às ${formattedTime}. Tipo: ${appointment.type}`;
        }

        // Preparar link do WhatsApp
        const phone = appointment.patients.phone.replace(/\D/g, '');
        const whatsappUrl = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;

        console.log(`Reminder prepared for appointment ${appointment.id}`);
        console.log(`Patient: ${appointment.patients.name}`);
        console.log(`Date: ${formattedDate} at ${formattedTime}`);
        console.log(`WhatsApp URL: ${whatsappUrl}`);

        notifications.push({
          appointment_id: appointment.id,
          patient_name: appointment.patients.name,
          appointment_time: `${formattedDate} às ${formattedTime}`,
          phone: appointment.patients.phone,
          message: message,
          whatsapp_url: whatsappUrl,
        });

        // Mark as ready to send (not auto-sent, requires manual action)
        console.log(`✓ Reminder prepared for appointment ${appointment.id}`);
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
