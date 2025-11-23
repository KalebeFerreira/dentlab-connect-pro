import { useEffect, useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export const WelcomeVideoAd = () => {
  const { subscribed } = useSubscription();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Only show for free users and only once per session
    if (!subscribed && !sessionStorage.getItem("welcomeVideoShown")) {
      const timer = setTimeout(() => {
        setOpen(true);
        sessionStorage.setItem("welcomeVideoShown", "true");
      }, 2000); // Show after 2 seconds

      return () => clearTimeout(timer);
    }
  }, [subscribed]);

  if (subscribed) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Bem-vindo ao Essência! 🎉</DialogTitle>
          <DialogDescription>
            Conheça os recursos premium disponíveis
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            {/* Replace with actual video embed */}
            <iframe
              width="100%"
              height="100%"
              src="https://www.youtube.com/embed/dQw4w9WgXcQ"
              title="Vídeo de boas-vindas"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="rounded-lg"
            />
          </div>
          
          <div className="space-y-2">
            <h4 className="font-semibold">Recursos Premium:</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>✨ Pedidos ilimitados</li>
              <li>✨ Pacientes ilimitados</li>
              <li>✨ IA sem limites</li>
              <li>✨ Sem anúncios</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button 
              className="flex-1"
              onClick={() => {
                setOpen(false);
                navigate("/planos");
              }}
            >
              Ver Planos Premium
            </Button>
            <Button 
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Continuar Grátis
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
