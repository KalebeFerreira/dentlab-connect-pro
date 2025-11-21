import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, User, Mail, CreditCard, AlertTriangle, HeadphonesIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NotificationManager } from "@/components/NotificationManager";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [newEmail, setNewEmail] = useState("");
  const [currentPlan, setCurrentPlan] = useState("Plano Gratuito");

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        navigate("/auth");
        return;
      }

      setUser(user);
      setNewEmail(user.email || "");

      // Buscar perfil do usuário
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }
    } catch (error) {
      console.error("Error checking user:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === user?.email) {
      toast.error("Digite um novo email válido");
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      
      if (error) throw error;

      toast.success("Email de confirmação enviado! Verifique sua caixa de entrada.");
    } catch (error: any) {
      console.error("Error updating email:", error);
      toast.error(error.message || "Erro ao atualizar email");
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      toast.info("Funcionalidade de cancelamento em desenvolvimento");
      // Aqui você pode integrar com sistema de pagamentos real
    } catch (error) {
      console.error("Error canceling subscription:", error);
      toast.error("Erro ao cancelar assinatura");
    }
  };

  const handleDeleteAccount = async () => {
    try {
      // Implementar lógica de exclusão de conta
      toast.info("Entre em contato com o suporte para excluir sua conta");
    } catch (error) {
      console.error("Error deleting account:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Configurações da Conta</h1>
        <p className="text-muted-foreground">Gerencie suas preferências e informações pessoais</p>
      </div>

      <div className="space-y-6">
        {/* Informações do Perfil */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações do Perfil
            </CardTitle>
            <CardDescription>Suas informações básicas de perfil</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={profile?.name || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-id">ID do Usuário</Label>
              <Input
                id="user-id"
                value={user?.id || ""}
                disabled
                className="bg-muted font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Gerenciamento de Email */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email da Conta
            </CardTitle>
            <CardDescription>Atualize seu endereço de email</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-email">Email Atual</Label>
              <Input
                id="current-email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Novo Email</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="seu-novo-email@exemplo.com"
              />
            </div>
            <Button
              onClick={handleUpdateEmail}
              disabled={updating || newEmail === user?.email}
              className="w-full sm:w-auto"
            >
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Atualizar Email
            </Button>
            <Alert>
              <AlertDescription className="text-sm">
                Você receberá um email de confirmação no novo endereço. Clique no link para confirmar a alteração.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Notificações Push */}
        <NotificationManager />

        {/* Suporte e Atendimento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HeadphonesIcon className="h-5 w-5" />
              Suporte e Atendimento
            </CardTitle>
            <CardDescription>Entre em contato conosco para qualquer dúvida ou suporte</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground mb-1">Email de Atendimento</p>
                  <a 
                    href="mailto:essenciadentallab@gmail.com"
                    className="text-sm text-primary hover:underline"
                  >
                    essenciadentallab@gmail.com
                  </a>
                </div>
              </div>
              
              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Nossa equipe está pronta para ajudar você. Envie suas dúvidas, sugestões ou problemas técnicos para nosso email de atendimento.
                </p>
              </div>
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                Tempo médio de resposta: 24-48 horas úteis
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Plano e Assinatura */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Plano e Assinatura
            </CardTitle>
            <CardDescription>Gerencie seu plano atual</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium text-foreground">{currentPlan}</p>
                <p className="text-sm text-muted-foreground">Status: Ativo</p>
              </div>
              <Button variant="outline" size="sm">
                Fazer Upgrade
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-sm text-foreground">Recursos do Plano Atual</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Pedidos ilimitados</li>
                <li>Gerenciamento financeiro</li>
                <li>Controle de pacientes</li>
                <li>Ferramentas de IA</li>
              </ul>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full sm:w-auto">
                  Cancelar Assinatura
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar Assinatura?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja cancelar sua assinatura? Você perderá acesso aos recursos premium.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancelSubscription}>
                    Confirmar Cancelamento
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Zona de Perigo */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Zona de Perigo
            </CardTitle>
            <CardDescription>Ações irreversíveis para sua conta</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full sm:w-auto">
                  Excluir Conta
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir Conta Permanentemente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é irreversível. Todos os seus dados, pedidos, pacientes e informações serão permanentemente excluídos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Confirmar Exclusão
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
