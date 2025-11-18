import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, TestTube } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";

export const NotificationSettings = () => {
  const { permission, isSupported, requestPermission, testNotification } = useNotifications();

  const getPermissionBadge = () => {
    switch (permission) {
      case "granted":
        return <Badge className="bg-green-500">Ativadas</Badge>;
      case "denied":
        return <Badge variant="destructive">Bloqueadas</Badge>;
      default:
        return <Badge variant="secondary">Não configuradas</Badge>;
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Notificações Push
          </CardTitle>
          <CardDescription>
            Notificações push não são suportadas neste navegador
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificações Push
        </CardTitle>
        <CardDescription>
          Receba lembretes de agendamentos 24h antes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Status</p>
            <p className="text-sm text-muted-foreground">
              {permission === "granted"
                ? "Você receberá notificações de lembretes"
                : "Ative para receber lembretes de agendamentos"}
            </p>
          </div>
          {getPermissionBadge()}
        </div>

        <div className="flex gap-2">
          {permission !== "granted" && (
            <Button onClick={requestPermission} className="w-full">
              <Bell className="h-4 w-4 mr-2" />
              Ativar Notificações
            </Button>
          )}
          {permission === "granted" && (
            <Button onClick={testNotification} variant="outline" className="w-full">
              <TestTube className="h-4 w-4 mr-2" />
              Testar Notificação
            </Button>
          )}
        </div>

        {permission === "denied" && (
          <div className="p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
            <p className="font-medium">Notificações bloqueadas</p>
            <p className="mt-1">
              Para reativar, acesse as configurações do seu navegador e permita notificações
              para este site.
            </p>
          </div>
        )}

        {permission === "granted" && (
          <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg text-sm text-green-700 dark:text-green-300">
            <p className="font-medium">✓ Notificações ativas</p>
            <p className="mt-1">
              Você receberá lembretes automáticos 24h antes de cada agendamento.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
