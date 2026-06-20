// Multi-tenant Evolution API manager unificado - DentLab Connect Pro
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const HARDCODED_EVOLUTION_URL = "https://dentlab-evolution-api.sfwgy9.easypanel.host";

function sanitizeUrl(raw: string): string {
  let s = (raw || "").trim();
  const m = s.match(/https?:\/\/[^\s\)\]\>"']+/);
  if (m) s = m[0];
  return s.replace(/\/+$/, "");
}

const _envUrl = sanitizeUrl(Deno.env.get("EVOLUTION_API_URL") || "");
const EVOLUTION_API_URL = _envUrl && /^https?:\/\/[^\s]+\.[^\s]+$/.test(_envUrl) ? _envUrl : HARDCODED_EVOLUTION_URL;
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const N8N_WEBHOOK_BASE = Deno.env.get("N8N_WEBHOOK_URL") || `${SUPABASE_URL}/functions/v1/n8n-whatsapp-webhook`;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function instanceNameFor(userId: string) {
  return `clinic-${userId.replace(/-/g, "").slice(0, 24)}`;
}

function webhookFor(userId: string) {
  const sep = N8N_WEBHOOK_BASE.includes("?") ? "&" : "?";
  return `${N8N_WEBHOOK_BASE}${sep}clinicaId=${userId}`;
}

async function evo(path: string, init: RequestInit = {}) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    throw new Error("Evolution API não configurada nos Secrets do Supabase.");
  }
  const res = await fetch(`${EVOLUTION_API_URL}${path}`, {
    ...init,
    headers: {
      apikey: EVOLUTION_API_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await res.text().catch(() => "");
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("NOT_FOUND");
    }
    const msg = data?.message || data?.error || text || `Evolution API erro ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { error: "Não autenticado" });

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return json(401, { error: "Token inválido" });
    const userId = userData.user.id;

    // Leitura defensiva do body para mitigar falhas de stream (Erro 500)
    let body: any = {};
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch (_) {
      body = {};
    }

    const action = String(body.action || "");
    const instanceName = instanceNameFor(userId);
    const webhookUrl = webhookFor(userId);

    const updateRow = async (patch: Record<string, unknown>) => {
      await supabaseAdmin.from("ai_agent_settings").update(patch).eq("user_id", userId);
    };

    const upsertRow = async (patch: Record<string, unknown>) => {
      const { data: existing } = await supabaseAdmin.from("ai_agent_settings").select("id").eq("user_id", userId).maybeSingle();
      if (existing?.id) {
        await supabaseAdmin.from("ai_agent_settings").update(patch).eq("user_id", userId);
      } else {
        await supabaseAdmin.from("ai_agent_settings").insert({ user_id: userId, ...patch });
      }
    };

    if (action === "get") {
      const { data } = await supabaseAdmin
        .from("ai_agent_settings")
        .select("evolution_instance_name, connection_status, webhook_url, whatsapp_number, connected_at")
        .eq("user_id", userId).maybeSingle();
      return json(200, { instance_name: instanceName, ...data });
    }

    if (action === "create") {
      try {
        await evo(`/instance/create`, {
          method: "POST",
          body: JSON.stringify({
            instanceName,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
            webhook: {
              url: webhookUrl,
              byEvents: false,
              base64: true,
              events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
            },
          }),
        });
      } catch (e) {
        const msg = String(e instanceof Error ? e.message : e);
        if (msg !== "NOT_FOUND" && !/already|exists|in use/i.test(msg)) throw e;
      }

      // Auto-configura o webhook logo após criar a instância,
      // para que a clínica não precise mexer no painel da Evolution.
      try {
        await evo(`/webhook/set/${encodeURIComponent(instanceName)}`, {
          method: "POST",
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url: webhookUrl,
              byEvents: false,
              base64: false,
              events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
            },
          }),
        });
      } catch (e) {
        console.warn(`[evolution-manager] auto set_webhook falhou: ${e instanceof Error ? e.message : e}`);
      }

      await upsertRow({
        evolution_instance_name: instanceName,
        webhook_url: webhookUrl,
        connection_status: "connecting",
      });
      return json(200, { instance_name: instanceName, webhook_url: webhookUrl, status: "connecting" });
    }

    if (action === "connect") {
      try {
        const data = await evo(`/instance/connect/${encodeURIComponent(instanceName)}`, { method: "GET" });
        const qrcode = data?.base64 || data?.qrcode?.base64 || null;
        await updateRow({ connection_status: "connecting" });
        return json(200, { qrcode, pairing_code: data?.pairingCode || data?.qrcode?.pairingCode || null });
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          // Auto-recuperação: instância sumiu da RAM, recria e tenta conectar
          await evo(`/instance/create`, {
            method: "POST",
            body: JSON.stringify({ instanceName, integration: "WHATSAPP-BAILEYS", qrcode: true }),
          });
          const data = await evo(`/instance/connect/${encodeURIComponent(instanceName)}`, { method: "GET" });
          return json(200, { qrcode: data?.base64 || data?.qrcode?.base64 || null });
        }
        throw e;
      }
    }

    if (action === "status") {
      try {
        const data = await evo(`/instance/connectionState/${encodeURIComponent(instanceName)}`, { method: "GET" });
        const state: string = data?.instance?.state || data?.state || "close";
        const normalized = state === "open" ? "open" : state === "connecting" ? "connecting" : "disconnected";

        const patch: Record<string, unknown> = { connection_status: normalized };
        if (normalized === "open") patch.connected_at = new Date().toISOString();
        await updateRow(patch);

        return json(200, { state: normalized, isCreated: true, raw: data });
      } catch (_e) {
        // 404 ou instância indisponível: resposta amigável para o polling
        return json(200, { state: "disconnected", isCreated: false });
      }
    }

    if (action === "set_webhook") {
      await evo(`/webhook/set/${encodeURIComponent(instanceName)}`, {
        method: "POST",
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: true,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
          },
        }),
      });
      await updateRow({ webhook_url: webhookUrl });
      return json(200, { webhook_url: webhookUrl });
    }

    if (action === "disconnect") {
      try {
        await evo(`/instance/logout/${encodeURIComponent(instanceName)}`, { method: "DELETE" });
      } catch (_) {}
      await updateRow({ connection_status: "disconnected", connected_at: null });
      return json(200, { status: "disconnected" });
    }

    return json(400, { error: `Ação desconhecida: ${action}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[evolution-manager error] ${msg}`);
    // Responde 200 com erro embutido para o frontend não quebrar com FunctionsHttpError
    return json(200, { error: msg, state: "disconnected" });
  }
});
