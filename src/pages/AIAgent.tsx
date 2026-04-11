import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';
import {
  Bot, Save, Loader2, MessageSquare, Settings2, Webhook,
  CheckCircle2, XCircle, Crown, Lock, Phone, Globe, Clock,
  Copy, ExternalLink
} from 'lucide-react';

interface AgentSettings {
  id?: string;
  agent_name: string;
  agent_personality: string | null;
  welcome_message: string | null;
  is_whatsapp_enabled: boolean;
  evolution_api_url: string | null;
  evolution_instance_name: string | null;
  working_hours_start: string | null;
  working_hours_end: string | null;
  work_on_weekends: boolean;
  auto_reply_outside_hours: boolean;
  outside_hours_message: string | null;
  n8n_webhook_url?: string | null;
}

const defaultSettings: AgentSettings = {
  agent_name: 'Assistente',
  agent_personality: 'Você é um assistente profissional e cordial de um laboratório/clínica odontológica. Responda de forma clara e objetiva.',
  welcome_message: 'Olá! 👋 Sou o assistente virtual. Como posso ajudar?',
  is_whatsapp_enabled: false,
  evolution_api_url: null,
  evolution_instance_name: null,
  working_hours_start: '08:00',
  working_hours_end: '18:00',
  work_on_weekends: false,
  auto_reply_outside_hours: true,
  outside_hours_message: 'No momento estamos fora do horário de atendimento. Retornaremos em breve! 😊',
  n8n_webhook_url: null,
};

export default function AIAgent() {
  const { user } = useAuth();
  const { currentPlan, loading: subLoading } = useSubscription();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AgentSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const hasAccess = currentPlan?.key === 'premium' || currentPlan?.key === 'super_premium';

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/n8n-whatsapp-webhook`;

  useEffect(() => {
    if (user) loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_agent_settings')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSettings({
          id: data.id,
          agent_name: data.agent_name,
          agent_personality: data.agent_personality,
          welcome_message: data.welcome_message,
          is_whatsapp_enabled: data.is_whatsapp_enabled ?? false,
          evolution_api_url: data.evolution_api_url,
          evolution_instance_name: data.evolution_instance_name,
          working_hours_start: data.working_hours_start,
          working_hours_end: data.working_hours_end,
          work_on_weekends: data.work_on_weekends ?? false,
          auto_reply_outside_hours: data.auto_reply_outside_hours ?? true,
          outside_hours_message: data.outside_hours_message,
        });
      }
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const payload = {
        user_id: user.id,
        agent_name: settings.agent_name,
        agent_personality: settings.agent_personality,
        welcome_message: settings.welcome_message,
        is_whatsapp_enabled: settings.is_whatsapp_enabled,
        evolution_api_url: settings.evolution_api_url,
        evolution_instance_name: settings.evolution_instance_name,
        working_hours_start: settings.working_hours_start,
        working_hours_end: settings.working_hours_end,
        work_on_weekends: settings.work_on_weekends,
        auto_reply_outside_hours: settings.auto_reply_outside_hours,
        outside_hours_message: settings.outside_hours_message,
      };

      if (settings.id) {
        const { error } = await supabase
          .from('ai_agent_settings')
          .update(payload)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('ai_agent_settings')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setSettings(prev => ({ ...prev, id: data.id }));
      }

      toast.success('Configurações salvas com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!settings.evolution_api_url || !settings.evolution_instance_name) {
      toast.error('Preencha a URL da Evolution API e o nome da instância');
      return;
    }

    setTestingConnection(true);
    setConnectionStatus('idle');

    try {
      const { data, error } = await supabase.functions.invoke('n8n-whatsapp-webhook', {
        body: {
          action: 'test_connection',
          evolution_api_url: settings.evolution_api_url,
          instance_name: settings.evolution_instance_name,
        },
      });

      if (error) throw error;
      if (data?.connected) {
        setConnectionStatus('success');
        toast.success('Conexão com WhatsApp estabelecida!');
      } else {
        setConnectionStatus('error');
        toast.error(data?.message || 'Falha na conexão');
      }
    } catch (err) {
      setConnectionStatus('error');
      toast.error('Erro ao testar conexão');
    } finally {
      setTestingConnection(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL do webhook copiada!');
  };

  if (subLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Card className="border-2 border-dashed border-muted">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="relative mb-6">
              <Bot className="h-20 w-20 text-muted-foreground/50" />
              <Lock className="h-8 w-8 text-primary absolute -bottom-1 -right-1" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Agente IA WhatsApp</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Configure seu agente de IA para atendimento automático via WhatsApp.
              Disponível para assinantes Premium.
            </p>
            <Button onClick={() => navigate('/planos')} size="lg" className="gap-2">
              <Crown className="h-5 w-5" />
              Assinar Plano Premium
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            Agente IA WhatsApp
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure seu agente de atendimento automático com integração n8n
          </p>
        </div>
        <Button onClick={saveSettings} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>

      <Tabs defaultValue="agent" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="agent" className="gap-1.5 text-xs sm:text-sm">
            <Bot className="h-4 w-4" /> Agente
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-1.5 text-xs sm:text-sm">
            <Phone className="h-4 w-4" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="n8n" className="gap-1.5 text-xs sm:text-sm">
            <Webhook className="h-4 w-4" /> n8n
          </TabsTrigger>
        </TabsList>

        {/* Tab Agente */}
        <TabsContent value="agent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Identidade do Agente</CardTitle>
              <CardDescription>Defina o nome e personalidade do seu assistente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Agente</Label>
                <Input
                  value={settings.agent_name}
                  onChange={e => setSettings(s => ({ ...s, agent_name: e.target.value }))}
                  placeholder="Ex: Ana, Dra. Sofia, Assistente Lab..."
                />
                <p className="text-xs text-muted-foreground">
                  Este nome será usado nas conversas com os pacientes/clientes
                </p>
              </div>

              <div className="space-y-2">
                <Label>Personalidade / Instruções</Label>
                <Textarea
                  value={settings.agent_personality || ''}
                  onChange={e => setSettings(s => ({ ...s, agent_personality: e.target.value }))}
                  placeholder="Descreva como o agente deve se comportar..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Mensagem de Boas-vindas</Label>
                <Textarea
                  value={settings.welcome_message || ''}
                  onChange={e => setSettings(s => ({ ...s, welcome_message: e.target.value }))}
                  placeholder="Mensagem enviada automaticamente ao iniciar conversa..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Horário de Atendimento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Input
                    type="time"
                    value={settings.working_hours_start || '08:00'}
                    onChange={e => setSettings(s => ({ ...s, working_hours_start: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input
                    type="time"
                    value={settings.working_hours_end || '18:00'}
                    onChange={e => setSettings(s => ({ ...s, working_hours_end: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Atender nos finais de semana</Label>
                <Switch
                  checked={settings.work_on_weekends}
                  onCheckedChange={v => setSettings(s => ({ ...s, work_on_weekends: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Resposta automática fora do horário</Label>
                <Switch
                  checked={settings.auto_reply_outside_hours}
                  onCheckedChange={v => setSettings(s => ({ ...s, auto_reply_outside_hours: v }))}
                />
              </div>

              {settings.auto_reply_outside_hours && (
                <div className="space-y-2">
                  <Label>Mensagem fora do horário</Label>
                  <Textarea
                    value={settings.outside_hours_message || ''}
                    onChange={e => setSettings(s => ({ ...s, outside_hours_message: e.target.value }))}
                    rows={2}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab WhatsApp */}
        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conexão WhatsApp (Evolution API)
              </CardTitle>
              <CardDescription>
                Conecte seu número de WhatsApp via Evolution API para atendimento automático
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Ativar WhatsApp</Label>
                  <p className="text-xs text-muted-foreground">Habilitar atendimento via WhatsApp</p>
                </div>
                <Switch
                  checked={settings.is_whatsapp_enabled}
                  onCheckedChange={v => setSettings(s => ({ ...s, is_whatsapp_enabled: v }))}
                />
              </div>

              {settings.is_whatsapp_enabled && (
                <>
                  <div className="space-y-2">
                    <Label>URL da Evolution API</Label>
                    <Input
                      value={settings.evolution_api_url || ''}
                      onChange={e => setSettings(s => ({ ...s, evolution_api_url: e.target.value }))}
                      placeholder="https://sua-evolution-api.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Nome da Instância</Label>
                    <Input
                      value={settings.evolution_instance_name || ''}
                      onChange={e => setSettings(s => ({ ...s, evolution_instance_name: e.target.value }))}
                      placeholder="minha-instancia"
                    />
                    <p className="text-xs text-muted-foreground">
                      Nome da instância criada na Evolution API vinculada ao seu número de WhatsApp
                    </p>
                  </div>

                  <Button
                    onClick={testConnection}
                    disabled={testingConnection}
                    variant="outline"
                    className="gap-2 w-full"
                  >
                    {testingConnection ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : connectionStatus === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : connectionStatus === 'error' ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                    {testingConnection ? 'Testando...' : 'Testar Conexão'}
                  </Button>

                  {connectionStatus === 'success' && (
                    <Badge variant="outline" className="w-full justify-center py-2 text-green-600 border-green-300 bg-green-50">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> WhatsApp conectado e funcionando
                    </Badge>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab n8n */}
        <TabsContent value="whatsapp" className="space-y-4" />
        <TabsContent value="n8n" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Integração n8n
              </CardTitle>
              <CardDescription>
                Configure o webhook do n8n para conectar a automação do seu agente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                <h4 className="font-medium text-sm">📋 Como configurar:</h4>
                <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>No n8n, crie um workflow com o trigger <strong>Webhook</strong></li>
                  <li>Configure o webhook para receber dados via <strong>POST</strong></li>
                  <li>Copie a URL abaixo e cole no node <strong>HTTP Request</strong> do n8n para enviar mensagens ao agente</li>
                  <li>No n8n, configure o node da <strong>Evolution API</strong> para enviar as respostas ao WhatsApp</li>
                </ol>
              </div>

              <div className="space-y-2">
                <Label>URL do Webhook (use no n8n)</Label>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure este endpoint no n8n para receber as mensagens e processar com IA
                </p>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <h4 className="font-medium text-sm">📨 Formato do payload esperado:</h4>
                <pre className="text-xs bg-muted rounded p-3 overflow-x-auto">
{`{
  "action": "process_message",
  "phone_number": "5511999999999",
  "message": "Olá, quero agendar...",
  "patient_name": "João Silva"
}`}
                </pre>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <h4 className="font-medium text-sm">📤 Resposta retornada:</h4>
                <pre className="text-xs bg-muted rounded p-3 overflow-x-auto">
{`{
  "response": "Olá João! Vou verificar...",
  "agent_name": "${settings.agent_name}",
  "requires_human": false
}`}
                </pre>
              </div>

              <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200">
                <CardContent className="p-4">
                  <div className="flex gap-2">
                    <Settings2 className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-800 dark:text-amber-200">Modo Híbrido</p>
                      <p className="text-amber-700 dark:text-amber-300 mt-1">
                        O agente responde automaticamente, mas se o paciente pedir para falar com um humano,
                        o sistema sinaliza <code className="bg-amber-200/50 px-1 rounded">"requires_human": true</code> na resposta.
                        Configure no n8n para encaminhar essas mensagens para seu atendimento manual.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
