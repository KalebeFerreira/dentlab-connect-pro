import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { password } = await req.json();

    if (!password || password.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Senha é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a client with the user's token to get their info
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password by attempting to sign in
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { error: signInError } = await supabaseAuth.auth.signInWithPassword({
      email: user.email!,
      password: password,
    });

    if (signInError) {
      return new Response(
        JSON.stringify({ error: "Senha incorreta" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use admin client to clean up related data and delete the user
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const userTables = [
      'ai_agent_settings','appointments','automatic_report_schedules','campaign_media',
      'certificate_templates','company_info','deliveries','delivery_persons','dentists',
      'document_numbers','employees','financial_scanned_documents','financial_transactions',
      'fiscal_settings','fiscal_summary','image_generation_usage','invoice_usage','invoices',
      'laboratory_documents','laboratory_info','marketing_campaigns','mercadopago_webhook_logs',
      'message_history','message_templates','order_message_history','orders','patients',
      'pdf_generation_usage','pix_payments','price_tables','production_goals','profiles',
      'report_history','scanned_documents','scanner_usage','services','user_roles',
      'user_subscriptions','whatsapp_conversations','whatsapp_messages','work_records'
    ];

    for (const table of userTables) {
      const { error: delErr } = await supabaseAdmin.from(table).delete().eq('user_id', user.id);
      if (delErr) {
        console.error(`Error clearing ${table}:`, delErr);
      }
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("Error deleting user:", deleteError);
      return new Response(
        JSON.stringify({ error: `Erro ao excluir conta: ${deleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Conta excluída com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in delete-account:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
