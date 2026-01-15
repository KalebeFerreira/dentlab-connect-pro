import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const InstallAppDialog = ({ open, onOpenChange }: InstallAppDialogProps) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);
    
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for successful installation
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  if (isInstalled) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Instalar Aplicativo
          </DialogTitle>
          <DialogDescription>
            Instale o DentLab Connect no seu dispositivo para acesso rápido e uso offline!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {deferredPrompt ? (
            <div className="space-y-4">
              <div className="bg-primary/10 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Vantagens do aplicativo:</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>✓ Acesso rápido pela tela inicial</li>
                  <li>✓ Funciona mesmo sem internet</li>
                  <li>✓ Notificações em tempo real</li>
                  <li>✓ Experiência otimizada para celular</li>
                </ul>
              </div>
              <Button onClick={handleInstall} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Instalar Agora
              </Button>
            </div>
          ) : isIOS ? (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-3">Para instalar no iPhone/iPad:</h4>
                <ol className="text-sm space-y-2 text-muted-foreground">
                  <li>1. Toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta para cima)</li>
                  <li>2. Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></li>
                  <li>3. Toque em <strong>"Adicionar"</strong> no canto superior direito</li>
                </ol>
              </div>
            </div>
          ) : isAndroid ? (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-3">Para instalar no Android:</h4>
                <ol className="text-sm space-y-2 text-muted-foreground">
                  <li>1. Toque no menu (três pontos) no canto superior</li>
                  <li>2. Selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong></li>
                  <li>3. Confirme a instalação</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Acesse pelo navegador do seu celular para instalar o aplicativo.
              </p>
            </div>
          )}

          <Button variant="ghost" onClick={handleSkip} className="w-full">
            <X className="mr-2 h-4 w-4" />
            Continuar no Navegador
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
