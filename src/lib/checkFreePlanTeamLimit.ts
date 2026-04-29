import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true if the user is on the free plan (or no active subscription).
 */
export const isFreePlan = async (userId: string): Promise<boolean> => {
  const { data: sub } = await supabase
    .from("user_subscriptions")
    .select("status, plan_name")
    .eq("user_id", userId)
    .maybeSingle();

  const active = sub?.status === "active" && sub?.plan_name && sub.plan_name !== "free";
  return !active;
};

/**
 * Free plan allows only 1 employee/dentist registered (active).
 * Returns { allowed, reason } – when not allowed, reason is a message ready to show.
 */
export const checkTeamLimit = async (
  userId: string,
  table: "employees" | "dentists",
): Promise<{ allowed: boolean; reason?: string }> => {
  const free = await isFreePlan(userId);
  if (!free) return { allowed: true };

  const base = supabase.from(table as any).select("id", { count: "exact", head: true }).eq("user_id", userId);
  const { count } = table === "dentists"
    ? await base.eq("is_active", true)
    : await base.eq("status", "active");

  if ((count || 0) >= 1) {
    const label = table === "employees" ? "funcionário" : "dentista";
    return {
      allowed: false,
      reason: `O plano Gratuito permite apenas 1 ${label} cadastrado. Faça upgrade para cadastrar mais.`,
    };
  }
  return { allowed: true };
};
