import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Verificar plano premium / super premium
    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    const premiumPriceIds = [
      "price_1SYVOjF2249riykhJmw4RoVM",
      "price_1SYVOjF2249riykhi2o98hEf",
      "price_1Sq1xDF2249riykhpt3dJbLS",
      "price_1Sq1xZF2249riykhmTrDAtsF",
    ];

    if (!subscription || !premiumPriceIds.includes(subscription.stripe_price_id || "")) {
      return new Response(
        JSON.stringify({ error: "Este recurso é exclusivo para assinantes Premium e Super Premium" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { message, conversationHistory } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "Mensagem não fornecida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ai-dashboard] user=${userId} msg=${message.substring(0, 60)}`);

    const [ordersResult, patientsResult, appointmentsResult, financialResult] = await Promise.all([
      supabase.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      supabase.from("patients").select("*").eq("user_id", userId).limit(50),
      supabase.from("appointments").select("*").eq("user_id", userId).order("appointment_date", { ascending: false }).limit(10),
      supabase.from("financial_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    ]);

    const orders = ordersResult.data || [];
    const patients = patientsResult.data || [];
    const appointments = appointmentsResult.data || [];
    const financial = financialResult.data || [];

    const totalOrders = orders.length;
    const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "in_progress").length;
    const totalPatients = patients.length;
    const upcomingAppointments = appointments.filter((a) => new Date(a.appointment_date) > new Date()).length;
    const totalRevenue = financial.filter((f) => f.transaction_type === "receipt").reduce((acc, f) => acc + (f.amount || 0), 0);
    const totalExpenses = financial.filter((f) => f.transaction_type === "payment").reduce((acc, f) => acc + (f.amount || 0), 0);

    const systemPrompt = `Você é o Assistente IA Premium do DentLab Connect, um sistema de gestão para laboratórios de prótese dentária e clínicas odontológicas.

## Dados do Usuário (Atualizados):
- Total de Pedidos: ${totalOrders} (${pendingOrders} pendentes)
- Total de Pacientes: ${totalPatients}
- Agendamentos Próximos: ${upcomingAppointments}
- Receita Total: R$ ${totalRevenue.toFixed(2)}
- Despesas Totais: R$ ${totalExpenses.toFixed(2)}
- Lucro Aproximado: R$ ${(totalRevenue - totalExpenses).toFixed(2)}

## Últimos Pedidos:
${orders.slice(0, 5).map((o) => `- ${o.work_type} para ${o.patient_name} (${o.clinic_name}) - Status: ${o.status}`).join("\n") || "Nenhum pedido recente"}

## Regras:
- Responda em português brasileiro, conciso e amigável (use emojis)
- Forneça insights proativos baseados nos dados
- Para análises financeiras, mencione que são baseadas nos dados disponíveis`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: message },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, temperature: 0.7, max_tokens: 2000 }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Erro na API de IA: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";

    return new Response(
      JSON.stringify({
        response: assistantMessage,
        stats: { orders: totalOrders, pendingOrders, patients: totalPatients, upcomingAppointments, revenue: totalRevenue, expenses: totalExpenses },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[ai-dashboard] erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
