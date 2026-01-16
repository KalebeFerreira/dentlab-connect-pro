import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
      throw new Error('Não autorizado');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // Verificar se usuário tem plano premium ou super_premium
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    const premiumPriceIds = [
      'price_1SYVOjF2249riykhJmw4RoVM', // premium monthly
      'price_1SYVOjF2249riykhi2o98hEf', // premium annual
      'price_super_premium_monthly',     // super premium monthly
      'price_super_premium_annual',      // super premium annual
    ];

    if (!subscription || !premiumPriceIds.includes(subscription.stripe_price_id || '')) {
      return new Response(
        JSON.stringify({ error: 'Este recurso é exclusivo para assinantes Premium e Super Premium' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { message, context, conversationHistory } = await req.json();

    if (!message) {
      throw new Error('Mensagem não fornecida');
    }

    console.log(`Processando mensagem do usuário ${user.id}: ${message.substring(0, 50)}...`);

    // Buscar dados do usuário para contexto
    const [ordersResult, patientsResult, appointmentsResult, financialResult] = await Promise.all([
      supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('patients').select('*').eq('user_id', user.id).limit(50),
      supabase.from('appointments').select('*').eq('user_id', user.id).order('appointment_date', { ascending: false }).limit(10),
      supabase.from('financial_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    ]);

    const orders = ordersResult.data || [];
    const patients = patientsResult.data || [];
    const appointments = appointmentsResult.data || [];
    const financial = financialResult.data || [];

    // Calcular estatísticas
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'in_progress').length;
    const totalPatients = patients.length;
    const upcomingAppointments = appointments.filter(a => new Date(a.appointment_date) > new Date()).length;
    const totalRevenue = financial.filter(f => f.transaction_type === 'receipt').reduce((acc, f) => acc + (f.amount || 0), 0);
    const totalExpenses = financial.filter(f => f.transaction_type === 'payment').reduce((acc, f) => acc + (f.amount || 0), 0);

    const systemPrompt = `Você é o Assistente IA Premium do DentLab Connect, um sistema de gestão para laboratórios de prótese dentária e clínicas odontológicas.

## Suas Capacidades:
1. **Suporte ao Sistema**: Ajudar usuários a navegar e usar todas as funcionalidades do DentLab Connect
2. **Assistente Odontológico**: Responder dúvidas técnicas sobre procedimentos, materiais e próteses dentárias
3. **Análise de Dados**: Analisar pedidos, finanças e gerar insights para o negócio

## Dados do Usuário (Atualizados):
- Total de Pedidos: ${totalOrders} (${pendingOrders} pendentes)
- Total de Pacientes: ${totalPatients}
- Agendamentos Próximos: ${upcomingAppointments}
- Receita Total (últimas transações): R$ ${totalRevenue.toFixed(2)}
- Despesas Totais: R$ ${totalExpenses.toFixed(2)}
- Lucro Aproximado: R$ ${(totalRevenue - totalExpenses).toFixed(2)}

## Últimos Pedidos:
${orders.slice(0, 5).map(o => `- ${o.work_type} para ${o.patient_name} (${o.clinic_name}) - Status: ${o.status}`).join('\n') || 'Nenhum pedido recente'}

## Regras:
- Responda sempre em português brasileiro
- Seja conciso mas completo
- Use emojis para tornar a conversa mais amigável
- Quando não souber algo específico do sistema, sugira consultar a documentação ou suporte
- Para análises financeiras, sempre mencione que são baseadas nos dados disponíveis
- Ofereça sugestões proativas de melhorias baseadas nos dados

## Funcionalidades do Sistema que você pode explicar:
- Dashboard: Visão geral do laboratório
- Pedidos: Cadastro e acompanhamento de trabalhos protéticos
- Financeiro: Controle de receitas e despesas
- Faturamento: Geração de relatórios e notas
- Pacientes: Cadastro e gestão de pacientes
- Agendamentos: Agenda de procedimentos
- Gerador de Imagens IA: Criação de imagens odontológicas
- Tabela de Preços: Gestão de valores dos serviços
- Marketing: Campanhas e materiais promocionais`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('Configuração de IA não encontrada');
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Aguarde alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA esgotados.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Erro na API de IA: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';

    console.log('Resposta gerada com sucesso');

    return new Response(
      JSON.stringify({ 
        response: assistantMessage,
        stats: {
          orders: totalOrders,
          pendingOrders,
          patients: totalPatients,
          upcomingAppointments,
          revenue: totalRevenue,
          expenses: totalExpenses,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Erro no ai-assistant:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
