// Multi-tenant Evolution API manager.
// Each authenticated user (clinic) gets an isolated WhatsApp instance.
// Actions: create | connect | status | set_webhook | disconnect | get
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
const EVOLUTION_API_URL = _envUrl && /^https?:\/\/[^\s]+\.[^\s]+$/.test(_envUrl)
  ? _envUrl
  : HARDCODED_EVOLUTION_URL;
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
    throw new Error("Evolution API não configurada no Supabase (EVOLUTION_API_URL ou EVOLUTION_API_KEY ausentes nos Secrets)");
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

    // Safe JSON parse — empty body should not throw
    let body: any = {};
    try {
      if (req.body) body = await req.json();
    } catch (_) {
      body = {};
    }

    const action = String(body.action || "");
    const instanceName = instanceNameFor(userId);
    const webhookUrl = webhookFor(userId);

    const updateRow = async (patch: Record<string, unknown>) => {
      await supabaseAdmin
        .from("ai_agent_settings")
        .update(patch)
        .eq("user_id", userId);
    };

    const upsertRow = async (patch: Record<string, unknown>) => {
      const { data: existing } = await supabaseAdmin
        .from("ai_agent_settings").select("id").eq("user_id", userId).maybeSingle();
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
      return json(200, { instance_name: data?.evolution_instance_name || null, ...data });
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
        if (!/already|exists|in use/i.test(msg)) throw e;
        console.log(`[evolution-manager] instance ${instanceName} already exists, reusing`);
      }
      await upsertRow({
        evolution_instance_name: instanceName,
        webhook_url: webhookUrl,
        connection_status: "connecting",
      });
      return json(200, { instance_name: instanceName, webhook_url: webhookUrl, status: "connecting" });
    }

    if (action === "connect") {
      const data = await evo(`/instance/connect/${encodeURIComponent(instanceName)}`, { method: "GET" });
      const qrcode = data?.base64 || data?.qrcode?.base64 || null;
      await updateRow({ connection_status: "connecting" });
      return json(200, { qrcode, pairing_code: data?.pairingCode || data?.qrcode?.pairingCode || null });
    }

    if (action === "status") {
      try {
        const data = await evo(`/instance/connectionState/${encodeURIComponent(instanceName)}`, { method: "GET" });
        const state: string = data?.instance?.state || data?.state || "close";
        const normalized = state === "open" ? "open" : state === "connecting" ? "connecting" : "disconnected";
        const patch: Record<string, unknown> = { connection_status: normalized };
        if (normalized === "open") patch.connected_at = new Date().toISOString();
        await updateRow(patch);
        return json(200, { state: normalized, raw: data });
      } catch (e) {
        return json(200, { state: "disconnected", error: String(e instanceof Error ? e.message : e) });
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
      } catch (e) {
        console.warn(`[evolution-manager] logout warn: ${e instanceof Error ? e.message : e}`);
      }
      await updateRow({ connection_status: "disconnected", connected_at: null });
      return json(200, { status: "disconnected" });
    }

    return json(400, { error: `Ação desconhecida: ${action}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[evolution-manager] ${msg}`);
    // Return structured error as 200 so the frontend toast can read the clean message
    return json(200, { error: msg, state: "error" });
  }
});
