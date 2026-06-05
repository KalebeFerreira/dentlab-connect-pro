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

const HARDCODED_EVOLUTION_URL = "https://dentlab-evolution-api.sfwgy9.easypanel.host";
function normalizeEvolutionApiUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  const markdownUrl = trimmed.match(/\]\((https?:\/\/[^)]+)\)/i)?.[1];
  const plainUrl = markdownUrl || trimmed.match(/https?:\/\/[^\s)\]]+/i)?.[0] || '';
  const cleaned = plainUrl.replace(/\/+$/, '');
  return cleaned && /^https?:\/\/[^\s]+\.[^\s]+$/.test(cleaned) ? cleaned : HARDCODED_EVOLUTION_URL;
}


async function sendWhatsAppReply(
  evolutionApiUrl: string,
  instanceName: string,
  phoneNumber: string,
  message: string,
): Promise<boolean> {
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
  if (!EVOLUTION_API_KEY || !evolutionApiUrl || !instanceName) {
    console.error('[sendWhatsAppReply] missing config', { hasKey: !!EVOLUTION_API_KEY, url: evolutionApiUrl, instance: instanceName });
    return false;
  }

  const baseUrl = normalizeEvolutionApiUrl(evolutionApiUrl);
  const url = `${baseUrl}/message/sendText/${encodeURIComponent(instanceName)}`;
  // Normalize number: digits only, ensure 55 prefix
  let number = (phoneNumber || '').replace(/\D/g, '');
  if (number && !number.startsWith('55')) number = '55' + number;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number, text: message }),
    });
    const text = await resp.text().catch(() => '');
    if (!resp.ok) {
      console.error(`[sendWhatsAppReply] Evolution ${resp.status} url=${url} body=${text.slice(0, 400)}`);
      return false;
    }
    console.log(`[sendWhatsAppReply] ok → ${number}`);
    return true;
  } catch (err) {
    console.error('[sendWhatsAppReply] erro:', err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    let { action } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ============================================================
    // Evolution API native webhook (MESSAGES_UPSERT) → translate to process_message
    // Evolution posts: { event: 'messages.upsert', instance, data: { key, message, pushName } }
    // ============================================================
    const evoEvent = (body.event || '').toString().toLowerCase().replace(/_/g, '.');
    if (!action && (evoEvent === 'messages.upsert' || body.data?.key)) {
      const data = body.data || {};
      const key = data.key || {};
      if (key.fromMe === true) {
        return new Response(JSON.stringify({ ignored: 'fromMe' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const remoteJid: string = key.remoteJid || '';
      if (remoteJid.endsWith('@g.us') || remoteJid.includes('broadcast')) {
        return new Response(JSON.stringify({ ignored: 'group_or_broadcast' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const phoneNumber = remoteJid.split('@')[0];
      const msg = data.message || {};
      const text =
        msg.conversation ||
        msg.extendedTextMessage?.text ||
        msg.imageMessage?.caption ||
        msg.videoMessage?.caption ||
        msg.buttonsResponseMessage?.selectedDisplayText ||
        msg.listResponseMessage?.title ||
        '';
      if (!text || !phoneNumber) {
        return new Response(JSON.stringify({ ignored: 'no_text' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      body.action = 'process_message';
      body.phone_number = phoneNumber;
      body.message = text;
      body.patient_name = data.pushName || null;
      body.instance_name = body.instance || body.instanceName || null;
      action = 'process_message';
      console.log('[evolution-webhook] translated MESSAGES_UPSERT', { instance: body.instance_name, phoneNumber, textLen: text.length });
    }

    // ============================================================
    // Per-user Evolution instance management (multi-tenant)
    // Each user gets a unique instance = `user-{userIdNoHyphens24}` on
    // the SHARED Evolution server (EVOLUTION_API_URL + EVOLUTION_API_KEY).
    // Premium/trial plan is required.
    // ============================================================
    const requireUser = async () => {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return { error: 'Não autenticado', status: 401 as const };
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return { error: 'Token inválido', status: 401 as const };
      return { user };
    };

    const checkPlanAccess = async (userId: string) => {
      const { data: settings } = await supabase
        .from('ai_agent_settings').select('trial_started_at').eq('user_id', userId).maybeSingle();
      const { data: sub } = await supabase
        .from('user_subscriptions').select('status, plan_name, current_period_end')
        .eq('user_id', userId).maybeSingle();
      const isPremium = sub && (
        sub.status === 'active' || sub.status === 'trialing' ||
        (sub.status === 'canceled' && sub.current_period_end && new Date(sub.current_period_end) > new Date())
      ) && (sub.plan_name === 'premium' || sub.plan_name === 'super_premium');
      const trialActive = settings?.trial_started_at && !isTrialExpired(settings.trial_started_at);
      return !!(isPremium || trialActive);
    };

    const userInstanceName = (userId: string) => `user-${userId.replace(/-/g, '').slice(0, 24)}`;
    const sharedEvoUrl = () => normalizeEvolutionApiUrl(Deno.env.get('EVOLUTION_API_URL') || '');
    const sharedEvoKey = () => Deno.env.get('EVOLUTION_API_KEY') || '';
    const webhookCallbackUrl = () => `${Deno.env.get('SUPABASE_URL')}/functions/v1/n8n-whatsapp-webhook`;

    // ----- create_instance: ensures Evolution instance exists, returns QR -----
    if (action === 'create_instance') {
      const auth = await requireUser();
      if ('error' in auth) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const user = auth.user;
      if (!(await checkPlanAccess(user.id))) {
        return new Response(JSON.stringify({ error: 'Plano Premium necessário', upgrade_required: true }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const baseUrl = sharedEvoUrl();
      const apiKey = sharedEvoKey();
      if (!baseUrl || !apiKey) {
        return new Response(JSON.stringify({ error: 'Servidor WhatsApp não configurado' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const instanceName = userInstanceName(user.id);
      const extractBase64 = (d: any): string | null => {
        const raw = d?.qrcode?.base64 || d?.base64 || d?.qrcode || d?.qr || null;
        if (!raw || typeof raw !== 'string') return null;
        let s = raw.trim();
        if (s.startsWith('data:') && s.includes(',')) s = s.split(',')[1];
        s = s.replace(/\s/g, '');
        if (s.length < 100) return null;
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return null;
        return s;
      };
      const fetchQr = async (): Promise<{ base64: string | null; pairing: string | null }> => {
        try {
          const r = await fetch(`${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`, { headers: { apikey: apiKey } });
          const d = await r.json().catch(() => ({}));
          return { base64: extractBase64(d), pairing: d?.pairingCode || d?.qrcode?.pairingCode || null };
        } catch {
          return { base64: null, pairing: null };
        }
      };
      try {
        const createResp = await fetch(`${baseUrl}/instance/create`, {
          method: 'POST',
          headers: { apikey: apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
        });
        const createText = await createResp.text();
        let createData: any = null;
        try { createData = JSON.parse(createText); } catch { /* ignore */ }
        if (!createResp.ok && createResp.status !== 403 && createResp.status !== 409) {
          console.error(`[create_instance] ${createResp.status}: ${createText.slice(0, 300)}`);
        }
        // Wire webhook so messages route back automatically
        await fetch(`${baseUrl}/webhook/set/${encodeURIComponent(instanceName)}`, {
          method: 'POST',
          headers: { apikey: apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhook: { url: webhookCallbackUrl(), enabled: true, events: ['MESSAGES_UPSERT'] } }),
        }).catch(() => {});

        await supabase.from('ai_agent_settings').upsert({
          user_id: user.id,
          agent_name: 'Assistente Virtual',
          evolution_instance_name: instanceName,
          is_whatsapp_enabled: true,
        }, { onConflict: 'user_id' });

        // Try QR from create response, then poll /instance/connect a few times
        let base64 = extractBase64(createData);
        let pairing = createData?.qrcode?.pairingCode || null;
        for (let i = 0; i < 4 && !base64; i++) {
          await new Promise((r) => setTimeout(r, 700));
          const q = await fetchQr();
          base64 = q.base64;
          pairing = pairing || q.pairing;
        }
        console.log(`[create_instance] qr=${base64 ? 'yes(' + base64.length + ')' : 'no'} pairing=${pairing ? 'yes' : 'no'}`);
        return new Response(JSON.stringify({
          ok: true,
          instance_name: instanceName,
          qrcode: base64,
          pairing_code: pairing,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        console.error('[create_instance] error', e);
        return new Response(JSON.stringify({ error: 'Falha ao criar instância WhatsApp' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ----- get_connection_status -----
    if (action === 'get_connection_status') {
      const auth = await requireUser();
      if ('error' in auth) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const user = auth.user;
      const baseUrl = sharedEvoUrl();
      const apiKey = sharedEvoKey();
      const instanceName = userInstanceName(user.id);
      if (!baseUrl || !apiKey) {
        return new Response(JSON.stringify({ connected: false, state: 'not_configured', instance_name: instanceName }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const extractBase64 = (d: any): string | null => {
        const raw = d?.qrcode?.base64 || d?.base64 || d?.qrcode || d?.qr || null;
        if (!raw || typeof raw !== 'string') return null;
        let s = raw.trim();
        if (s.startsWith('data:') && s.includes(',')) s = s.split(',')[1];
        s = s.replace(/\s/g, '');
        if (s.length < 100) return null;
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return null;
        return s;
      };
      try {
        const resp = await fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`, { headers: { apikey: apiKey } });
        const data = await resp.json().catch(() => ({}));
        const state = data?.instance?.state || data?.state || 'unknown';
        let qrcode: string | null = null;
        let pairing_code: string | null = null;
        if (state !== 'open') {
          // Fetch QR from /instance/connect so frontend can render the image
          try {
            const r = await fetch(`${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`, { headers: { apikey: apiKey } });
            const d = await r.json().catch(() => ({}));
            qrcode = extractBase64(d);
            pairing_code = d?.pairingCode || d?.qrcode?.pairingCode || null;
          } catch { /* ignore */ }
        }
        return new Response(JSON.stringify({ connected: state === 'open', state, instance_name: instanceName, qrcode, pairing_code }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch {
        return new Response(JSON.stringify({ connected: false, state: 'unknown', instance_name: instanceName }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ----- disconnect_instance -----
    if (action === 'disconnect_instance') {
      const auth = await requireUser();
      if ('error' in auth) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const user = auth.user;
      const baseUrl = sharedEvoUrl();
      const apiKey = sharedEvoKey();
      const instanceName = userInstanceName(user.id);
      try {
        await fetch(`${baseUrl}/instance/logout/${encodeURIComponent(instanceName)}`, { method: 'DELETE', headers: { apikey: apiKey } });
      } catch { /* ignore */ }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Legacy test_connection (kept for backwards compatibility)
    if (action === 'test_connection') {
      const { evolution_api_url, instance_name } = body;
      const key = sharedEvoKey();
      if (!key) {
        return new Response(JSON.stringify({ connected: false, message: 'Chave da Evolution API não configurada' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      try {
        const resp = await fetch(`${normalizeEvolutionApiUrl(evolution_api_url)}/instance/connectionState/${instance_name}`, { headers: { apikey: key } });
        const data = await resp.json();
        const connected = data?.instance?.state === 'open';
        return new Response(JSON.stringify({ connected, message: connected ? 'Conectado' : 'Instância não conectada' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch {
        return new Response(JSON.stringify({ connected: false, message: 'Não foi possível conectar à Evolution API' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
      const { phone_number, message, patient_name, user_id, instance_name } = body;

      if (!phone_number || !message) {
        return new Response(
          JSON.stringify({ error: 'phone_number e message são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[process_message] lookup', { user_id, instance_name, phone_number });

      // Find agent settings — try multiple strategies
      let agentSettings: any = null;

      // 1. Explicit user_id
      if (user_id) {
        const { data } = await supabase
          .from('ai_agent_settings')
          .select('*')
          .eq('user_id', user_id)
          .maybeSingle();
        agentSettings = data;
      }

      // 2. By instance_name (case-insensitive)
      if (!agentSettings && instance_name) {
        const { data } = await supabase
          .from('ai_agent_settings')
          .select('*')
          .ilike('evolution_instance_name', instance_name)
          .maybeSingle();
        agentSettings = data;
      }

      // 3. By existing conversation phone number
      if (!agentSettings) {
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

      // 4. Fallback: any enabled WhatsApp agent (single-tenant deployments)
      if (!agentSettings) {
        const { data } = await supabase
          .from('ai_agent_settings')
          .select('*')
          .eq('is_whatsapp_enabled', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        agentSettings = data;
        if (agentSettings) {
          console.log('[process_message] fallback to first whatsapp-enabled agent', agentSettings.user_id);
        }
      }

      if (!agentSettings) {
        console.error('[process_message] no agent found', { user_id, instance_name, phone_number });
        return new Response(
          JSON.stringify({
            error: 'Configurações do agente não encontradas.',
            hint: 'Cadastre o agente em Ajustes → Agente IA e preencha o campo "Nome da instância" exatamente igual ao usado no n8n/Evolution.',
            received: { user_id: user_id || null, instance_name: instance_name || null, phone_number },
          }),
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

      // Resolve Evolution config with fallback to env secrets
      const evoUrl = agentSettings.evolution_api_url || Deno.env.get('EVOLUTION_API_URL') || '';
      const evoInstance = agentSettings.evolution_instance_name || Deno.env.get('EVOLUTION_INSTANCE') || '';
      console.log(`[process_message] evolution config url=${evoUrl ? 'set' : 'MISSING'} instance=${evoInstance || 'MISSING'}`);

      if ((isOutsideHours || isClosedDay) && agentSettings.auto_reply_outside_hours) {
        const outsideMsg = agentSettings.outside_hours_message || 'Estamos fora do horário de atendimento.';

        let outsideSent = false;
        if (evoUrl && evoInstance) {
          outsideSent = await sendWhatsAppReply(evoUrl, evoInstance, phone_number, outsideMsg);
          console.log(`[process_message] outside-hours sent=${outsideSent}`);
        } else {
          console.warn('[process_message] outside-hours: Evolution config missing, not sending');
        }

        return new Response(
          JSON.stringify({
            response: outsideMsg,
            agent_name: agentSettings.agent_name,
            requires_human: false,
            outside_hours: true,
            whatsapp_sent: outsideSent,
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

      // Send reply via WhatsApp (uses evoUrl/evoInstance resolved above with env fallback)
      let whatsappSent = false;
      if (evoUrl && evoInstance) {
        whatsappSent = await sendWhatsAppReply(evoUrl, evoInstance, phone_number, reply);
        console.log(`[process_message] reply sent=${whatsappSent}`);
      } else {
        console.warn('[process_message] Evolution config missing, reply not sent via WhatsApp');
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
