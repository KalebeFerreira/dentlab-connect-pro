import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, BellOff, Settings } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useOrderNotifications } from '@/hooks/useOrderNotifications';
import { useDeadlineNotifications } from '@/hooks/useDeadlineNotifications';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const NotificationManager = () => {
  const { permission, isSupported, requestPermission, sendNotification } = usePushNotifications();
  const [userId, setUserId] = useState<string>();
  const [enabledNotifications, setEnabledNotifications] = useState({
    newOrders: true,
    statusUpdates: true,
    deadlines: true,
  });

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    getUser();
  }, []);

  // Enable notifications based on settings
  useOrderNotifications(enabledNotifications.newOrders || enabledNotifications.statusUpdates ? userId : undefined);
  useDeadlineNotifications(enabledNotifications.deadlines ? userId : undefined);

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (granted) {
      sendNotification('✅ Notificações Ativadas', {
        body: 'Você receberá alertas sobre pedidos e prazos importantes',
      });
    }
  };

  const handleTestNotification = () => {
    sendNotification('🧪 Notificação de Teste', {
      body: 'Esta é uma notificação de teste do Essência dental-lab',
    });
  };

  if (!isSupported) {
    return (
      <Alert>
        <BellOff className="h-4 w-4" />
        <AlertDescription>
          Notificações push não são suportadas neste navegador.
        </AlertDescription>
      </Alert>
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
          Receba alertas em tempo real sobre pedidos, prazos e atualizações importantes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Permission Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">
                Status das Notificações
              </Label>
              <p className="text-sm text-muted-foreground">
                {permission === 'granted' && '✅ Ativadas'}
                {permission === 'denied' && '❌ Bloqueadas'}
                {permission === 'default' && '⏸️ Não configuradas'}
              </p>
            </div>
            {permission !== 'granted' && (
              <Button onClick={handleRequestPermission}>
                <Bell className="h-4 w-4 mr-2" />
                Ativar Notificações
              </Button>
            )}
          </div>

          {permission === 'denied' && (
            <Alert>
              <AlertDescription>
                As notificações foram bloqueadas. Para ativá-las, acesse as configurações do navegador e permita notificações para este site.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Notification Settings */}
        {permission === 'granted' && (
          <>
            <div className="space-y-4 pt-4 border-t">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configurações de Alertas
              </h4>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="new-orders">Novos Pedidos</Label>
                    <p className="text-xs text-muted-foreground">
                      Receber alerta quando um novo pedido for criado
                    </p>
                  </div>
                  <Switch
                    id="new-orders"
                    checked={enabledNotifications.newOrders}
                    onCheckedChange={(checked) =>
                      setEnabledNotifications((prev) => ({ ...prev, newOrders: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="status-updates">Atualizações de Status</Label>
                    <p className="text-xs text-muted-foreground">
                      Receber alerta quando o status de um pedido mudar
                    </p>
                  </div>
                  <Switch
                    id="status-updates"
                    checked={enabledNotifications.statusUpdates}
                    onCheckedChange={(checked) =>
                      setEnabledNotifications((prev) => ({ ...prev, statusUpdates: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="deadlines">Prazos Próximos</Label>
                    <p className="text-xs text-muted-foreground">
                      Receber alerta sobre prazos de entrega próximos ou atrasados
                    </p>
                  </div>
                  <Switch
                    id="deadlines"
                    checked={enabledNotifications.deadlines}
                    onCheckedChange={(checked) =>
                      setEnabledNotifications((prev) => ({ ...prev, deadlines: checked }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button variant="outline" onClick={handleTestNotification} className="w-full">
                Enviar Notificação de Teste
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
