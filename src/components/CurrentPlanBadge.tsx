import { Crown } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";

export const CurrentPlanBadge = () => {
  const { subscribed, currentPlan, loading } = useSubscription();
  const navigate = useNavigate();

  if (loading) return null;

  const planName = subscribed && currentPlan ? currentPlan.name : "Plano Gratuito";

  return (
    <button
      onClick={() => navigate("/planos")}
      className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
      title="Ver planos"
    >
      <Crown className="h-3.5 w-3.5 text-primary" />
      <span className="text-xs font-semibold text-primary whitespace-nowrap">
        <span className="hidden sm:inline">Você está no </span>
        {planName}
      </span>
    </button>
  );
};
