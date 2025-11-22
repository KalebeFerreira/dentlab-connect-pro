import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const { clientEmail, clientName, month, services, companyInfo, totalValue } = await req.json();

    if (!clientEmail) {
      return new Response(JSON.stringify({ error: 'Email do cliente é obrigatório' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Gerar HTML do relatório
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Relatório Mensal - ${clientName}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            color: #333;
            font-size: 28px;
          }
          .header p {
            margin: 5px 0;
            color: #666;
          }
          .company-info {
            margin-bottom: 30px;
            background: #f9f9f9;
            padding: 20px;
            border-radius: 5px;
          }
          .company-info p {
            margin: 5px 0;
          }
          .client-info {
            background: #e8f5e9;
            padding: 15px;
            margin-bottom: 30px;
            border-radius: 5px;
            border-left: 4px solid #4caf50;
          }
          .client-info h3 {
            margin-top: 0;
            color: #2e7d32;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
          }
          th {
            background-color: #333;
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
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px solid #333;
            color: #2e7d32;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            color: #666;
            font-size: 12px;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Relatório Mensal de Serviços</h1>
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

        <div class="client-info">
          <h3>Cliente: ${clientName}</h3>
          <p><strong>Período:</strong> ${month}</p>
          <p><strong>Total de Serviços:</strong> ${services.length}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Serviço</th>
              <th>Data</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            ${services.map((service: any) => `
              <tr>
                <td>${service.service_name}</td>
                <td>${new Date(service.service_date).toLocaleDateString('pt-BR')}</td>
                <td>R$ ${Number(service.service_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total">
          Total do Período: R$ ${Number(totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>

        <div class="footer">
          <p>Este é um relatório gerencial gerado automaticamente.</p>
          <p>Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
        </div>
      </body>
      </html>
    `;

    console.log('Enviando email para:', clientEmail);

    // Usar o email da empresa como remetente
    const fromEmail = companyInfo?.email || "onboarding@resend.dev";
    const fromName = companyInfo?.company_name || "Relatórios";

    const emailResponse = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [clientEmail],
      subject: `Relatório Mensal - ${clientName} - ${month}`,
      html: html,
    });

    console.log('Resposta do Resend:', emailResponse);

    // Verificar se houve erro do Resend
    if (emailResponse.error) {
      console.error('Erro do Resend:', emailResponse.error);
      throw new Error(emailResponse.error.message || 'Erro ao enviar email pelo Resend');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Email enviado com sucesso',
        emailId: emailResponse.data?.id 
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido ao enviar email' 
      }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
});