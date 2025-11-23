import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Service {
  service_name: string;
  service_value: number;
  service_date: string;
  client_name?: string;
}

interface CompanyInfo {
  company_name: string;
  cpf_cnpj: string;
  email: string;
  phone: string;
  logo_url?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    
    // Create service role client to verify JWT and perform operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the JWT token and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Authentication failed:', userError);
      throw new Error('Unauthorized');
    }

    // Check subscription status
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('status, plan_name')
      .eq('user_id', user.id)
      .single();

    const isSubscribed = subscription?.status === 'active' && subscription?.plan_name !== 'free';

    // If not subscribed, check PDF generation limit
    if (!isSubscribed) {
      const { data: pdfUsage } = await supabase.rpc(
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
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Increment PDF usage
      await supabase.rpc('increment_pdf_usage', { p_user_id: user.id });
    }

    const { services, companyInfo, totalValue } = await req.json() as {
      services: Service[];
      companyInfo: CompanyInfo;
      totalValue: number;
    };

    // Get next receipt number
    const { data: receiptNumber, error: numberError } = await supabase.rpc(
      'get_next_document_number',
      { p_user_id: user.id, p_document_type: 'receipt' }
    );

    if (numberError) throw numberError;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 40px; color: #000; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px; }
            .header h1 { font-size: 32px; margin-bottom: 10px; color: #000; }
            .header .doc-number { font-size: 16px; font-weight: bold; color: #000; margin-bottom: 5px; }
            .header p { color: #000; }
            .company-info { margin-bottom: 30px; }
            .company-info h2 { font-size: 18px; margin-bottom: 15px; color: #000; }
            .company-info p { margin-bottom: 5px; color: #000; }
            .services-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
            .services-table th, .services-table td { padding: 12px; text-align: left; border-bottom: 1px solid #000; color: #000; }
            .services-table th { background-color: #f5f5f5; font-weight: bold; }
            .services-table tr:hover { background-color: #f9f9f9; }
            .total { text-align: right; margin-top: 20px; font-size: 20px; font-weight: bold; color: #000; }
            .signature { margin-top: 80px; }
            .signature-line { border-top: 1px solid #000; width: 300px; margin: 0 auto; padding-top: 10px; text-align: center; color: #000; }
            .footer { margin-top: 50px; text-align: center; color: #000; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            ${companyInfo.logo_url ? `
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="${companyInfo.logo_url}" alt="Logo" style="max-width: 150px; max-height: 80px;" />
              </div>
            ` : ''}
            <h1>RECIBO</h1>
            <p class="doc-number">Número: ${receiptNumber}</p>
            <p>Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}</p>
          </div>
          
          <div class="company-info">
            <h2>Dados da Empresa</h2>
            <p><strong>Razão Social:</strong> ${companyInfo.company_name}</p>
            <p><strong>CPF/CNPJ:</strong> ${companyInfo.cpf_cnpj}</p>
            <p><strong>E-mail:</strong> ${companyInfo.email}</p>
            <p><strong>Telefone:</strong> ${companyInfo.phone}</p>
          </div>
          
          <table class="services-table">
            <thead>
              <tr>
                <th>Serviço</th>
                <th>Cliente</th>
                <th>Data</th>
                <th style="text-align: right;">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${services.map(service => `
                <tr>
                  <td>${service.service_name}</td>
                  <td>${service.client_name || '-'}</td>
                  <td>${new Date(service.service_date).toLocaleDateString('pt-BR')}</td>
                  <td style="text-align: right;">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(service.service_value)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="total">
            Total: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
          </div>
          
          <div class="signature">
            <div class="signature-line">
              Assinatura
            </div>
          </div>
          
          <div class="footer">
            <p>Este documento é um recibo válido de serviços prestados.</p>
          </div>
        </body>
      </html>
    `;

    // Use Deno's built-in text encoder to convert HTML to PDF would require additional libraries
    // For now, we'll return the HTML and let the frontend handle PDF generation
    // In production, you'd use a service like Puppeteer or a PDF generation library
    
    return new Response(
      JSON.stringify({ html }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
