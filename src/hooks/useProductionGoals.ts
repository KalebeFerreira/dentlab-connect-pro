import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Employee } from "@/components/laboratory/EmployeeManagement";
import type { WorkRecord } from "@/components/laboratory/WorkRecordManagement";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, isWithinInterval
} from "date-fns";

export interface ProductionGoal {
  id: string;
  user_id: string;
  employee_id: string | null;
  goal_type: "weekly" | "monthly" | "annual";
  target_quantity: number;
  target_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GoalProgress {
  goal: ProductionGoal;
  currentQuantity: number;
  currentValue: number;
  quantityPercent: number;
  valuePercent: number;
  employeeName?: string;
}

export const useProductionGoals = (userId?: string) => {
  const [goals, setGoals] = useState<ProductionGoal[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGoals = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("production_goals")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (error) throw error;
      setGoals((data || []) as ProductionGoal[]);
    } catch (error: any) {
      console.error("Erro ao carregar metas:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("production-goals-changes")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "production_goals",
        filter: `user_id=eq.${userId}`,
      }, () => {
        fetchGoals();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchGoals]);

  const saveGoal = async (goal: Partial<ProductionGoal> & { goal_type: string }) => {
    if (!userId) return;
    try {
      const existing = goals.find(
        (g) =>
          g.goal_type === goal.goal_type &&
          (g.employee_id || null) === (goal.employee_id || null)
      );

      if (existing) {
        const { error } = await supabase
          .from("production_goals")
          .update({
            target_quantity: goal.target_quantity || 0,
            target_value: goal.target_value || 0,
            is_active: true,
          })
          .eq("id", existing.id);
        if (error) throw error;
        toast.success("Meta atualizada!");
      } else {
        const { error } = await supabase
          .from("production_goals")
          .insert({
            user_id: userId,
            employee_id: goal.employee_id || null,
            goal_type: goal.goal_type,
            target_quantity: goal.target_quantity || 0,
            target_value: goal.target_value || 0,
          });
        if (error) throw error;
        toast.success("Meta criada!");
      }
      fetchGoals();
    } catch (error: any) {
      toast.error("Erro ao salvar meta", { description: error.message });
    }
  };

  const deleteGoal = async (goalId: string) => {
    try {
      const { error } = await supabase
        .from("production_goals")
        .delete()
        .eq("id", goalId);
      if (error) throw error;
      toast.success("Meta removida!");
      fetchGoals();
    } catch (error: any) {
      toast.error("Erro ao remover meta", { description: error.message });
    }
  };

  const getGoalProgress = (
    workRecords: WorkRecord[],
    employees: Employee[]
  ): GoalProgress[] => {
    const now = new Date();

    return goals.map((goal) => {
      let start: Date, end: Date;

      switch (goal.goal_type) {
        case "weekly":
          start = startOfWeek(now, { weekStartsOn: 1 });
          end = endOfWeek(now, { weekStartsOn: 1 });
          break;
        case "monthly":
          start = startOfMonth(now);
          end = endOfMonth(now);
          break;
        case "annual":
          start = startOfYear(now);
          end = endOfYear(now);
          break;
      }

      const filtered = workRecords.filter((r) => {
        const recordDate = new Date(r.start_date);
        const inPeriod = isWithinInterval(recordDate, { start, end });
        const matchesEmployee = goal.employee_id
          ? r.employee_id === goal.employee_id
          : true;
        return inPeriod && matchesEmployee;
      });

      const currentQuantity = filtered.filter((r) => r.status === "finished").length;
      const currentValue = filtered.reduce((sum, r) => sum + (r.value || 0), 0);

      const quantityPercent =
        goal.target_quantity > 0
          ? Math.min((currentQuantity / goal.target_quantity) * 100, 100)
          : 0;
      const valuePercent =
        goal.target_value > 0
          ? Math.min((currentValue / goal.target_value) * 100, 100)
          : 0;

      const employeeName = goal.employee_id
        ? employees.find((e) => e.id === goal.employee_id)?.name
        : undefined;

      return {
        goal,
        currentQuantity,
        currentValue,
        quantityPercent,
        valuePercent,
        employeeName,
      };
    });
  };

  return { goals, loading, saveGoal, deleteGoal, getGoalProgress, refetch: fetchGoals };
};
