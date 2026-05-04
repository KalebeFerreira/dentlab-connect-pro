import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface WhatsAppRequest {
  phone_number?: string;
  message?: string;
  dentist_name?: string;
  sessionId?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

function normalizePhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function buildSystemPrompt(dentistName?: string): string {
  const clinicLabel = dentistName ? `da clínica do(a) Dr(a). ${dentistName}` : "da clínica odontológica";
  return `Você é a secretária virtual ${clinicLabel}. Seu papel é atender pacientes pelo WhatsApp de forma humana, acolhedora e profissional, com o objetivo principal de **converter a conversa em um agendamento**.

## Personalidade
- Tom brasileiro, caloroso, educado e profissional
- Linguagem simples e clara — evite jargões técnicos
- Use o nome do paciente quando souber
- Respostas curtas e diretas (idealmente 1-3 frases)
- Pode usar emojis com moderação (😊 🦷 📅)

## Comportamento por intenção
- **Saudação ("oi", "boa tarde")** → cumprimente, apresente-se e pergunte como pode ajudar
- **Pergunta de preço** → responda de forma genérica que os valores variam conforme avaliação e convide para uma avaliação presencial gratuita ou agendamento
- **Demonstração de interesse / dúvida sobre tratamento** → explique brevemente e ofereça agendar uma avaliação
- **Pedido de agendamento** → pergunte preferência de dia/turno e confirme o contato
- **Reclamação ou urgência** → demonstre empatia e ofereça encaixe o quanto antes
- **Mensagem fora de contexto** → redirecione gentilmente para o atendimento odontológico

## Regras
- SEMPRE conduza a conversa para uma ação (agendar, confirmar dados, marcar avaliação)
- NUNCA prometa preços fechados, prazos médicos ou diagnósticos
- Se a pessoa quiser falar com humano, confirme que vai encaminhar
- Nunca invente informações sobre a clínica que não foram fornecidas

## Saída
Responda APENAS com JSON válido neste formato exato (sem markdown, sem \`\`\`):
{
  "response": "mensagem para enviar ao paciente",
  "meta": {
    "lead_temperature": "cold | warm | hot",
    "intent": "info | pricing | booking | complaint | greeting | other",
    "suggested_action": "continue | offer_booking | close | escalate_human"
  }
}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as WhatsAppRequest;
    const { message, phone_number, dentist_name, sessionId, conversationHistory } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(JSON.stringify({ error: "Campo 'message' é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!phone_number || typeof phone_number !== "string" || !phone_number.trim()) {
      return new Response(JSON.stringify({ error: "Campo 'phone_number' é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedPhone = normalizePhone(phone_number);
    const cleanMessage = message.trim().slice(0, 2000);

    console.log(`[ai-whatsapp] phone=${normalizedPhone} session=${sessionId || "-"} msg="${cleanMessage.substring(0, 80)}"`);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[ai-whatsapp] LOVABLE_API_KEY ausente");
      return new Response(JSON.stringify({ error: "Configuração de IA ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = buildSystemPrompt(dentist_name);

    const history = Array.isArray(conversationHistory)
      ? conversationHistory.filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant")).slice(-10)
      : [];

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: cleanMessage },
    ];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.7,
        max_tokens: 600,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      console.error(`[ai-whatsapp] AI gateway erro ${aiRes.status}: ${errText}`);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro na geração da resposta" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "";

    let parsed: { response: string; meta: { lead_temperature: string; intent: string; suggested_action: string } };
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("[ai-whatsapp] resposta não-JSON, usando fallback");
      parsed = {
        response: raw || "Desculpe, pode repetir? 😊",
        meta: { lead_temperature: "warm", intent: "other", suggested_action: "continue" },
      };
    }

    const result = {
      response: parsed.response || "Desculpe, pode repetir? 😊",
      meta: {
        lead_temperature: parsed.meta?.lead_temperature || "warm",
        intent: parsed.meta?.intent || "other",
        suggested_action: parsed.meta?.suggested_action || "continue",
      },
      sessionId: sessionId || null,
      phone_number: normalizedPhone,
    };

    console.log(`[ai-whatsapp] reply intent=${result.meta.intent} temp=${result.meta.lead_temperature}`);

    // Send reply back through Evolution API
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE");

    let evolution_sent = false;
    let evolution_error: string | null = null;

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
      evolution_error = "Evolution API não configurada (EVOLUTION_API_URL/EVOLUTION_API_KEY/EVOLUTION_INSTANCE)";
      console.warn(`[ai-whatsapp] ${evolution_error}`);
    } else if (/^(https?:\/\/)?(localhost|127\.0\.0\.1)/i.test(EVOLUTION_API_URL)) {
      evolution_error = "EVOLUTION_API_URL aponta para endereço local — use o domínio público";
      console.error(`[ai-whatsapp] ${evolution_error}`);
    } else {
      try {
        const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
        const sendUrl = `${baseUrl}/message/sendText/${encodeURIComponent(EVOLUTION_INSTANCE)}`;
        // Prefer sessionId from n8n (already a remoteJid like "5561...@s.whatsapp.net" or raw number).
        // Fallback to normalized phone number.
        const recipient = (sessionId && String(sessionId).trim()) || normalizedPhone;
        console.log(`[ai-whatsapp] enviando via Evolution: ${sendUrl} → ${recipient}`);
        const evoRes = await fetch(sendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: EVOLUTION_API_KEY,
          },
          body: JSON.stringify({
            number: recipient,
            text: result.response,
          }),
        });
        const evoText = await evoRes.text().catch(() => "");
        if (!evoRes.ok) {
          evolution_error = `Evolution API erro ${evoRes.status}: ${evoText.slice(0, 300)}`;
          console.error(`[ai-whatsapp] ${evolution_error}`);
        } else {
          evolution_sent = true;
          console.log(`[ai-whatsapp] enviado com sucesso via Evolution`);
        }
      } catch (e) {
        evolution_error = e instanceof Error ? e.message : String(e);
        console.error(`[ai-whatsapp] falha no envio Evolution: ${evolution_error}`);
      }
    }

    return new Response(JSON.stringify({ ...result, evolution_sent, evolution_error }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[ai-whatsapp] erro inesperado:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
