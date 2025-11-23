import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@4.0.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[SCHEDULED-REPORTS] Starting scheduled reports job');
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current date info
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    const monthYear = `${lastMonth}/${lastMonthYear}`;

    console.log(`[SCHEDULED-REPORTS] Current day: ${currentDay}, Processing reports for: ${monthYear}`);

    // Get all active schedules for current day
    const { data: schedules, error: schedulesError } = await supabaseAdmin
      .from('automatic_report_schedules')
      .select('*')
      .eq('day_of_month', currentDay)
      .eq('is_active', true);

    if (schedulesError) {
      console.error('[SCHEDULED-REPORTS] Error fetching schedules:', schedulesError);
      throw schedulesError;
    }

    console.log(`[SCHEDULED-REPORTS] Found ${schedules?.length || 0} active schedules`);

    if (!schedules || schedules.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No schedules to process', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each schedule
    for (const schedule of schedules) {
      try {
        console.log(`[SCHEDULED-REPORTS] Processing schedule ${schedule.id} for client ${schedule.client_name}`);

        // Get company info for this user
        const { data: companyInfo } = await supabaseAdmin
          .from('company_info')
          .select('*')
          .eq('user_id', schedule.user_id)
          .single();

        // Get services for the client in the last month
        const { data: services, error: servicesError } = await supabaseAdmin
          .from('services')
          .select('*')
          .eq('user_id', schedule.user_id)
          .eq('client_name', schedule.client_name)
          .eq('status', 'active')
          .gte('service_date', `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}-01`)
          .lt('service_date', `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`)
          .order('service_date', { ascending: false });

        if (servicesError) {
          console.error(`[SCHEDULED-REPORTS] Error fetching services for ${schedule.client_name}:`, servicesError);
          errorCount++;
          continue;
        }

        if (!services || services.length === 0) {
          console.log(`[SCHEDULED-REPORTS] No services found for ${schedule.client_name} in ${monthYear}`);
          continue;
        }

        const totalValue = services.reduce((sum, service) => sum + Number(service.service_value), 0);

        console.log(`[SCHEDULED-REPORTS] Found ${services.length} services for ${schedule.client_name}, total: R$ ${totalValue}`);

        // Send email if configured
        if (schedule.send_via_email && schedule.client_email) {
          try {
            console.log(`[SCHEDULED-REPORTS] Sending email to ${schedule.client_email}`);
            
            const emailHtml = generateEmailHTML(
              schedule.client_name,
              monthYear,
              services,
              companyInfo,
              totalValue
            );

            const fromEmail = companyInfo?.email 
              ? `${companyInfo.company_name} <${companyInfo.email}>`
              : 'Relatório Automático <onboarding@resend.dev>';

            await resend.emails.send({
              from: fromEmail,
              to: [schedule.client_email],
              subject: `Relatório Mensal - ${monthYear}`,
              html: emailHtml,
            });

            console.log(`[SCHEDULED-REPORTS] Email sent successfully to ${schedule.client_email}`);
          } catch (emailError) {
            console.error(`[SCHEDULED-REPORTS] Error sending email to ${schedule.client_email}:`, emailError);
          }
        }

        // Update last_sent_at
        await supabaseAdmin
          .from('automatic_report_schedules')
          .update({ last_sent_at: now.toISOString() })
          .eq('id', schedule.id);

        // Save to report history
        await supabaseAdmin.from('report_history').insert({
          user_id: schedule.user_id,
          client_name: schedule.client_name,
          month: monthYear,
          channel: schedule.send_via_email ? 'email' : 'whatsapp',
          recipient: schedule.client_email || schedule.client_phone || '',
          total_value: totalValue,
          services_count: services.length
        });

        successCount++;
        console.log(`[SCHEDULED-REPORTS] Successfully processed schedule ${schedule.id}`);
      } catch (scheduleError) {
        console.error(`[SCHEDULED-REPORTS] Error processing schedule ${schedule.id}:`, scheduleError);
        errorCount++;
      }
    }

    console.log(`[SCHEDULED-REPORTS] Completed: ${successCount} successful, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        message: 'Reports sent successfully',
        successful: successCount,
        errors: errorCount,
        total: schedules.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('[SCHEDULED-REPORTS] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function generateEmailHTML(
  clientName: string,
  month: string,
  services: any[],
  companyInfo: any,
  totalValue: number
): string {
  const servicesRows = services.map((service) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #ddd;">${service.service_name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: right;">
        R$ ${Number(service.service_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">
        ${new Date(service.service_date).toLocaleDateString('pt-BR')}
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Relatório Mensal Automático</title>
    </head>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
      <div style="max-width: 800px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px;">
        ${companyInfo?.logo_url ? `
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${companyInfo.logo_url}" alt="Logo" style="max-width: 200px; max-height: 100px;" />
          </div>
        ` : ''}
        
        <h1 style="color: #333; text-align: center; margin-bottom: 10px;">Relatório Mensal</h1>
        <p style="text-align: center; color: #666; margin-bottom: 30px;">Período: ${month}</p>
        
        ${companyInfo ? `
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 30px;">
            <h3 style="color: #333; margin-top: 0;">Informações da Empresa</h3>
            <p style="margin: 5px 0; color: #666;"><strong>Nome:</strong> ${companyInfo.company_name}</p>
            <p style="margin: 5px 0; color: #666;"><strong>Email:</strong> ${companyInfo.email}</p>
            <p style="margin: 5px 0; color: #666;"><strong>Telefone:</strong> ${companyInfo.phone}</p>
          </div>
        ` : ''}
        
        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 5px; margin-bottom: 30px; text-align: center;">
          <h2 style="color: #333; margin: 0;">Cliente: ${clientName}</h2>
          <p style="color: #666; margin: 10px 0 0 0;">Total de Serviços: ${services.length}</p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #333; color: white;">
              <th style="padding: 12px; text-align: left;">Serviço</th>
              <th style="padding: 12px; text-align: right;">Valor</th>
              <th style="padding: 12px; text-align: center;">Data</th>
            </tr>
          </thead>
          <tbody>
            ${servicesRows}
          </tbody>
        </table>
        
        <div style="text-align: right; padding: 20px; background-color: #f8f9fa; border-radius: 5px; border-top: 3px solid #333;">
          <p style="font-size: 24px; font-weight: bold; color: #333; margin: 0;">
            Total: R$ ${Number(totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 12px;">
          <p>Este é um relatório automático gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
