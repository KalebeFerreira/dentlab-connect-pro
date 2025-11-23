import { useSubscription } from "@/hooks/useSubscription";
import { Card } from "@/components/ui/card";
import { GoogleAdSense } from "./GoogleAdSense";

interface AdSenseDisplayProps {
  adSlot: string;
  adFormat?: "auto" | "fluid" | "rectangle" | "vertical" | "horizontal";
  className?: string;
  title?: string;
}

export const AdSenseDisplay = ({ 
  adSlot, 
  adFormat = "auto",
  className = "",
  title = "Publicidade"
}: AdSenseDisplayProps) => {
  const { subscribed } = useSubscription();

  // Don't show ads if user has active subscription
  if (subscribed) {
    return null;
  }

  return (
    <Card className={`p-4 ${className}`}>
      <div className="text-xs text-muted-foreground mb-2 text-center">
        {title}
      </div>
      <GoogleAdSense 
        adSlot={adSlot}
        adFormat={adFormat}
        fullWidthResponsive={true}
      />
    </Card>
  );
};
