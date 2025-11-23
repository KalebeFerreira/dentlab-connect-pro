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
  issueDate: string;
}

const generateCertificateHTML = (data: CertificateRequest): string => {
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
        }
        .content {
          text-align: justify;
          margin: 30px 0;
          font-size: 14px;
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
        }
        .footer {
          margin-top: 60px;
          text-align: right;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">Atestado Odontológico</div>
      </div>
      
      <div class="content">
        <p>
          Atesto para os devidos fins que o(a) paciente <strong>${data.patientName}</strong>${data.patientCpf ? `, CPF ${data.patientCpf},` : ""} 
          esteve sob meus cuidados profissionais no dia ${data.issueDate}, necessitando de afastamento de suas atividades 
          por motivo de <strong>${data.reason}</strong>.
        </p>
        
        <p>
          Período de afastamento: de <strong>${new Date(data.startDate).toLocaleDateString('pt-BR')}</strong> 
          até <strong>${new Date(data.endDate).toLocaleDateString('pt-BR')}</strong>, 
          totalizando <strong>${data.days} dia(s)</strong>.
        </p>
        
        ${data.observations ? `<p>Observações: ${data.observations}</p>` : ''}
      </div>
      
      <div class="footer">
        <p>${data.issueDate}</p>
      </div>
      
      <div class="signature">
        <div class="signature-line">
          <strong>${data.dentistName}</strong><br>
          CRO: ${data.dentistCro}
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

    // Convert HTML to PDF using html2pdf API (you can use any HTML to PDF service)
    // For now, we'll create a simple HTML response that can be printed as PDF
    // In production, you might want to use a service like PDFShift or similar

    const blob = new Blob([html], { type: "text/html" });
    const fileName = `atestado-${certificateData.patientName.replace(/\s+/g, "-")}-${Date.now()}.html`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("laboratory-files")
      .upload(`certificates/${fileName}`, blob, {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("laboratory-files")
      .getPublicUrl(`certificates/${fileName}`);

    console.log("Certificate generated successfully:", urlData.publicUrl);

    return new Response(
      JSON.stringify({
        success: true,
        pdfUrl: urlData.publicUrl,
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