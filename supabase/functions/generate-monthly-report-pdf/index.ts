import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
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
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { services, companyInfo, totalValue, month } = await req.json();

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
          }
          .company-info p {
            margin: 5px 0;
          }
          .report-info {
            background: #f5f5f5;
            padding: 15px;
            margin-bottom: 30px;
            border-radius: 5px;
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
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            color: #666;
            font-size: 12px;
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

        <div class="report-info">
          <p><strong>Período:</strong> ${month}</p>
          <p><strong>Total de Serviços:</strong> ${services.length}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Serviço</th>
              <th>Cliente</th>
              <th>Data</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            ${services.map((service: any) => `
              <tr>
                <td>${service.service_name}</td>
                <td>${service.client_name || '-'}</td>
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

    return new Response(
      JSON.stringify({ html }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
