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

        // Get financial transactions for insights
        const { data: transactions } = await supabaseAdmin
          .from('financial_transactions')
          .select('*')
          .eq('user_id', schedule.user_id)
          .eq('month', lastMonth)
          .eq('year', lastMonthYear)
          .eq('status', 'completed');

        // Calculate financial metrics for insights
        const financialInsights = calculateFinancialInsights(transactions || []);

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
              totalValue,
              financialInsights
            );

            const fromEmail = companyInfo?.email 
              ? `${companyInfo.company_name} <${companyInfo.email}>`
              : 'Relatório Automático <onboarding@resend.dev>';

            await resend.emails.send({
              from: fromEmail,
              to: [schedule.client_email],
              subject: `📊 Relatório Mensal com Insights - ${monthYear}`,
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

interface FinancialInsights {
  totalIncome: number;
  totalExpense: number;
  profit: number;
  profitMargin: number;
  topCategories: { category: string; amount: number }[];
  alerts: string[];
  praise: string[];
  tips: string[];
}

function calculateFinancialInsights(transactions: any[]): FinancialInsights {
  const income = transactions
    .filter(t => t.transaction_type === 'receipt')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const expense = transactions
    .filter(t => t.transaction_type === 'payment')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const profit = income - expense;
  const profitMargin = income > 0 ? (profit / income) * 100 : 0;

  // Group expenses by category
  const categoryExpenses: Record<string, number> = {};
  transactions
    .filter(t => t.transaction_type === 'payment')
    .forEach(t => {
      const category = t.category || 'Outros';
      categoryExpenses[category] = (categoryExpenses[category] || 0) + Number(t.amount);
    });

  const topCategories = Object.entries(categoryExpenses)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const alerts: string[] = [];
  const praise: string[] = [];
  const tips: string[] = [];

  // Generate insights
  if (income > 0 && expense / income > 0.8) {
    alerts.push('⚠️ Despesas representam mais de 80% da receita');
    tips.push('💡 Revise despesas fixas e busque alternativas mais econômicas');
  }

  if (profit < 0) {
    alerts.push('🔴 O mês fechou com prejuízo');
    tips.push('💡 Avalie renegociar contratos com fornecedores');
  }

  if (profitMargin > 30) {
    praise.push('🎉 Excelente margem de lucro! Acima de 30%');
  } else if (profitMargin > 20) {
    praise.push('✅ Boa margem de lucro! Entre 20-30%');
  }

  if (profit > 0 && expense < income * 0.5) {
    praise.push('🌟 Ótimo controle de despesas! Menos de 50% da receita');
  }

  // Category-specific tips
  if (categoryExpenses['Materiais'] && categoryExpenses['Materiais'] > income * 0.3) {
    tips.push('💡 Materiais representam mais de 30% da receita - considere compras em atacado');
  }

  if (categoryExpenses['Contas Fixas'] && categoryExpenses['Contas Fixas'] > income * 0.2) {
    tips.push('💡 Contas fixas estão elevadas - renegocie contratos');
  }

  return {
    totalIncome: income,
    totalExpense: expense,
    profit,
    profitMargin,
    topCategories,
    alerts,
    praise,
    tips
  };
}

function generateEmailHTML(
  clientName: string,
  month: string,
  services: any[],
  companyInfo: any,
  totalValue: number,
  insights: FinancialInsights
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

  const formatCurrency = (value: number) => 
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const insightsSection = `
    <div style="margin-top: 40px;">
      <h2 style="color: #333; border-bottom: 2px solid #1c4587; padding-bottom: 10px; margin-bottom: 20px;">
        📊 Insights Financeiros do Mês
      </h2>
      
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px;">
        <div style="background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); padding: 20px; border-radius: 12px; text-align: center;">
          <p style="color: #666; font-size: 12px; margin: 0; text-transform: uppercase;">Receitas</p>
          <p style="color: #16a34a; font-size: 20px; font-weight: bold; margin: 8px 0 0 0;">${formatCurrency(insights.totalIncome)}</p>
        </div>
        <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); padding: 20px; border-radius: 12px; text-align: center;">
          <p style="color: #666; font-size: 12px; margin: 0; text-transform: uppercase;">Despesas</p>
          <p style="color: #dc2626; font-size: 20px; font-weight: bold; margin: 8px 0 0 0;">${formatCurrency(insights.totalExpense)}</p>
        </div>
        <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); padding: 20px; border-radius: 12px; text-align: center;">
          <p style="color: #666; font-size: 12px; margin: 0; text-transform: uppercase;">Lucro</p>
          <p style="color: ${insights.profit >= 0 ? '#2563eb' : '#dc2626'}; font-size: 20px; font-weight: bold; margin: 8px 0 0 0;">${formatCurrency(insights.profit)}</p>
        </div>
      </div>

      ${insights.praise.length > 0 ? `
        <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px 20px; margin-bottom: 15px; border-radius: 0 8px 8px 0;">
          <h4 style="color: #16a34a; margin: 0 0 10px 0;">Parabéns!</h4>
          ${insights.praise.map(p => `<p style="color: #333; margin: 5px 0;">${p}</p>`).join('')}
        </div>
      ` : ''}

      ${insights.alerts.length > 0 ? `
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px 20px; margin-bottom: 15px; border-radius: 0 8px 8px 0;">
          <h4 style="color: #dc2626; margin: 0 0 10px 0;">Alertas</h4>
          ${insights.alerts.map(a => `<p style="color: #333; margin: 5px 0;">${a}</p>`).join('')}
        </div>
      ` : ''}

      ${insights.tips.length > 0 ? `
        <div style="background: #fffbeb; border-left: 4px solid #d97706; padding: 15px 20px; margin-bottom: 15px; border-radius: 0 8px 8px 0;">
          <h4 style="color: #d97706; margin: 0 0 10px 0;">Dicas de Economia</h4>
          ${insights.tips.map(t => `<p style="color: #333; margin: 5px 0;">${t}</p>`).join('')}
        </div>
      ` : ''}

      ${insights.topCategories.length > 0 ? `
        <div style="margin-top: 20px;">
          <h4 style="color: #333; margin-bottom: 15px;">Principais Categorias de Despesas</h4>
          <table style="width: 100%; border-collapse: collapse;">
            ${insights.topCategories.map((cat, index) => `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                  <span style="display: inline-block; width: 20px; height: 20px; background: ${['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index]}; border-radius: 4px; margin-right: 10px; vertical-align: middle;"></span>
                  ${cat.category}
                </td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">
                  ${formatCurrency(cat.amount)}
                </td>
              </tr>
            `).join('')}
          </table>
        </div>
      ` : ''}
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Relatório Mensal com Insights</title>
      <style>
        @media only screen and (max-width: 600px) {
          .grid-3 { display: block !important; }
          .grid-3 > div { margin-bottom: 15px !important; }
        }
      </style>
    </head>
    <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5; margin: 0;">
      <div style="max-width: 800px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px;">
        ${companyInfo?.logo_url ? `
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${companyInfo.logo_url}" alt="Logo" style="max-width: 200px; max-height: 100px;" />
          </div>
        ` : ''}
        
        <h1 style="color: #1c4587; text-align: center; margin-bottom: 10px;">📈 Relatório Mensal com Insights</h1>
        <p style="text-align: center; color: #666; margin-bottom: 30px;">Período: ${month}</p>
        
        ${companyInfo ? `
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h3 style="color: #333; margin-top: 0;">Informações da Empresa</h3>
            <p style="margin: 5px 0; color: #666;"><strong>Nome:</strong> ${companyInfo.company_name}</p>
            <p style="margin: 5px 0; color: #666;"><strong>Email:</strong> ${companyInfo.email}</p>
            <p style="margin: 5px 0; color: #666;"><strong>Telefone:</strong> ${companyInfo.phone}</p>
          </div>
        ` : ''}
        
        <div style="background: linear-gradient(135deg, #1c4587 0%, #2563eb 100%); padding: 25px; border-radius: 12px; margin-bottom: 30px; text-align: center; color: white;">
          <h2 style="margin: 0; color: white;">Cliente: ${clientName}</h2>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Total de Serviços: ${services.length}</p>
        </div>
        
        <h3 style="color: #333; border-bottom: 2px solid #1c4587; padding-bottom: 10px;">📋 Serviços Realizados</h3>
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
        
        <div style="text-align: right; padding: 25px; background: linear-gradient(135deg, #f8f9fa 0%, #e5e7eb 100%); border-radius: 12px; border-top: 4px solid #1c4587;">
          <p style="font-size: 28px; font-weight: bold; color: #1c4587; margin: 0;">
            Total: R$ ${Number(totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        
        ${insightsSection}
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee; text-align: center; color: #999; font-size: 12px;">
          <p>📧 Este é um relatório automático gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
          <p style="margin-top: 10px;">
            <a href="#" style="color: #1c4587; text-decoration: none;">Gerenciar preferências de email</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}
