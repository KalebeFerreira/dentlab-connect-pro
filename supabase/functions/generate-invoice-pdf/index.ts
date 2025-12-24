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

    // Logo Essência Dental-Lab para plano gratuito (usar logo em base64 inline)
    const essenciaLogoSvg = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCAxMjAgNDAiPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iNDAiIGZpbGw9IiMxYzQ1ODciIHJ4PSI1Ii8+PHRleHQgeD0iNjAiIHk9IjI1IiBmaWxsPSJ3aGl0ZSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmb250LXdlaWdodD0iYm9sZCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RXNzw6puY2lhIERlbnRhbC1MYWI8L3RleHQ+PC9zdmc+`;
    const showFreemiumLogo = !isSubscribed;

    const { services, companyInfo, totalValue, observations } = await req.json() as {
      services: Service[];
      companyInfo: CompanyInfo;
      totalValue: number;
      observations?: string;
    };

    // Get next invoice number
    const { data: invoiceNumber, error: numberError } = await supabase.rpc(
      'get_next_document_number',
      { p_user_id: user.id, p_document_type: 'invoice' }
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
            .header { text-align: center; margin-bottom: 40px; border: 2px solid #000; padding: 20px; }
            .header h1 { font-size: 32px; margin-bottom: 10px; color: #000; }
            .header .invoice-number { font-size: 14px; color: #000; }
            .info-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .info-box { width: 48%; }
            .info-box h2 { font-size: 16px; margin-bottom: 10px; border-bottom: 1px solid #000; padding-bottom: 5px; color: #000; }
            .info-box p { margin-bottom: 5px; color: #000; font-size: 14px; }
            .services-table { width: 100%; border-collapse: collapse; margin: 30px 0; border: 1px solid #000; }
            .services-table th, .services-table td { padding: 12px; text-align: left; border: 1px solid #000; color: #000; }
            .services-table th { background-color: #f0f0f0; font-weight: bold; }
            .total-section { text-align: right; margin-top: 20px; padding: 15px; background-color: #f5f5f5; border: 2px solid #000; }
            .total-section p { font-size: 18px; font-weight: bold; color: #000; }
            .observations { margin-top: 30px; padding: 15px; border: 1px solid #000; background-color: #f9f9f9; }
            .observations h3 { font-size: 14px; margin-bottom: 10px; color: #000; }
            .observations p { font-size: 12px; color: #000; }
            .footer { margin-top: 50px; text-align: center; padding-top: 20px; border-top: 1px solid #000; }
            .footer p { color: #000; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="header">
            ${companyInfo.logo_url ? `
              <div style="text-align: center; margin-bottom: 20px;">
                <img src="${companyInfo.logo_url}" alt="Logo" style="max-width: 150px; max-height: 80px;" />
              </div>
            ` : ''}
            <h1>NOTA FISCAL DE SERVIÇOS</h1>
            <p class="invoice-number">Número: ${invoiceNumber}</p>
            <p class="invoice-number">Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}</p>
          </div>
          
          <div class="info-section">
            <div class="info-box">
              <h2>Prestador de Serviços</h2>
              <p><strong>Razão Social:</strong> ${companyInfo.company_name}</p>
              <p><strong>CPF/CNPJ:</strong> ${companyInfo.cpf_cnpj}</p>
              <p><strong>E-mail:</strong> ${companyInfo.email}</p>
              <p><strong>Telefone:</strong> ${companyInfo.phone}</p>
            </div>
            <div class="info-box">
              <h2>Informações da Nota</h2>
              <p><strong>Número:</strong> ${invoiceNumber}</p>
              <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
              <p><strong>Hora:</strong> ${new Date().toLocaleTimeString('pt-BR')}</p>
            </div>
          </div>
          
          <table class="services-table">
            <thead>
              <tr>
                <th>Descrição do Serviço</th>
                <th>Cliente</th>
                <th>Data</th>
                <th style="text-align: right;">Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              ${services.map(service => `
                <tr>
                  <td>${service.service_name}</td>
                  <td>${service.client_name || 'Não informado'}</td>
                  <td>${new Date(service.service_date).toLocaleDateString('pt-BR')}</td>
                  <td style="text-align: right;">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(service.service_value)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="total-section">
            <p>VALOR TOTAL: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}</p>
          </div>
          
          ${observations ? `
            <div class="observations">
              <h3>Observações</h3>
              <p>${observations}</p>
            </div>
          ` : ''}
          
          <div class="footer">
            ${showFreemiumLogo ? `
              <div style="text-align: center; margin-bottom: 15px;">
                <img src="${essenciaLogoSvg}" alt="Essência Dental-Lab" style="max-width: 100px; max-height: 35px;" />
                <p style="font-size: 9px; color: #666; margin-top: 5px;">Gerado com Essência Dental-Lab</p>
              </div>
            ` : ''}
            <p>Esta nota fiscal foi emitida em conformidade com a legislação vigente.</p>
            <p>Documento gerado eletronicamente e dispensa assinatura conforme legislação.</p>
          </div>
        </body>
      </html>
    `;

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
