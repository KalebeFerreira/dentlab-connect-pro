import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, Smartphone, Share, CheckCircle2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Instalar App</h1>
              <p className="text-sm text-muted-foreground">
                Instale o app na tela inicial do seu celular
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {isInstalled ? (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                <CheckCircle2 className="h-16 w-16 text-green-600" />
                <h2 className="text-xl font-semibold text-green-800">App Instalado!</h2>
                <p className="text-green-700">
                  O Essência Dental Lab já está instalado no seu dispositivo.
                  Você pode acessá-lo pela tela inicial.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  Benefícios do App
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Acesso Rápido</p>
                    <p className="text-sm text-muted-foreground">Abra direto da tela inicial, sem precisar do navegador</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Funciona Offline</p>
                    <p className="text-sm text-muted-foreground">Acesse mesmo sem conexão à internet</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Tela Cheia</p>
                    <p className="text-sm text-muted-foreground">Experiência imersiva como um app nativo</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Scanner com Câmera</p>
                    <p className="text-sm text-muted-foreground">Use a câmera para escanear documentos</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {deferredPrompt ? (
              <Button onClick={handleInstall} size="lg" className="w-full h-14 text-lg">
                <Download className="mr-2 h-5 w-5" />
                Instalar Agora
              </Button>
            ) : isIOS ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🍎 Como instalar no iPhone
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ol className="space-y-3 text-sm">
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                      <span>Toque no botão <Share className="inline h-4 w-4" /> <strong>Compartilhar</strong> na barra do Safari</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                      <span>Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong></span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                      <span>Toque em <strong>"Adicionar"</strong> no canto superior direito</span>
                    </li>
                  </ol>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Certifique-se de usar o Safari. Outros navegadores no iOS não suportam instalação de apps.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            ) : isAndroid ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🤖 Como instalar no Android
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ol className="space-y-3 text-sm">
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                      <span>Toque no menu <strong>⋮</strong> (três pontos) no Chrome</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                      <span>Toque em <strong>"Instalar app"</strong> ou <strong>"Adicionar à tela inicial"</strong></span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                      <span>Confirme tocando em <strong>"Instalar"</strong></span>
                    </li>
                  </ol>
                </CardContent>
              </Card>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Acesse este site pelo celular para ver as instruções de instalação.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => navigate("/dashboard")}
        >
          Voltar ao Dashboard
        </Button>
      </main>
    </div>
  );
};

export default Install;
