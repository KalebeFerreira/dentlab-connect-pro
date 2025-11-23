import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { orderId } = await req.json();
    
    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get order data
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify ownership
    if (order.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get order files
    const { data: files } = await supabase
      .from('order_files')
      .select('*')
      .eq('order_id', orderId);

    // Get signature URL if exists
    let signatureDataUrl = null;
    if (order.signature_url) {
      const { data: signatureData } = await supabase.storage
        .from('order-files')
        .download(order.signature_url);
      
      if (signatureData) {
        const buffer = await signatureData.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        signatureDataUrl = `data:image/png;base64,${base64}`;
      }
    }

    // Get signature position preference from company_info
    let signaturePosition = 'bottom';
    const { data: companyInfo } = await supabase
      .from('company_info')
      .select('signature_position')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (companyInfo?.signature_position) {
      signaturePosition = companyInfo.signature_position;
    }

    // Signature block to be reused
    const signatureBlock = signatureDataUrl ? `
      <div style="margin-top: ${signaturePosition === 'top' ? '20px' : signaturePosition === 'middle' ? '40px' : '60px'}; page-break-inside: avoid;">
        <div class="section">
          <h2 class="section-title">Assinatura Digital</h2>
          <div class="signature-container">
            <img src="${signatureDataUrl}" alt="Assinatura" class="signature-image" />
            <p style="margin-top: 10px; font-size: 13px; color: #000;">
              Assinado por: ${order.dentist_name}
            </p>
          </div>
        </div>
      </div>
    ` : '';

    // Generate HTML for PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Arial, sans-serif; 
      padding: 40px;
      color: #000;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 3px solid #0066cc;
      padding-bottom: 20px;
    }
    .header h1 {
      color: #0066cc;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .order-number {
      font-size: 16px;
      color: #000;
    }
    .section {
      margin-bottom: 25px;
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
    }
    .section-title {
      font-size: 18px;
      color: #0066cc;
      margin-bottom: 15px;
      font-weight: bold;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .info-item {
      margin-bottom: 10px;
    }
    .info-label {
      font-weight: bold;
      color: #000;
      font-size: 13px;
      margin-bottom: 3px;
    }
    .info-value {
      font-size: 15px;
      color: #000;
    }
    .status-badge {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: bold;
      background: #fef3c7;
      color: #92400e;
    }
    .files-list {
      list-style: none;
    }
    .files-list li {
      padding: 10px;
      background: white;
      margin-bottom: 8px;
      border-radius: 5px;
      border-left: 3px solid #0066cc;
      color: #000;
    }
    .signature-container {
      margin-top: 20px;
      text-align: center;
    }
    .signature-image {
      max-width: 300px;
      border: 2px solid #ddd;
      border-radius: 5px;
      padding: 10px;
      background: white;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 12px;
      color: #000;
      border-top: 1px solid #ddd;
      padding-top: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <!-- Logo will be added here when laboratory info is fetched -->
    <h1>ORDEM DE TRABALHO</h1>
    <p class="order-number">Nº ${order.os_number || order.id.substring(0, 8).toUpperCase()}</p>
  </div>

  ${signaturePosition === 'top' ? signatureBlock : ''}

  <div class="section">
    <h2 class="section-title">Informações da Clínica</h2>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Nome da Clínica</div>
        <div class="info-value">${order.clinic_name}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Dentista Responsável</div>
        <div class="info-value">${order.dentist_name}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Dados do Paciente</h2>
    <div class="info-item">
      <div class="info-label">Nome do Paciente</div>
      <div class="info-value">${order.patient_name}</div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Detalhes do Trabalho</h2>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Nome do Trabalho</div>
        <div class="info-value">${order.work_name || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Tipo</div>
        <div class="info-value">${order.work_type}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Cor</div>
        <div class="info-value">${order.custom_color || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Dentes</div>
        <div class="info-value">${order.teeth_numbers}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Valor</div>
        <div class="info-value">R$ ${order.amount ? order.amount.toFixed(2) : '0,00'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Status</div>
        <div class="info-value">
          <span class="status-badge">${order.status === 'pending' ? 'Pendente' : order.status === 'in_production' ? 'Em Produção' : 'Concluído'}</span>
        </div>
      </div>
    </div>
  </div>

  ${order.observations ? `
  <div class="section">
    <h2 class="section-title">Observações</h2>
    <div class="info-value">${order.observations}</div>
  </div>
  ` : ''}

  ${signaturePosition === 'middle' ? signatureBlock : ''}

  ${files && files.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Arquivos Anexos (${files.length})</h2>
    <ul class="files-list">
      ${files.map(file => `<li>📎 ${file.file_name} (${(file.file_size / 1024).toFixed(2)} KB)</li>`).join('')}
    </ul>
  </div>
  ` : ''}

  <div class="section">
    <h2 class="section-title">Informações Adicionais</h2>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Data de Criação</div>
        <div class="info-value">${new Date(order.created_at).toLocaleDateString('pt-BR')}</div>
      </div>
      ${order.delivery_date ? `
      <div class="info-item">
        <div class="info-label">Data de Entrega Prevista</div>
        <div class="info-value">${new Date(order.delivery_date).toLocaleDateString('pt-BR')}</div>
      </div>
      ` : ''}
    </div>
  </div>

  <div class="footer">
    <p>DentLab Connect - Sistema de Gestão de Ordens de Trabalho</p>
    <p>Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
  </div>

  ${signaturePosition === 'bottom' ? signatureBlock : ''}
</body>
</html>
    `;

    // For now, return the HTML. In production, you'd use a PDF generation service
    // like Puppeteer or a cloud service
    return new Response(
      JSON.stringify({ 
        html,
        order,
        message: 'PDF HTML generated successfully. Use a PDF service to convert this HTML to PDF.'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error generating PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
