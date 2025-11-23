import { useSubscription } from "@/hooks/useSubscription";
import { GoogleAdSense } from "./GoogleAdSense";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface AdSenseBannerProps {
  adSlot: string;
  dismissible?: boolean;
}

export const AdSenseBanner = ({ adSlot, dismissible = true }: AdSenseBannerProps) => {
  const { subscribed } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  // Don't show ads if user has active subscription or dismissed
  if (subscribed || dismissed) {
    return null;
  }

  return (
    <div className="relative bg-card border rounded-lg p-4 mb-6">
      {dismissible && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      
      <div className="text-xs text-muted-foreground mb-2 text-center">
        Publicidade
      </div>
      
      <GoogleAdSense 
        adSlot={adSlot}
        adFormat="horizontal"
        fullWidthResponsive={true}
      />
    </div>
  );
};
