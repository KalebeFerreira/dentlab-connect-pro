import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT_BASE = `Você é um assistente virtual de atendimento de uma clínica/laboratório odontológico.

## Regras:
- Responda SEMPRE em português brasileiro
- Seja educado, simpático e profissional
- Respostas curtas e objetivas (máximo 3-4 frases)
- Use emojis com moderação (1-2 por mensagem)
- Se o paciente pedir para falar com humano, diga que vai transferir
- NÃO invente informações sobre horários, preços ou procedimentos que não foram configurados
- Para agendamentos, colete: nome, telefone, procedimento desejado e horário preferido
- Se não souber responder algo específico, diga que vai verificar com a equipe

## Detecção de transferência humana:
Se o paciente usar frases como "falar com atendente", "pessoa real", "humano", "atendimento humano", 
"falar com alguém", "quero um atendente", responda cordialmente e sinalize a transferência.`;

const TRIAL_DAYS = 15;

function isTrialExpired(trialStartedAt: string | null): boolean {
  if (!trialStartedAt) return false;
  const start = new Date(trialStartedAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > TRIAL_DAYS;
}

async function sendWhatsAppReply(
  evolutionApiUrl: string,
  instanceName: string,
  phoneNumber: string,
  message: string,
): Promise<boolean> {
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
  if (!EVOLUTION_API_KEY || !evolutionApiUrl) return false;

  try {
    const resp = await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'apikey': EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: phoneNumber,
        text: message,
      }),
    });
    return resp.ok;
  } catch (err) {
    console.error('Erro ao enviar mensagem WhatsApp:', err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test connection action
    if (action === 'test_connection') {
      const { evolution_api_url, instance_name } = body;
      const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

      if (!EVOLUTION_API_KEY) {
        return new Response(
          JSON.stringify({ connected: false, message: 'Chave da Evolution API não configurada' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const resp = await fetch(`${evolution_api_url}/instance/connectionState/${instance_name}`, {
          headers: { 'apikey': EVOLUTION_API_KEY },
        });
        const data = await resp.json();
        const connected = data?.instance?.state === 'open';

        return new Response(
          JSON.stringify({ connected, message: connected ? 'Conectado' : 'Instância não conectada' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch {
        return new Response(
          JSON.stringify({ connected: false, message: 'Não foi possível conectar à Evolution API' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get conversations for inbox
    if (action === 'get_conversations') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: conversations, error } = await supabase
        .from('whatsapp_conversations')
        .select('*, whatsapp_messages(content, direction, is_from_ai, created_at)')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return new Response(
        JSON.stringify({ conversations: conversations || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get messages for a conversation
    if (action === 'get_messages') {
      const { conversation_id } = body;
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      return new Response(
        JSON.stringify({ messages: messages || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send manual message (human takeover)
    if (action === 'send_manual_message') {
      const { conversation_id, message, phone_number } = body;
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Token inválido' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Get agent settings for Evolution API info
      const { data: agentSettings } = await supabase
        .from('ai_agent_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // Send via WhatsApp
      let sent = false;
      if (agentSettings?.evolution_api_url && agentSettings?.evolution_instance_name) {
        sent = await sendWhatsAppReply(
          agentSettings.evolution_api_url,
          agentSettings.evolution_instance_name,
          phone_number,
          message
        );
      }

      // Store message
      await supabase.from('whatsapp_messages').insert({
        conversation_id,
        user_id: user.id,
        content: message,
        direction: 'outbound',
        message_type: 'text',
        is_from_ai: false,
      });

      // Update conversation
      await supabase
        .from('whatsapp_conversations')
        .update({ last_message_at: new Date().toISOString(), requires_human: false })
        .eq('id', conversation_id);

      return new Response(
        JSON.stringify({ success: true, whatsapp_sent: sent }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process message action (called from n8n)
    if (action === 'process_message') {
      const { phone_number, message, patient_name, user_id } = body;

      if (!phone_number || !message) {
        return new Response(
          JSON.stringify({ error: 'phone_number e message são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find agent settings for the user
      let agentSettings: any;
      if (user_id) {
        const { data } = await supabase
          .from('ai_agent_settings')
          .select('*')
          .eq('user_id', user_id)
          .maybeSingle();
        agentSettings = data;
      } else {
        const { data: conv } = await supabase
          .from('whatsapp_conversations')
          .select('user_id')
          .eq('phone_number', phone_number)
          .maybeSingle();

        if (conv?.user_id) {
          const { data } = await supabase
            .from('ai_agent_settings')
            .select('*')
            .eq('user_id', conv.user_id)
            .maybeSingle();
          agentSettings = data;
        }
      }

      if (!agentSettings) {
        return new Response(
          JSON.stringify({ error: 'Configurações do agente não encontradas.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check trial expiration
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('status, plan_name, current_period_end')
        .eq('user_id', agentSettings.user_id)
        .maybeSingle();

      const isPremium = subscription && (
        subscription.status === 'active' ||
        subscription.status === 'trialing' ||
        (subscription.status === 'canceled' && subscription.current_period_end && new Date(subscription.current_period_end) > new Date())
      );

      if (!isPremium && isTrialExpired(agentSettings.trial_started_at)) {
        return new Response(
          JSON.stringify({ error: 'Período de teste expirado. Assine o plano Premium para continuar.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check working hours
      const now = new Date();
      const brTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const currentHour = brTime.getHours();
      const currentMinute = brTime.getMinutes();
      const dayOfWeek = brTime.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const [startH, startM] = (agentSettings.working_hours_start || '08:00').split(':').map(Number);
      const [endH, endM] = (agentSettings.working_hours_end || '18:00').split(':').map(Number);

      const currentTime = currentHour * 60 + currentMinute;
      const startTime = startH * 60 + startM;
      const endTime = endH * 60 + endM;

      const isOutsideHours = currentTime < startTime || currentTime > endTime;
      const isClosedDay = isWeekend && !agentSettings.work_on_weekends;

      if ((isOutsideHours || isClosedDay) && agentSettings.auto_reply_outside_hours) {
        const outsideMsg = agentSettings.outside_hours_message || 'Estamos fora do horário de atendimento.';
        
        // Send outside hours reply via WhatsApp
        if (agentSettings.evolution_api_url && agentSettings.evolution_instance_name) {
          await sendWhatsAppReply(
            agentSettings.evolution_api_url,
            agentSettings.evolution_instance_name,
            phone_number,
            outsideMsg
          );
        }

        return new Response(
          JSON.stringify({
            response: outsideMsg,
            agent_name: agentSettings.agent_name,
            requires_human: false,
            outside_hours: true,
            whatsapp_sent: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Store conversation
      const ownerUserId = agentSettings.user_id;
      const { data: conversation } = await supabase
        .from('whatsapp_conversations')
        .upsert({
          user_id: ownerUserId,
          phone_number,
          patient_name: patient_name || null,
          last_message_at: new Date().toISOString(),
          is_active: true,
        }, { onConflict: 'user_id,phone_number' })
        .select()
        .single();

      if (conversation) {
        await supabase.from('whatsapp_messages').insert({
          conversation_id: conversation.id,
          user_id: ownerUserId,
          content: message,
          direction: 'inbound',
          message_type: 'text',
        });
      }

      // Get conversation history for context
      let conversationHistory: { role: string; content: string }[] = [];
      if (conversation) {
        const { data: history } = await supabase
          .from('whatsapp_messages')
          .select('content, direction, is_from_ai')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (history) {
          conversationHistory = history.reverse().map(msg => ({
            role: msg.direction === 'inbound' ? 'user' : 'assistant',
            content: msg.content,
          }));
        }
      }

      // Build system prompt
      const agentName = agentSettings.agent_name || 'Assistente';
      const personality = agentSettings.agent_personality || '';
      const systemPrompt = `${SYSTEM_PROMPT_BASE}\n\nSeu nome é: ${agentName}\n${personality ? `\nInstruções adicionais: ${personality}` : ''}`;

      // Call AI
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        throw new Error('LOVABLE_API_KEY não configurada');
      }

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: message },
          ],
          temperature: 0.5,
          max_tokens: 500,
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Muitas requisições. Aguarde alguns segundos.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (aiResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: 'Serviço temporariamente indisponível.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`AI error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const reply = aiData.choices?.[0]?.message?.content || 'Desculpe, não entendi. Pode repetir?';

      // Detect if human transfer is needed
      const humanKeywords = ['falar com atendente', 'pessoa real', 'humano', 'atendimento humano', 'falar com alguém', 'quero um atendente'];
      const requiresHuman = humanKeywords.some(kw => message.toLowerCase().includes(kw));

      // Store AI response
      if (conversation) {
        await supabase.from('whatsapp_messages').insert({
          conversation_id: conversation.id,
          user_id: ownerUserId,
          content: reply,
          direction: 'outbound',
          message_type: 'text',
          is_from_ai: true,
        });

        // Update conversation with requires_human flag
        if (requiresHuman) {
          await supabase
            .from('whatsapp_conversations')
            .update({ requires_human: true })
            .eq('id', conversation.id);
        }
      }

      // Send reply via WhatsApp
      let whatsappSent = false;
      if (agentSettings.evolution_api_url && agentSettings.evolution_instance_name) {
        whatsappSent = await sendWhatsAppReply(
          agentSettings.evolution_api_url,
          agentSettings.evolution_instance_name,
          phone_number,
          reply
        );
      }

      return new Response(
        JSON.stringify({
          response: reply,
          agent_name: agentName,
          requires_human: requiresHuman,
          conversation_id: conversation?.id,
          whatsapp_sent: whatsappSent,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação não reconhecida. Use: test_connection, process_message, get_conversations, get_messages, send_manual_message' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Erro no n8n-whatsapp-webhook:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
