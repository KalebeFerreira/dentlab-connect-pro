import { useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Trophy, Flame, Target, Sparkles } from "lucide-react";

interface GoalProgress {
  goal: {
    id: string;
    goal_type: string;
    target_quantity: number;
    target_value: number;
  };
  currentQuantity: number;
  currentValue: number;
  quantityPercent: number;
  valuePercent: number;
}

interface EmployeeGoalAlertsProps {
  progressList: GoalProgress[];
}

const GOAL_TYPE_LABELS: Record<string, string> = {
  weekly: "semanal",
  monthly: "mensal",
  annual: "anual",
};

const MOTIVATIONAL_PHRASES = [
  "💪 Cada trabalho concluído te aproxima do topo! Continue assim!",
  "🌟 Grandes resultados vêm de esforço constante. Você está no caminho certo!",
  "🔥 Não pare agora! A disciplina de hoje constrói o sucesso de amanhã.",
  "⭐ Seu talento é inegável. Continue dando o seu melhor!",
  "🚀 O progresso pode ser lento, mas desistir não é uma opção. Vai com tudo!",
  "💎 Cada peça que você produz é uma prova do seu profissionalismo!",
  "🎯 Foco no objetivo! Você é capaz de superar qualquer meta.",
];

const CONGRATS_PHRASES = [
  "🏆 Parabéns, campeão! Você bateu a meta e mostrou do que é capaz!",
  "🎉 Incrível! Meta superada com excelência! Você é referência!",
  "🥇 Você é fera! Meta atingida e produção impecável!",
  "🌟 Que orgulho! Meta batida — seu esforço faz toda a diferença!",
  "🎊 Espetacular! Você provou que dedicação traz resultados!",
];

function getRandomPhrase(phrases: string[], seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return phrases[Math.abs(hash) % phrases.length];
}

export const EmployeeGoalAlerts = ({ progressList }: EmployeeGoalAlertsProps) => {
  const alerts = useMemo(() => {
    return progressList.map((p) => {
      const maxPercent = Math.max(p.quantityPercent, p.valuePercent);
      const label = GOAL_TYPE_LABELS[p.goal.goal_type] || p.goal.goal_type;

      if (maxPercent >= 100) {
        return {
          id: p.goal.id,
          type: "success" as const,
          icon: Trophy,
          title: `🏆 Meta ${label} batida!`,
          message: getRandomPhrase(CONGRATS_PHRASES, p.goal.id),
        };
      }
      if (maxPercent >= 80) {
        return {
          id: p.goal.id,
          type: "warning" as const,
          icon: Flame,
          title: `🔥 Quase lá! ${maxPercent.toFixed(0)}% da meta ${label}`,
          message: "Falta pouco! Mantenha o ritmo e conquiste sua meta!",
        };
      }
      if (maxPercent >= 50) {
        return {
          id: p.goal.id,
          type: "info" as const,
          icon: Target,
          title: `📊 Metade do caminho! Meta ${label} em ${maxPercent.toFixed(0)}%`,
          message: getRandomPhrase(MOTIVATIONAL_PHRASES, p.goal.id),
        };
      }
      return {
        id: p.goal.id,
        type: "motivational" as const,
        icon: Sparkles,
        title: `🎯 Meta ${label}: ${maxPercent.toFixed(0)}%`,
        message: getRandomPhrase(MOTIVATIONAL_PHRASES, p.goal.id + "low"),
      };
    });
  }, [progressList]);

  if (alerts.length === 0) return null;

  const getAlertClass = (type: string) => {
    switch (type) {
      case "success": return "border-primary/50 bg-primary/5";
      case "warning": return "border-accent/50 bg-accent/5";
      case "info": return "border-secondary/50 bg-secondary/5";
      default: return "border-muted bg-muted/5";
    }
  };

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <Alert key={alert.id} className={getAlertClass(alert.type)}>
          <alert.icon className="h-5 w-5" />
          <AlertTitle className="text-sm font-semibold">{alert.title}</AlertTitle>
          <AlertDescription className="text-xs">{alert.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
};
