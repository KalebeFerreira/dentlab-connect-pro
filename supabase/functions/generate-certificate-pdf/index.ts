import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CertificateRequest {
  patientName: string;
  patientCpf?: string;
  dentistName: string;
  dentistCro: string;
  startDate: string;
  endDate: string;
  days: string;
  reason: string;
  observations?: string;
  customText?: string;
  signatureUrl?: string;
  issueDate: string;
  logoUrl?: string;
}

const generateCertificateHTML = (data: CertificateRequest): string => {
  // Replace variables in custom text
  let contentText = data.customText || `
    Atesto para os devidos fins que o(a) paciente <strong>${data.patientName}</strong>${data.patientCpf ? `, CPF ${data.patientCpf},` : ""} 
    esteve sob meus cuidados profissionais no dia ${data.issueDate}, necessitando de afastamento de suas atividades 
    por motivo de <strong>${data.reason}</strong>.
    <br><br>
    Período de afastamento: de <strong>${new Date(data.startDate).toLocaleDateString('pt-BR')}</strong> 
    até <strong>${new Date(data.endDate).toLocaleDateString('pt-BR')}</strong>, 
    totalizando <strong>${data.days} dia(s)</strong>.
  `;

  // Replace variables
  contentText = contentText
    .replace(/{patientName}/g, data.patientName)
    .replace(/{days}/g, data.days)
    .replace(/{startDate}/g, new Date(data.startDate).toLocaleDateString('pt-BR'))
    .replace(/{endDate}/g, new Date(data.endDate).toLocaleDateString('pt-BR'));

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 40px;
          line-height: 1.6;
          color: #000;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        .title {
          font-size: 24px;
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 10px;
          color: #000;
        }
        .content {
          text-align: justify;
          margin: 30px 0;
          font-size: 14px;
          color: #000;
        }
        .signature {
          margin-top: 80px;
          text-align: center;
        }
        .signature-line {
          border-top: 1px solid #000;
          width: 300px;
          margin: 0 auto;
          padding-top: 10px;
          color: #000;
        }
        .footer {
          margin-top: 60px;
          text-align: right;
          font-size: 12px;
          color: #000;
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${data.logoUrl ? `
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${data.logoUrl}" alt="Logo" style="max-width: 150px; max-height: 80px;" />
          </div>
        ` : ''}
        <div class="title">Atestado Odontológico</div>
      </div>
      
      <div class="content">
        <p>${contentText}</p>
        ${data.observations ? `<p style="margin-top: 20px;"><strong>Observações:</strong> ${data.observations}</p>` : ''}
      </div>
      
      <div class="footer">
        <p>${data.issueDate}</p>
      </div>
      
      <div style="margin-top: 100px; page-break-inside: avoid;">
        <div class="signature">
          ${data.signatureUrl ? `
            <div style="text-align: center; margin-bottom: 10px;">
              <img src="${data.signatureUrl}" alt="Assinatura" style="max-width: 200px; max-height: 80px; border: 1px solid #ccc; padding: 5px; background: white;" />
            </div>
          ` : ''}
          <div class="signature-line">
            <strong>${data.dentistName}</strong><br>
            CRO: ${data.dentistCro}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const certificateData: CertificateRequest = await req.json();
    console.log("Generating certificate for:", certificateData.patientName);

    const html = generateCertificateHTML(certificateData);

    console.log("Certificate HTML generated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        html: html,
        message: "Atestado gerado com sucesso",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error generating certificate:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});