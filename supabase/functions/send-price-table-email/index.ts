import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
  notes?: string;
  message?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, tableName, items, notes, message }: EmailRequest = await req.json();

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
          <td style="padding: 12px 8px; text-align: center; color: #374151;">${index + 1}</td>
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
                  <th style="padding: 12px 8px; text-align: center; font-size: 12px; font-weight: 600; text-transform: uppercase;">#</th>
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

          ${notes ? `
          <div style="padding: 20px; background: #f8f9fa; border-top: 1px solid #e5e7eb;">
            <div style="border-left: 4px solid #3b82f6; padding: 12px 16px; background: white; border-radius: 4px;">
              <strong style="color: #1f2937; font-size: 13px; display: block; margin-bottom: 6px;">Observações:</strong>
              <p style="color: #4b5563; font-size: 12px; line-height: 1.5; margin: 0;">${notes}</p>
            </div>
          </div>
          ` : ''}

          <!-- Footer -->
          <div style="padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; background: #f9fafb;">
            <p style="margin: 0 0 5px 0; font-size: 12px; color: #6b7280;">Tabela gerada automaticamente pelo sistema DentLab Connect</p>
            <p style="margin: 0; font-size: 12px; color: #9ca3af;">Este documento é válido como orçamento e pode ser usado para consultas e aprovações</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: 'DentLab Connect <onboarding@resend.dev>',
      to: [to],
      subject: `${tableName} - Tabela de Preços`,
      html: emailHtml,
    });

    if (error) {
      console.error('Resend error:', error);
      throw error;
    }

    console.log('Email sent successfully:', data);

    return new Response(
      JSON.stringify({ success: true, messageId: data?.id }),
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
