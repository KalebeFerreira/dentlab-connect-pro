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
    const { appointments, dentistName } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    console.log(`Analisando ${appointments.length} agendamentos para ${dentistName || 'dentista'}`);

    const appointmentsText = appointments.map((apt: any) => {
      const date = new Date(apt.appointment_date);
      return `- ${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}: ${apt.patient_name || 'Paciente'} - ${apt.procedure_type || apt.type} (${apt.duration_minutes}min) - Status: ${apt.status}`;
    }).join('\n');

    const systemPrompt = `Você é um assistente especializado em gestão de agendas odontológicas. Analise os agendamentos fornecidos e identifique:
1. Conflitos de horário (sobreposições)
2. Intervalos muito curtos entre procedimentos
3. Horários ociosos que poderiam ser otimizados
4. Sugestões para melhor distribuição dos atendimentos
5. Alertas sobre procedimentos longos em horários inadequados

Responda em português brasileiro de forma clara e objetiva, usando emojis para destacar pontos importantes.
Formate a resposta em seções: CONFLITOS, ALERTAS, SUGESTÕES DE OTIMIZAÇÃO.`;

    const userPrompt = `Analise a agenda ${dentistName ? `do(a) Dr(a). ${dentistName}` : 'do dentista'}:

${appointmentsText || 'Nenhum agendamento encontrado.'}

Forneça uma análise completa com conflitos, alertas e sugestões de otimização.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`Erro no gateway de IA: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content;

    console.log("Análise concluída com sucesso");

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Erro na análise de agenda:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
