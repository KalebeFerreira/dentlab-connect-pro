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
      return new Response(JSON.stringify({ error: 'API Key da Nuvem Fiscal não configurada' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claimsData.user.id;

    const body = await req.json();
    const { cliente_nome, cliente_documento, descricao_servico, valor, order_id, service_id } = body;

    if (!cliente_nome || !cliente_documento || !descricao_servico || !valor) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: cliente_nome, cliente_documento, descricao_servico, valor' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Buscar dados fiscais do usuário
    const { data: fiscalSettings, error: fiscalError } = await supabase
      .from('fiscal_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (fiscalError || !fiscalSettings) {
      return new Response(JSON.stringify({ error: 'Configure seus dados fiscais antes de emitir notas' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    // Verificar limite de uso via admin client
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    
    // Buscar plano do usuário
    const { data: subData } = await supabaseAdmin
      .from('user_subscriptions')
      .select('plan_name, status, current_period_end')
      .eq('user_id', userId)
      .maybeSingle();

    const isActive = subData && (subData.status === 'active' || subData.status === 'trialing' || (subData.status === 'canceled' && new Date(subData.current_period_end) > new Date()));
    const planKey = isActive ? (subData.plan_name || 'free').toLowerCase().replace(/\s+/g, '_') : 'free';
    
    const limits: Record<string, number> = { free: 5, basic: 5, professional: 15, premium: 30, super_premium: 999999 };
    const planLimit = limits[planKey] ?? 5;

    const { data: currentUsage } = await supabaseAdmin.rpc('get_monthly_invoice_usage', { p_user_id: userId });
    if ((currentUsage || 0) >= planLimit) {
      return new Response(JSON.stringify({ error: `Limite de ${planLimit} notas fiscais/mês atingido. Faça upgrade do plano.` }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Criar registro da nota como "processando"
    const { data: invoice, error: insertError } = await supabase
      .from('invoices')
      .insert({
        user_id: userId,
        order_id: order_id || null,
        service_id: service_id || null,
        cliente_nome,
        cliente_documento,
        descricao_servico,
        valor: parseFloat(valor),
        status: 'processando',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao criar invoice:', insertError);
      return new Response(JSON.stringify({ error: 'Erro ao registrar nota fiscal' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Montar payload para Nuvem Fiscal
    const nfsePayload = {
      ambiente: "producao",
      prestador: {
        cpfCnpj: fiscalSettings.cnpj.replace(/\D/g, ''),
        inscricaoMunicipal: fiscalSettings.inscricao_municipal || '',
        nomeRazaoSocial: fiscalSettings.razao_social,
        endereco: {
          logradouro: fiscalSettings.endereco_logradouro || '',
          numero: fiscalSettings.endereco_numero || '',
          bairro: fiscalSettings.endereco_bairro || '',
          codigoMunicipio: fiscalSettings.endereco_codigo_municipio || '',
          uf: fiscalSettings.endereco_uf || '',
          cep: (fiscalSettings.endereco_cep || '').replace(/\D/g, ''),
        }
      },
      tomador: {
        cpfCnpj: cliente_documento.replace(/\D/g, ''),
        nomeRazaoSocial: cliente_nome,
      },
      servico: {
        discriminacao: descricao_servico,
        valorServicos: parseFloat(valor),
        issRetido: false,
        itemListaServico: "1401", // Lubrificação, limpeza, lustração, revisão, carga e recarga, conserto, restauração, blindagem, manutenção e conservação de máquinas, veículos, aparelhos, equipamentos, motores, elevadores ou de qualquer objeto (exceto peças e partes empregadas, que ficam sujeitas ao ICMS)
        codigoTributacaoMunicipio: "",
        aliquota: 0,
      }
    };

    // Enviar para API Nuvem Fiscal
    try {
      const nuvemResponse = await fetch('https://api.nuvemfiscal.com.br/nfse', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nuvemFiscalApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nfsePayload),
      });

      const nuvemData = await nuvemResponse.json();

      if (!nuvemResponse.ok) {
        console.error('Erro Nuvem Fiscal:', JSON.stringify(nuvemData));
        
        await supabase
          .from('invoices')
          .update({
            status: 'erro',
            error_message: nuvemData?.message || nuvemData?.error || 'Erro na API da Nuvem Fiscal',
          })
          .eq('id', invoice.id);

        return new Response(JSON.stringify({
          error: 'Erro ao emitir nota na Nuvem Fiscal',
          details: nuvemData?.message || 'Verifique seus dados fiscais',
          invoice_id: invoice.id,
        }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Sucesso - atualizar invoice e incrementar uso
      await supabase
        .from('invoices')
        .update({
          status: 'emitida',
          numero_nota: nuvemData?.numero || nuvemData?.id || '',
          nuvem_fiscal_id: nuvemData?.id || '',
          pdf_url: nuvemData?.linkPdf || '',
          xml_url: nuvemData?.linkXml || '',
        })
        .eq('id', invoice.id);

      // Incrementar contagem de uso
      await supabaseAdmin.rpc('increment_invoice_usage', { p_user_id: userId });

      return new Response(JSON.stringify({
        success: true,
        invoice_id: invoice.id,
        numero_nota: nuvemData?.numero || '',
        status: 'emitida',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (apiError) {
      console.error('Erro de conexão com Nuvem Fiscal:', apiError);
      
      await supabase
        .from('invoices')
        .update({
          status: 'erro',
          error_message: 'Erro de conexão com a Nuvem Fiscal. Tente novamente.',
        })
        .eq('id', invoice.id);

      return new Response(JSON.stringify({
        error: 'Erro de conexão com a Nuvem Fiscal',
        invoice_id: invoice.id,
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  } catch (error) {
    console.error('Erro geral:', error);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
