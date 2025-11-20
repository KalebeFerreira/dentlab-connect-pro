import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendDocumentEmailRequest {
  to: string;
  labName: string;
  fileName: string;
  fileUrl: string;
  category: string;
  fileSize: string;
  fileType: string;
  message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      to,
      labName,
      fileName,
      fileUrl,
      category,
      fileSize,
      fileType,
      message,
    }: SendDocumentEmailRequest = await req.json();

    console.log(`Sending document email to: ${to}`);
    console.log(`File: ${fileName} (${fileSize})`);

    const customMessage = message
      ? `<p style="color: #666; line-height: 1.6; margin-bottom: 20px;">${message}</p>`
      : "";

    const emailPayload = {
      from: `${labName} <onboarding@resend.dev>`,
      to: [to],
      subject: `📄 Documento: ${fileName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                      <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">🦷 ${labName}</h1>
                        <p style="margin: 10px 0 0 0; color: #ffffff; opacity: 0.9; font-size: 14px;">Compartilhamento de Documento</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 40px 30px;">
                        <h2 style="margin: 0 0 20px 0; color: #333; font-size: 20px; font-weight: 600;">Novo documento compartilhado</h2>
                        ${customMessage}
                        <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; border-radius: 4px; margin: 25px 0;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding: 8px 0;">
                                <strong style="color: #667eea; font-size: 14px;">📄 Arquivo:</strong>
                                <p style="margin: 5px 0 0 0; color: #333; font-size: 16px; font-weight: 500;">${fileName}</p>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0;">
                                <strong style="color: #667eea; font-size: 14px;">📁 Categoria:</strong>
                                <p style="margin: 5px 0 0 0; color: #666;">${category}</p>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0;">
                                <strong style="color: #667eea; font-size: 14px;">📊 Tamanho:</strong>
                                <p style="margin: 5px 0 0 0; color: #666;">${fileSize}</p>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0;">
                                <strong style="color: #667eea; font-size: 14px;">📋 Tipo:</strong>
                                <p style="margin: 5px 0 0 0; color: #666;">${fileType || "N/A"}</p>
                              </td>
                            </tr>
                          </table>
                        </div>
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                          <tr>
                            <td align="center">
                              <a href="${fileUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">⬇️ Baixar Arquivo</a>
                            </td>
                          </tr>
                        </table>
                        <p style="color: #999; font-size: 13px; line-height: 1.6; margin: 25px 0 0 0; padding-top: 20px; border-top: 1px solid #eee;">💡 <strong>Dica:</strong> Clique no botão acima para visualizar ou baixar o arquivo. O link estará disponível permanentemente.</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="background-color: #f8f9fa; padding: 20px 30px; border-radius: 0 0 8px 8px; text-align: center;">
                        <p style="margin: 0; color: #999; font-size: 12px; line-height: 1.5;">Esta mensagem foi enviada por <strong>${labName}</strong><br>Sistema de Gerenciamento de Documentos</p>
                      </td>
                    </tr>
                  </table>
                  <table width="600" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding: 20px; text-align: center;">
                        <p style="margin: 0; color: #999; font-size: 11px;">Se você recebeu este email por engano, pode ignorá-lo com segurança.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    };

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(resendData.message || "Failed to send email");
    }

    console.log("Email sent successfully:", resendData);

    return new Response(JSON.stringify(resendData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-document-email function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
