import { useSubscription } from "@/hooks/useSubscription";
import { Card } from "@/components/ui/card";
import { GoogleAdSense } from "./GoogleAdSense";

interface AdSenseSidebarProps {
  adSlot: string;
}

export const AdSenseSidebar = ({ adSlot }: AdSenseSidebarProps) => {
  const { subscribed } = useSubscription();

  // Don't show ads if user has active subscription
  if (subscribed) {
    return null;
  }

  return (
    <Card className="p-4 bg-card">
      <div className="text-xs text-muted-foreground mb-2 text-center">
        Publicidade
      </div>
      <GoogleAdSense 
        adSlot={adSlot}
        adFormat="vertical"
        fullWidthResponsive={false}
        className="min-h-[250px]"
      />
    </Card>
  );
};
