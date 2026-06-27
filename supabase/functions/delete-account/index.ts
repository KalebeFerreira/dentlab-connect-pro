import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const readBody = async (req: Request) => {
  try {
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get the authorization header to identify the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Não autorizado" }, 401);
    }

    const body = await readBody(req) as { password?: string; confirmation?: string };
    const password = body.password?.trim() || "";
    const confirmation = body.confirmation?.trim().toUpperCase() || "";

    // Create a client with the user's token to get their info
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return json({ error: "Usuário não encontrado" }, 401);
    }

    const providers = (user.identities || []).map((identity: any) => identity.provider);
    const provider = user.app_metadata?.provider || providers[0] || "email";
    const isPasswordAccount = provider === "email" || providers.includes("email");

    if (isPasswordAccount) {
      if (!password) {
        return json({ error: "Senha é obrigatória" }, 400);
      }

      // Verify password by attempting to sign in
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
      const { error: signInError } = await supabaseAuth.auth.signInWithPassword({
        email: user.email!,
        password,
      });

      if (signInError) {
        return json({ error: "Senha incorreta" }, 400);
      }
    } else if (confirmation !== "EXCLUIR") {
      return json({ error: "Confirme a exclusão digitando EXCLUIR" }, 400);
    }

    // Use admin client to clean up related data and delete the user
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const userTables = [
      'ai_agent_settings','appointments','automatic_report_schedules','campaign_media',
      'certificate_templates','client_payment_profiles','company_info','deliveries',
      'delivery_persons','dentists','document_numbers','employees',
      'financial_scanned_documents','financial_transactions','fiscal_settings',
      'fiscal_summary','image_generation_usage','invoice_usage','invoices',
      'laboratory_documents','laboratory_info','marketing_campaigns',
      'mercadopago_webhook_logs','message_history','message_templates',
      'order_message_history','orders','patients','pdf_generation_usage','pix_payments',
      'price_tables','production_goals','profiles','report_history','scanned_documents',
      'scanner_usage','services','user_roles','user_subscriptions',
      'whatsapp_conversations','whatsapp_messages','work_records'
    ];

    try {
      const { error: orderFilesError } = await supabaseAdmin
        .from('order_files')
        .delete()
        .eq('uploaded_by', user.id);
      if (orderFilesError) {
        console.error("Error clearing order_files:", orderFilesError);
        cleanupErrors.push(`order_files: ${orderFilesError.message}`);
      }
    } catch (e: any) {
      console.error("Exception clearing order_files:", e);
      cleanupErrors.push(`order_files: ${e.message}`);
    }

    const cleanupErrors: string[] = [];
    for (const table of userTables) {
      try {
        const { error: delErr } = await supabaseAdmin.from(table).delete().eq('user_id', user.id);
        if (delErr) {
          console.error(`Error clearing ${table}:`, delErr);
          cleanupErrors.push(`${table}: ${delErr.message}`);
        }
      } catch (e: any) {
        console.error(`Exception clearing ${table}:`, e);
        cleanupErrors.push(`${table}: ${e.message}`);
      }
    }

    // Try to remove user files from storage buckets (best-effort)
    const buckets = ['order-files','campaign-media','laboratory-files','scanned-documents','fiscal-certificates'];
    for (const bucket of buckets) {
      try {
        const { data: files } = await supabaseAdmin.storage.from(bucket).list(user.id, { limit: 1000 });
        if (files && files.length > 0) {
          const paths = files.map((f: any) => `${user.id}/${f.name}`);
          await supabaseAdmin.storage.from(bucket).remove(paths);
        }
      } catch (e) {
        console.error(`Storage cleanup error for ${bucket}:`, e);
      }
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("Error deleting user:", deleteError, "Cleanup errors:", cleanupErrors);
      return json({
        error: `Erro ao excluir conta: ${deleteError.message}`,
        details: cleanupErrors,
      }, 500);
    }

    return json({ success: true, message: "Conta excluída com sucesso" });
  } catch (error: any) {
    console.error("Error in delete-account:", error);
    return json({ error: `Erro interno: ${error?.message || "desconhecido"}` }, 500);
  }
});
