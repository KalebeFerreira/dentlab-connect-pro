import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const { orderId, extraInstructions } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: order }, { data: company }, { data: profile }] =
      await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId).eq("user_id", user.id).maybeSingle(),
        supabase.from("company_info").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
      ]);

    if (!order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toLocaleDateString("pt-BR");
    const contractor = {
      nome: company?.company_name || profile?.name || "[Prestador]",
      cpf_cnpj: company?.cpf_cnpj || "[CPF/CNPJ]",
      email: company?.email || "[email]",
      telefone: company?.phone || "[telefone]",
    };

    const systemPrompt = `Você é um assistente jurídico que redige contratos de prestação de serviços odontológicos/protéticos em português do Brasil. Gere um contrato formal, claro, com cláusulas numeradas (Objeto, Obrigações, Prazo, Valor e Forma de Pagamento, Garantia, Confidencialidade, Rescisão, Foro). Use markdown simples (títulos com ##, parágrafos). Não invente dados não fornecidos — use os dados reais informados.`;

    const userPrompt = `Gere um Contrato de Prestação de Serviços com base nestes dados reais:

CONTRATADO (Prestador):
- Nome/Razão Social: ${contractor.nome}
- CPF/CNPJ: ${contractor.cpf_cnpj}
- E-mail: ${contractor.email}
- Telefone: ${contractor.telefone}

CONTRATANTE (Cliente):
- Clínica: ${order.clinic_name}
- Dentista responsável: Dr(a). ${order.dentist_name}

OBJETO DO SERVIÇO:
- Paciente: ${order.patient_name}
- Tipo de trabalho: ${order.work_type}${order.work_name ? ` - ${order.work_name}` : ""}
- Dentes: ${order.teeth_numbers}
${order.custom_color ? `- Cor: ${order.custom_color}` : ""}
- Quantidade: ${order.quantity}

VALOR: ${order.amount ? `R$ ${Number(order.amount).toFixed(2)}` : "[a combinar]"}
PRAZO DE ENTREGA: ${order.delivery_date ? new Date(order.delivery_date).toLocaleDateString("pt-BR") : "[a combinar]"}
DATA: ${today}

${order.observations ? `Observações adicionais: ${order.observations}` : ""}
${extraInstructions ? `Instruções extras: ${extraInstructions}` : ""}

Termine com a frase "E por estarem assim justos e contratados, firmam o presente instrumento." e linhas para assinatura do CONTRATADO e CONTRATANTE.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
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

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar contrato" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const contractText = aiData.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ contract: contractText, contractor, order }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
