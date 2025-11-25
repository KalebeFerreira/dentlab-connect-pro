import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create service role client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Authentication failed:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check subscription status
    const { data: subscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select('status, plan_name')
      .eq('user_id', user.id)
      .single();

    const isSubscribed = subscription?.status === 'active' && subscription?.plan_name !== 'free';

    // If not subscribed, check PDF generation limit
    if (!isSubscribed) {
      const { data: pdfUsage } = await supabaseAdmin.rpc(
        'get_monthly_pdf_usage',
        { p_user_id: user.id }
      );

      const PDF_LIMIT = 2;
      if (pdfUsage >= PDF_LIMIT) {
        return new Response(
          JSON.stringify({ 
            error: 'Limite de PDFs atingido',
            message: `Você atingiu o limite de ${PDF_LIMIT} PDFs por mês do plano gratuito. Faça upgrade para gerar PDFs ilimitados.`
          }),
          { 
            status: 403, 
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } 
          }
        );
      }

      // Increment PDF usage
      await supabaseAdmin.rpc('increment_pdf_usage', { p_user_id: user.id });
    }

    const { services, companyInfo, totalValue, month, isConsolidated, months } = await req.json();

    // Agrupar serviços por clínica
    const servicesByClinic = services.reduce((acc: any, service: any) => {
      const clinicName = service.client_name || "Sem Clínica";
      if (!acc[clinicName]) {
        acc[clinicName] = [];
      }
      acc[clinicName].push(service);
      return acc;
    }, {});

    const clinicNames = Object.keys(servicesByClinic).sort();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Relatório Mensal</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            color: #000;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #000;
            padding-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            color: #000;
            font-size: 28px;
          }
          .header p {
            margin: 5px 0;
            color: #000;
          }
          .company-info {
            margin-bottom: 30px;
          }
          .company-info p {
            margin: 5px 0;
            color: #000;
          }
          .report-info {
            background: #f5f5f5;
            padding: 15px;
            margin-bottom: 30px;
            border-radius: 5px;
            color: #000;
          }
          .clinic-section {
            margin-bottom: 40px;
            page-break-inside: avoid;
          }
          .clinic-header {
            background: #e8e8e8;
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 5px;
            border-left: 4px solid #000;
          }
          .clinic-header h2 {
            margin: 0 0 10px 0;
            color: #000;
            font-size: 20px;
          }
          .clinic-header .clinic-total {
            font-weight: bold;
            font-size: 16px;
            color: #000;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
            color: #000;
          }
          th {
            background-color: #000;
            color: white;
            font-weight: bold;
          }
          tr:hover {
            background-color: #f5f5f5;
          }
          .total {
            text-align: right;
            font-size: 20px;
            font-weight: bold;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 3px solid #000;
            color: #000;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            color: #000;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${companyInfo?.logo_url ? `
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="${companyInfo.logo_url}" alt="Logo" style="max-width: 150px; max-height: 80px;" />
            </div>
          ` : ''}
          <h1>${isConsolidated ? 'Relatório Consolidado de Serviços' : 'Relatório Mensal de Serviços'}</h1>
          <p>Data de emissão: ${new Date().toLocaleDateString('pt-BR')}</p>
        </div>

        ${companyInfo ? `
          <div class="company-info">
            <h3>Dados da Empresa</h3>
            <p><strong>Nome:</strong> ${companyInfo.company_name}</p>
            <p><strong>CPF/CNPJ:</strong> ${companyInfo.cpf_cnpj}</p>
            <p><strong>Email:</strong> ${companyInfo.email}</p>
            <p><strong>Telefone:</strong> ${companyInfo.phone}</p>
          </div>
        ` : ''}

        <div class="report-info">
          <p><strong>Período:</strong> ${month}</p>
          ${isConsolidated && months ? `<p><strong>Meses incluídos:</strong> ${months.join(', ')}</p>` : ''}
          <p><strong>Total de Serviços:</strong> ${services.length}</p>
        </div>

        ${clinicNames.map((clinicName: string) => {
          const clinicServices = servicesByClinic[clinicName];
          const clinicTotal = clinicServices.reduce(
            (sum: number, service: any) => sum + Number(service.service_value),
            0
          );

          return `
            <div class="clinic-section">
              <div class="clinic-header">
                <h2>${clinicName}</h2>
                <div class="clinic-total">
                  Subtotal: R$ ${clinicTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">
                  ${clinicServices.length} ${clinicServices.length === 1 ? 'serviço' : 'serviços'}
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Serviço</th>
                    <th>Paciente</th>
                    <th>Data</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  ${clinicServices.map((service: any) => `
                    <tr>
                      <td>${service.service_name}</td>
                      <td>${service.patient_name || '-'}</td>
                      <td>${new Date(service.service_date).toLocaleDateString('pt-BR')}</td>
                      <td>R$ ${Number(service.service_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        }).join('')}

        <div class="total">
          Total Geral do Período: R$ ${Number(totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>

        <div class="footer">
          <p>Este é um relatório gerencial gerado automaticamente.</p>
          <p>Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
        </div>
      </body>
      </html>
    `;

    return new Response(
      JSON.stringify({ html }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    );
  } catch (error) {
    console.error('Error generating monthly report PDF:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
