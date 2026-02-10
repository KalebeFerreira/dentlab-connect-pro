import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, isWithinInterval,
} from "date-fns";

interface WorkRecord {
  id: string;
  work_type: string;
  patient_name: string | null;
  value: number | null;
  status: string;
  start_date: string;
  end_date: string | null;
  deadline: string | null;
  color: string | null;
  notes: string | null;
}

interface ProductionGoal {
  id: string;
  goal_type: "weekly" | "monthly" | "annual";
  target_quantity: number;
  target_value: number;
  employee_id: string | null;
}

export interface GoalProgressItem {
  goal: ProductionGoal;
  currentQuantity: number;
  currentValue: number;
  quantityPercent: number;
  valuePercent: number;
}

interface EmployeeGoalsProps {
  employeeId: string;
  ownerUserId: string;
  workRecords: WorkRecord[];
  onProgressChange?: (progressList: GoalProgressItem[]) => void;
}

const GOAL_TYPE_LABELS: Record<string, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  annual: "Anual",
};

export const EmployeeGoals = ({ employeeId, ownerUserId, workRecords, onProgressChange }: EmployeeGoalsProps) => {
  const [goals, setGoals] = useState<ProductionGoal[]>([]);

  const fetchGoals = useCallback(async () => {
    // Fetch goals assigned to this employee by the lab owner
    const { data } = await supabase
      .from("production_goals")
      .select("id, goal_type, target_quantity, target_value, employee_id")
      .eq("user_id", ownerUserId)
      .eq("employee_id", employeeId)
      .eq("is_active", true);

    if (data) setGoals(data as ProductionGoal[]);
  }, [employeeId, ownerUserId]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("employee-goals")
      .on("postgres_changes", { event: "*", schema: "public", table: "production_goals" }, () => fetchGoals())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGoals]);

  const progressList = useMemo(() => {
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
        const d = new Date(r.start_date);
        return isWithinInterval(d, { start, end });
      });

      const currentQuantity = filtered.filter((r) => r.status === "finished").length;
      const currentValue = filtered.reduce((sum, r) => sum + (r.value || 0), 0);
      const quantityPercent = goal.target_quantity > 0 ? Math.min((currentQuantity / goal.target_quantity) * 100, 100) : 0;
      const valuePercent = goal.target_value > 0 ? Math.min((currentValue / goal.target_value) * 100, 100) : 0;

      return { goal, currentQuantity, currentValue, quantityPercent, valuePercent };
    });
  }, [goals, workRecords]);

  // Notify parent about progress changes
  useEffect(() => {
    onProgressChange?.(progressList);
  }, [progressList, onProgressChange]);

  if (goals.length === 0) return null;

  const getStatusColor = (percent: number) => {
    if (percent >= 100) return "text-primary";
    if (percent >= 80) return "text-accent-foreground";
    if (percent >= 50) return "text-secondary-foreground";
    return "text-muted-foreground";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5" />
          Minhas Metas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {progressList.map((p) => (
            <Card key={p.goal.id} className="border">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {GOAL_TYPE_LABELS[p.goal.goal_type]}
                  </Badge>
                  {(p.quantityPercent >= 100 || p.valuePercent >= 100) && (
                    <div className="flex items-center gap-1 text-xs text-primary font-medium">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Meta atingida! 🎉
                    </div>
                  )}
                </div>

                {p.goal.target_quantity > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Trabalhos</span>
                      <span className={`font-medium ${getStatusColor(p.quantityPercent)}`}>
                        {p.currentQuantity}/{p.goal.target_quantity}
                      </span>
                    </div>
                    <Progress value={p.quantityPercent} className="h-2" />
                    <p className={`text-xs text-right font-medium ${getStatusColor(p.quantityPercent)}`}>
                      {p.quantityPercent.toFixed(0)}%
                    </p>
                  </div>
                )}

                {p.goal.target_value > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Valor</span>
                      <span className={`font-medium ${getStatusColor(p.valuePercent)}`}>
                        {p.currentValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /{" "}
                        {p.goal.target_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                    <Progress value={p.valuePercent} className="h-2" />
                    <p className={`text-xs text-right font-medium ${getStatusColor(p.valuePercent)}`}>
                      {p.valuePercent.toFixed(0)}%
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
