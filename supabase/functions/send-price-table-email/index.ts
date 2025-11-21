import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface PriceItem {
  workType: string;
  description: string;
  price: string;
  imageUrl: string | null;
}

interface EmailRequest {
  to: string;
  tableName: string;
  items: PriceItem[];
  laboratoryName?: string;
  laboratoryEmail?: string;
  message?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, tableName, items, laboratoryName, laboratoryEmail, message }: EmailRequest = await req.json();

    console.log('Sending price table email to:', to);
    console.log('Table name:', tableName);
    console.log('Number of items:', items?.length);

    if (!to || !to.includes('@')) {
      throw new Error('Email do destinatário inválido');
    }

    if (!items || items.length === 0) {
      throw new Error('A tabela deve conter pelo menos um item');
    }

    // Generate table rows HTML
    const tableRows = items.map((item, index) => {
      const price = parseFloat(item.price || '0');
      const formattedPrice = price.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      const imageHTML = item.imageUrl
        ? `<img src="${item.imageUrl}" alt="${item.workType}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; display: block;" />`
        : `<div style="width: 80px; height: 80px; background: #f0f0f0; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 12px;">Sem imagem</div>`;

      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 8px; color: #374151;">${item.workType || '-'}</td>
          <td style="padding: 12px 8px; color: #374151;">${item.description || '-'}</td>
          <td style="padding: 12px 8px; text-align: right; font-weight: 600; color: #374151;">R$ ${formattedPrice}</td>
          <td style="padding: 12px 8px; text-align: center;">${imageHTML}</td>
        </tr>
      `;
    }).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${tableName}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f9fafb;">
        <div style="max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px 20px; text-align: center;">
            <h1 style="margin: 0 0 8px 0; font-size: 24px;">${tableName}</h1>
            <p style="margin: 0; font-size: 14px; opacity: 0.9;">Tabela de Preços - ${new Date().toLocaleDateString('pt-BR')}</p>
          </div>

          ${message ? `
          <div style="padding: 20px; background: #f8f9fa; border-bottom: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">${message}</p>
          </div>
          ` : ''}

          <!-- Table -->
          <div style="padding: 20px; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
              <thead>
                <tr style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white;">
                  <th style="padding: 12px 8px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase;">Tipo de Trabalho</th>
                  <th style="padding: 12px 8px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase;">Descrição</th>
                  <th style="padding: 12px 8px; text-align: center; font-size: 12px; font-weight: 600; text-transform: uppercase;">Preço</th>
                  <th style="padding: 12px 8px; text-align: center; font-size: 12px; font-weight: 600; text-transform: uppercase;">Imagem</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>

          ${laboratoryName || laboratoryEmail ? `
          <div style="padding: 20px; background: #f8f9fa; border-top: 1px solid #e5e7eb;">
            <div style="border-left: 4px solid #3b82f6; padding: 12px 16px; background: white; border-radius: 4px;">
              ${laboratoryName ? `<p style="color: #1f2937; font-size: 14px; line-height: 1.5; margin: 0 0 4px 0; font-weight: 600;">${laboratoryName}</p>` : ''}
              ${laboratoryEmail ? `<p style="color: #3b82f6; font-size: 13px; margin: 0;">📧 ${laboratoryEmail}</p>` : ''}
            </div>
          </div>
          ` : ''}
        </div>
      </body>
      </html>
    `;

    const pdfHtml = generatePDFHTML(tableName, items, laboratoryName || "", laboratoryEmail || "");
    const pdfBase64 = btoa(unescape(encodeURIComponent(pdfHtml)));

    const emailPayload = {
      from: 'DentLab Connect <onboarding@resend.dev>',
      to: [to],
      subject: `${tableName} - Tabela de Preços`,
      html: emailHtml,
      attachments: [
        {
          filename: `${tableName}.html`,
          content: pdfBase64,
        }
      ]
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Resend API error:', error);
      throw new Error(`Failed to send email: ${error}`);
    }

    const data = await response.json();
    console.log('Email sent successfully:', data);

    return new Response(
      JSON.stringify({ success: true, messageId: data.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error sending price table email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function generatePDFHTML(tableName: string, items: PriceItem[], laboratoryName: string, laboratoryEmail: string): string {
  const date = new Date().toLocaleDateString('pt-BR');
  
  const itemsHTML = items
    .map((item) => {
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
          color: #1f2937;
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
          color: #374151;
          padding: 12px 8px !important;
        }
        
        .footer {
          margin-top: 20px;
          padding-top: 15px;
          border-top: 2px solid #e5e7eb;
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
          color: #1f2937;
          font-size: 16px;
          font-weight: 700;
          display: block;
          margin-bottom: 10px;
        }
        
        .notes p {
          color: #1f2937;
          font-size: 15px;
          line-height: 1.7;
          margin: 0;
          word-wrap: break-word;
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
      
      ${laboratoryName || laboratoryEmail ? `
      <div class="notes">
        ${laboratoryName ? `<p style="font-weight: 600; margin-bottom: 4px;">${laboratoryName}</p>` : ''}
        ${laboratoryEmail ? `<p style="color: #3b82f6;">📧 ${laboratoryEmail}</p>` : ''}
      </div>
      ` : ''}
    </body>
    </html>
  `;
}
