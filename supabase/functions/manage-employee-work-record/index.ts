import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type WorkRecordUpdate = {
  work_type?: string;
  patient_name?: string | null;
  color?: string | null;
  status?: "pending" | "in_progress" | "finished";
  start_date?: string;
  end_date?: string | null;
  value?: number | null;
};

const getMonthAndYear = (dateValue: string) => {
  const [year, month] = dateValue.split("T")[0].split("-").map(Number);
  return { month, year };
};

const syncTransaction = async (adminClient: ReturnType<typeof createClient>, record: {
  id: string;
  user_id: string;
  work_type: string;
  patient_name: string | null;
  status: string;
  start_date: string;
  value: number | null;
}) => {
  const description = `Pagamento funcionário - ${record.work_type}${record.patient_name ? ` - ${record.patient_name}` : ""} [TRAB:${record.id}]`;

  if (!record.value || record.value <= 0) {
    const { error: deleteError } = await adminClient
      .from("financial_transactions")
      .delete()
      .like("description", `%[TRAB:${record.id}]%`);

    if (deleteError) throw deleteError;
    return;
  }

  const { month, year } = getMonthAndYear(record.start_date);

  const { data: existingTransaction, error: fetchError } = await adminClient
    .from("financial_transactions")
    .select("id")
    .like("description", `%[TRAB:${record.id}]%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const transactionPayload = {
    user_id: record.user_id,
    transaction_type: "expense",
    amount: record.value,
    description,
    status: record.status === "finished" ? "completed" : "pending",
    month,
    year,
    category: "Mão de Obra",
  };

  if (existingTransaction?.id) {
    const { error: updateError } = await adminClient
      .from("financial_transactions")
      .update(transactionPayload)
      .eq("id", existingTransaction.id);

    if (updateError) throw updateError;
    return;
  }

  const { error: insertError } = await adminClient
    .from("financial_transactions")
    .insert(transactionPayload);

  if (insertError) throw insertError;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, recordId, updates } = await req.json() as {
      action?: "update" | "delete";
      recordId?: string;
      updates?: WorkRecordUpdate;
    };

    if (!action || !recordId) {
      return new Response(JSON.stringify({ error: "Dados inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: employee, error: employeeError } = await adminClient
      .from("employees")
      .select("id, user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (employeeError || !employee) {
      return new Response(JSON.stringify({ error: "Funcionário não encontrado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: record, error: recordError } = await adminClient
      .from("work_records")
      .select("id, user_id, employee_id, work_type, patient_name, status, start_date, end_date, value")
      .eq("id", recordId)
      .eq("employee_id", employee.id)
      .eq("user_id", employee.user_id)
      .maybeSingle();

    if (recordError || !record) {
      return new Response(JSON.stringify({ error: "Trabalho não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Allow editing/deleting any record regardless of status

    if (action === "delete") {
      const { error: deleteRecordError } = await adminClient
        .from("work_records")
        .delete()
        .eq("id", record.id);

      if (deleteRecordError) throw deleteRecordError;

      const { error: deleteTransactionError } = await adminClient
        .from("financial_transactions")
        .delete()
        .like("description", `%[TRAB:${record.id}]%`);

      if (deleteTransactionError) throw deleteTransactionError;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowedStatuses = new Set(["pending", "in_progress", "finished"]);

    if (!updates) {
      return new Response(JSON.stringify({ error: "Nenhuma alteração enviada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (updates.status && !allowedStatuses.has(updates.status)) {
      return new Response(JSON.stringify({ error: "Status inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitizedUpdates: WorkRecordUpdate = {
      work_type: updates.work_type?.trim(),
      patient_name: updates.patient_name ?? null,
      color: updates.color ?? null,
      status: updates.status,
      start_date: updates.start_date,
      end_date: updates.end_date ?? null,
      value: typeof updates.value === "number" ? updates.value : null,
    };

    const { data: updatedRecord, error: updateError } = await adminClient
      .from("work_records")
      .update(sanitizedUpdates)
      .eq("id", record.id)
      .select("id, user_id, employee_id, work_type, patient_name, status, start_date, end_date, value")
      .single();

    if (updateError) throw updateError;

    await syncTransaction(adminClient, updatedRecord);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in manage-employee-work-record:", error);

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});