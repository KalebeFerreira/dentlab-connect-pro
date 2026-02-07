import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { GoalProgress } from "./useProductionGoals";

export const useGoalNotifications = (progressList: GoalProgress[]) => {
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    progressList.forEach((p) => {
      const key = `${p.goal.id}-${p.goal.goal_type}`;

      // 50% milestone
      const key50 = `${key}-50`;
      if (
        (p.quantityPercent >= 50 || p.valuePercent >= 50) &&
        !notifiedRef.current.has(key50)
      ) {
        notifiedRef.current.add(key50);
        const label = getGoalLabel(p);
        toast.info(`📊 Meta 50% atingida!`, {
          description: `${label} já está na metade do caminho!`,
          duration: 6000,
        });
      }

      // 80% milestone
      const key80 = `${key}-80`;
      if (
        (p.quantityPercent >= 80 || p.valuePercent >= 80) &&
        !notifiedRef.current.has(key80)
      ) {
        notifiedRef.current.add(key80);
        const label = getGoalLabel(p);
        toast.info(`🔥 Meta quase lá! 80%`, {
          description: `${label} está quase batendo a meta!`,
          duration: 6000,
        });
      }

      // 100% milestone
      const key100 = `${key}-100`;
      if (
        (p.quantityPercent >= 100 || p.valuePercent >= 100) &&
        !notifiedRef.current.has(key100)
      ) {
        notifiedRef.current.add(key100);
        const label = getGoalLabel(p);
        toast.success(`🎉 Meta batida!`, {
          description: `${label} atingiu a meta ${getGoalTypeName(p.goal.goal_type)}!`,
          duration: 8000,
        });
      }
    });
  }, [progressList]);
};

function getGoalLabel(p: GoalProgress): string {
  return p.employeeName || "Laboratório";
}

function getGoalTypeName(type: string): string {
  switch (type) {
    case "weekly": return "semanal";
    case "monthly": return "mensal";
    case "annual": return "anual";
    default: return type;
  }
}
