import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Crown, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface FreemiumBannerProps {
  feature: string;
  currentUsage: number;
  limit: number;
  percentage: number;
}

export const FreemiumBanner = ({ feature, currentUsage, limit, percentage }: FreemiumBannerProps) => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  // Show banner for all users when approaching or exceeding limits
  if (dismissed || percentage < 70) return null;

  return (
    <Alert className="mb-4 border-primary/50 bg-primary/5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            <AlertDescription className="font-semibold">
              {percentage >= 100 
                ? `Você atingiu o limite de ${feature}` 
                : `Você está próximo do limite de ${feature}`}
            </AlertDescription>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{currentUsage} / {limit} usados</span>
              <span>{Math.round(percentage)}%</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>
          <p className="text-sm text-muted-foreground">
            Faça upgrade para ter acesso ilimitado e desbloquear todos os recursos premium.
          </p>
          <Button 
            size="sm" 
            onClick={() => navigate('/planos')}
            className="mt-2"
          >
            <Crown className="h-3 w-3 mr-2" />
            Ver Planos
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
};
