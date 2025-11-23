import { useSubscription } from "@/hooks/useSubscription";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export const AdBanner = () => {
  const { subscribed } = useSubscription();
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  // Don't show ads if user has active subscription
  if (subscribed || dismissed) {
    return null;
  }

  return (
    <Card className="relative p-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={() => setDismissed(true)}
      >
        <X className="h-4 w-4" />
      </Button>
      
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">
            🚀 Desbloqueie todo o potencial da plataforma
          </h3>
          <p className="text-xs text-muted-foreground">
            Sem anúncios, recursos ilimitados e muito mais!
          </p>
        </div>
        <Button 
          size="sm"
          onClick={() => navigate("/planos")}
        >
          Ver Planos
        </Button>
      </div>
    </Card>
  );
};
