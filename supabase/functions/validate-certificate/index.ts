import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const nuvemFiscalApiKey = Deno.env.get('NUVEM_FISCAL_API_KEY');

    if (!nuvemFiscalApiKey) {
      return new Response(JSON.stringify({ error: 'API Key da Nuvem Fiscal não configurada', valid: false }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida', valid: false }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = userData.user.id;

    // Buscar dados fiscais com certificado
    const { data: fiscalSettings, error: fiscalError } = await supabase
      .from('fiscal_settings')
      .select('cnpj, certificado_base64, certificado_senha_encrypted')
      .eq('user_id', userId)
      .maybeSingle();

    if (fiscalError || !fiscalSettings) {
      return new Response(JSON.stringify({ error: 'Dados fiscais não encontrados', valid: false }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!fiscalSettings.certificado_base64) {
      return new Response(JSON.stringify({ error: 'Certificado digital não enviado', valid: false }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!fiscalSettings.certificado_senha_encrypted) {
      return new Response(JSON.stringify({ error: 'Senha do certificado não configurada. Salve a senha nos Dados Fiscais.', valid: false, needs_password: true }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cnpj = (fiscalSettings.cnpj || '').replace(/\D/g, '');
    if (!cnpj) {
      return new Response(JSON.stringify({ error: 'CNPJ não configurado', valid: false }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Decodificar senha
    let certPassword: string;
    try {
      certPassword = atob(fiscalSettings.certificado_senha_encrypted);
    } catch {
      certPassword = fiscalSettings.certificado_senha_encrypted;
    }

    // Enviar certificado para validação na Nuvem Fiscal
    // A API da Nuvem Fiscal aceita upload de certificado via endpoint /empresas/{cnpj}/certificado
    try {
      // Primeiro, verificar/criar empresa na Nuvem Fiscal
      const checkEmpresaResponse = await fetch(`https://api.nuvemfiscal.com.br/empresas/${cnpj}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${nuvemFiscalApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // Se a empresa não existir, tentar criar
      if (checkEmpresaResponse.status === 404) {
        console.log(`[VALIDATE-CERT] Empresa ${cnpj} não encontrada, criando...`);
        const createResponse = await fetch('https://api.nuvemfiscal.com.br/empresas', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${nuvemFiscalApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cpf_cnpj: cnpj,
          }),
        });
        
        if (!createResponse.ok) {
          const createErr = await createResponse.json().catch(() => ({}));
          console.error('[VALIDATE-CERT] Erro ao criar empresa:', JSON.stringify(createErr));
          return new Response(JSON.stringify({ 
            error: 'Erro ao cadastrar empresa na Nuvem Fiscal. Verifique o CNPJ.', 
            valid: false,
            details: createErr?.message || createErr?.error || ''
          }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Enviar certificado para a Nuvem Fiscal
      const certBytes = Uint8Array.from(atob(fiscalSettings.certificado_base64), c => c.charCodeAt(0));
      const blob = new Blob([certBytes], { type: 'application/x-pkcs12' });
      
      const formData = new FormData();
      formData.append('arquivo', blob, 'certificado.pfx');
      formData.append('senha', certPassword);

      console.log(`[VALIDATE-CERT] Enviando certificado para CNPJ ${cnpj}`);

      const certResponse = await fetch(`https://api.nuvemfiscal.com.br/empresas/${cnpj}/certificado`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${nuvemFiscalApiKey}`,
        },
        body: formData,
      });

      const certData = await certResponse.json().catch(() => ({}));

      if (!certResponse.ok) {
        console.error('[VALIDATE-CERT] Erro ao validar certificado:', JSON.stringify(certData));
        
        let errorMsg = 'Certificado inválido ou senha incorreta.';
        if (certData?.message) errorMsg = certData.message;
        if (certData?.error) errorMsg = certData.error;

        return new Response(JSON.stringify({ 
          error: errorMsg, 
          valid: false,
          details: certData
        }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      console.log('[VALIDATE-CERT] Certificado validado com sucesso:', JSON.stringify(certData));

      // Extrair info do certificado se disponível
      const certInfo = {
        valid: true,
        message: 'Certificado digital validado com sucesso! Você já pode emitir notas fiscais.',
        expiresAt: certData?.validade || certData?.not_after || certData?.expires_at || null,
        subject: certData?.nome || certData?.subject || certData?.razao_social || null,
      };

      return new Response(JSON.stringify(certInfo), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (apiError) {
      console.error('[VALIDATE-CERT] Erro de conexão:', apiError);
      return new Response(JSON.stringify({ 
        error: 'Erro de conexão com a Nuvem Fiscal. Tente novamente.', 
        valid: false 
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  } catch (error) {
    console.error('[VALIDATE-CERT] Erro geral:', error);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor', valid: false }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
