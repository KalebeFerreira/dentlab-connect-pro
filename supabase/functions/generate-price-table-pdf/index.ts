import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = await createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const supabaseAdmin = await createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check subscription status
    const { data: subscription } = await supabaseAdmin
      .from('user_subscriptions')
      .select('status, plan_name')
      .eq('user_id', user.id)
      .single();

    const isSubscribed = subscription?.status === 'active' && subscription?.plan_name !== 'free';

    // Logo Essência Dental-Lab para plano gratuito (usar logo em base64 inline)
    const essenciaLogoSvg = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCAxMjAgNDAiPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iNDAiIGZpbGw9IiMxYzQ1ODciIHJ4PSI1Ii8+PHRleHQgeD0iNjAiIHk9IjI1IiBmaWxsPSJ3aGl0ZSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmb250LXdlaWdodD0iYm9sZCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RXNzw6puY2lhIERlbnRhbC1MYWI8L3RleHQ+PC9zdmc+`;
    const showFreemiumLogo = !isSubscribed;

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
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Increment PDF usage
      await supabaseAdmin.rpc('increment_pdf_usage', { p_user_id: user.id });
    }

    const { tableName, items, laboratoryName } = await req.json();

    console.log('Generating PDF for:', tableName);
    console.log('Number of items:', items?.length);
    console.log('Laboratory Name:', laboratoryName);

    if (!items || items.length === 0) {
      throw new Error('Nenhum item para gerar PDF');
    }

    // Generate HTML for PDF
    const html = generatePDFHTML(tableName, items, laboratoryName || "", showFreemiumLogo, essenciaLogoSvg);
    
    // For now, we'll return the HTML that can be used with a client-side PDF library
    // In a production environment, you could use a service like Puppeteer
    return new Response(
      JSON.stringify({ 
        html,
        success: true 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error generating PDF:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generatePDFHTML(tableName: string, items: any[], laboratoryName: string, showFreemiumLogo: boolean, essenciaLogo: string): string {
  const date = new Date().toLocaleDateString('pt-BR');
  
  const itemsHTML = items
    .map((item, index) => {
      const imageHTML = item.imageUrl
        ? `<img src="${item.imageUrl}" alt="${item.workType}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;" />`
        : `<div style="width: 80px; height: 80px; background: #f0f0f0; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #999;">Sem imagem</div>`;

      const price = parseFloat(item.price || '0');
      const formattedPrice = price.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 16px;">${item.workType || '-'}</td>
          <td style="padding: 16px;">${item.description || '-'}</td>
          <td style="padding: 16px; text-align: right; font-weight: 600;">R$ ${formattedPrice}</td>
          <td style="padding: 16px; text-align: center;">${imageHTML}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${tableName}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          padding: 20px;
          background: white;
          color: #000;
          font-size: 14px;
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 3px solid #3b82f6;
        }
        
        .header h1 {
          font-size: 28px;
          color: #000;
          margin-bottom: 8px;
        }
        
        .header .date {
          color: #000;
          font-size: 14px;
        }
        
        .table-container {
          margin-bottom: 30px;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #000;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
        }
        
        thead {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
        }
        
        thead th {
          padding: 12px 8px;
          text-align: left;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        
        thead th:nth-child(3),
        thead th:nth-child(4) {
          text-align: center;
        }
        
        tbody tr:hover {
          background: #f9fafb;
        }
        
        tbody td {
          font-size: 13px;
          color: #000;
          padding: 12px 8px !important;
        }
        
        .footer {
          margin-top: 20px;
          padding-top: 15px;
          border-top: 2px solid #000;
        }
        
        .notes {
          margin-top: 20px;
          margin-bottom: 15px;
          padding: 12px 16px;
          background-color: #f8f9fa;
          border-left: 4px solid #3b82f6;
          border-radius: 4px;
        }
        
        .notes strong {
          color: #000;
          font-size: 16px;
          font-weight: 700;
          display: block;
          margin-bottom: 10px;
        }
        
        .notes p {
          color: #000;
          font-size: 15px;
          line-height: 1.7;
          margin: 0;
          word-wrap: break-word;
        }
        
        .footer-info {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          color: #000;
          padding-top: 20px;
          border-top: 1px solid #000;
        }
        
        @media screen and (max-width: 768px) {
          body {
            padding: 10px;
            font-size: 12px;
          }
          
          .header h1 {
            font-size: 20px;
          }
          
          thead th {
            padding: 8px 4px;
            font-size: 10px;
          }
          
          tbody td {
            padding: 8px 4px !important;
            font-size: 11px;
          }
          
          .notes {
            padding: 10px 12px;
          }
        }
        
        @media print {
          body {
            padding: 15px;
          }
          
          .header {
            page-break-after: avoid;
          }
          
          table {
            page-break-inside: auto;
          }
          
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${laboratoryName ? `
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${laboratoryName}" alt="Logo" style="max-width: 150px; max-height: 80px;" />
          </div>
        ` : ''}
        <h1>${tableName}</h1>
        <p class="date">Gerado em ${date}</p>
      </div>
      
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th style="width: 200px;">Tipo de Trabalho</th>
              <th>Descrição</th>
              <th style="width: 120px;">Preço</th>
              <th style="width: 120px;">Imagem</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
      </table>
      </div>
      
      ${laboratoryName ? `
      <div class="notes">
        <p>${laboratoryName}</p>
      </div>
      ` : ''}
      
      ${showFreemiumLogo ? `
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <img src="${essenciaLogo}" alt="Essência Dental-Lab" style="max-width: 100px; max-height: 35px;" />
        <p style="font-size: 9px; color: #666; margin-top: 5px;">Gerado com Essência Dental-Lab</p>
      </div>
      ` : ''}
    </body>
    </html>
  `;
}
