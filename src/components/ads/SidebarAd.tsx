import { useSubscription } from "@/hooks/useSubscription";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

export const SidebarAd = () => {
  const { subscribed } = useSubscription();
  const navigate = useNavigate();

  // Don't show ads if user has active subscription
  if (subscribed) {
    return null;
  }

  return (
    <Card className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
      <div className="flex flex-col items-center text-center gap-3">
        <Sparkles className="h-8 w-8 text-primary" />
        <div>
          <h4 className="font-semibold text-sm mb-1">Premium</h4>
          <p className="text-xs text-muted-foreground">
            Sem limites, sem anúncios
          </p>
        </div>
        <Button 
          size="sm" 
          className="w-full"
          onClick={() => navigate("/planos")}
        >
          Assinar Agora
        </Button>
      </div>
    </Card>
  );
};
