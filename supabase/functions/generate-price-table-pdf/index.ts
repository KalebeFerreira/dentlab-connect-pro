import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tableName, items, notes } = await req.json();

    console.log('Generating PDF for:', tableName);
    console.log('Number of items:', items?.length);
    console.log('Notes:', notes);

    if (!items || items.length === 0) {
      throw new Error('Nenhum item para gerar PDF');
    }

    // Generate HTML for PDF
    const html = generatePDFHTML(tableName, items, notes || "");
    
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

function generatePDFHTML(tableName: string, items: any[], notes: string): string {
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
          <td style="padding: 16px; text-align: center;">${index + 1}</td>
          <td style="padding: 16px;">${item.workType || '-'}</td>
          <td style="padding: 16px;">${item.description || '-'}</td>
          <td style="padding: 16px; text-align: right; font-weight: 600;">R$ ${formattedPrice}</td>
          <td style="padding: 16px; text-align: center;">${imageHTML}</td>
        </tr>
      `;
    })
    .join('');

  const total = items.reduce((sum, item) => sum + parseFloat(item.price || '0'), 0);
  const formattedTotal = total.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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
          padding: 40px;
          background: white;
          color: #1f2937;
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 3px solid #3b82f6;
        }
        
        .header h1 {
          font-size: 28px;
          color: #1f2937;
          margin-bottom: 8px;
        }
        
        .header .date {
          color: #6b7280;
          font-size: 14px;
        }
        
        .table-container {
          margin-bottom: 30px;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #e5e7eb;
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
          padding: 16px;
          text-align: left;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        thead th:first-child,
        thead th:nth-child(4),
        thead th:nth-child(5) {
          text-align: center;
        }
        
        tbody tr:hover {
          background: #f9fafb;
        }
        
        tbody td {
          font-size: 14px;
          color: #374151;
        }
        
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
        }
        
        .total-row {
          text-align: right;
          padding: 20px 0;
        }
        
        .total-label {
          color: #6b7280;
          font-size: 18px;
          font-weight: 600;
          margin-right: 10px;
        }
        
        .total-value {
          color: #3b82f6;
          font-size: 24px;
          font-weight: 700;
        }
        
        .notes {
          margin-top: 30px;
          margin-bottom: 20px;
          padding: 15px 20px;
          background-color: #f8f9fa;
          border-left: 4px solid #3b82f6;
          border-radius: 4px;
        }
        
        .notes strong {
          color: #1f2937;
          font-size: 14px;
          display: block;
          margin-bottom: 8px;
        }
        
        .notes p {
          color: #4b5563;
          font-size: 13px;
          line-height: 1.6;
          margin: 0;
        }
        
        .footer-info {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          color: #9ca3af;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }
        
        @media print {
          body {
            padding: 20px;
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
        <h1>${tableName}</h1>
        <p class="date">Gerado em ${date}</p>
      </div>
      
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th style="width: 60px;">#</th>
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
      
      <div class="footer">
        <div class="total-row">
          <span class="total-label">Valor Total:</span>
          <span class="total-value">R$ ${formattedTotal}</span>
        </div>
        
        ${notes ? `
        <div class="notes">
          <strong>Observações:</strong>
          <p>${notes}</p>
        </div>
        ` : ''}
        
        <div class="footer-info">
          <p style="margin-bottom: 5px;">Tabela gerada automaticamente pelo sistema DentLab Connect</p>
          <p>Este documento é válido como orçamento e pode ser usado para consultas e aprovações</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
