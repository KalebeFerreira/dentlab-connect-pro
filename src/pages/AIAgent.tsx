import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';
import {
  Bot, Save, Loader2, MessageSquare, Settings2, Webhook,
  CheckCircle2, XCircle, Crown, Phone, Globe, Clock,
  Copy, Timer, Sparkles, Zap, ArrowRight, Shield
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
}

const defaultSettings: AgentSettings = {
  agent_name: '',
  agent_personality: '',
  welcome_message: 'Olá! 👋 Sou o assistente virtual. Como posso ajudar?',
  is_whatsapp_enabled: true,
  evolution_api_url: null,
  evolution_instance_name: null,
  working_hours_start: '08:00',
  working_hours_end: '18:00',
  work_on_weekends: false,
  auto_reply_outside_hours: true,
  outside_hours_message: 'No momento estamos fora do horário de atendimento. Retornaremos em breve! 😊',
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
  const [trialStartedAt, setTrialStartedAt] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  // Quick setup fields
  const [setupName, setSetupName] = useState('');
  const [setupFunction, setSetupFunction] = useState('');
  const [setupPhone, setSetupPhone] = useState('');
  const [setupStep, setSetupStep] = useState<'form' | 'activating' | 'done'>('form');

  const isPremium = currentPlan?.key === 'premium' || currentPlan?.key === 'super_premium';
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
        setTrialStartedAt((data as any).trial_started_at);
        // Consider configured if agent_name is set and not default
        setIsConfigured(!!data.agent_name && data.agent_name !== 'Assistente Virtual');
      }
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    } finally {
      setLoading(false);
    }
  };

  // Quick setup: creates everything in one click
  const handleQuickSetup = async () => {
    if (!user) return;
    if (!setupName.trim()) {
      toast.error('Digite o nome do agente');
      return;
    }
    if (!setupFunction.trim()) {
      toast.error('Descreva a função do agente');
      return;
    }
    if (!setupPhone.trim()) {
      toast.error('Digite o número do WhatsApp');
      return;
    }

    setSetupStep('activating');

    try {
      const now = new Date().toISOString();
      // Format phone: remove non-digits
      const cleanPhone = setupPhone.replace(/\D/g, '');
      // Use phone as instance name (simple auto-config)
      const instanceName = `agent-${cleanPhone}`;

      const personality = `Você é ${setupName}, ${setupFunction}. Seja sempre educado, profissional e objetivo nas respostas. Responda em português brasileiro.`;
      const welcomeMsg = `Olá! 👋 Eu sou ${setupName}, ${setupFunction.toLowerCase()}. Como posso ajudar você hoje?`;

      const payload = {
        user_id: user.id,
        agent_name: setupName.trim(),
        agent_personality: personality,
        welcome_message: welcomeMsg,
        is_whatsapp_enabled: true,
        evolution_instance_name: instanceName,
        working_hours_start: '08:00',
        working_hours_end: '18:00',
        work_on_weekends: false,
        auto_reply_outside_hours: true,
        outside_hours_message: `Olá! No momento estamos fora do horário de atendimento (seg-sex, 8h às 18h). Deixe sua mensagem que ${setupName} responderá assim que possível! 😊`,
        trial_started_at: now,
      };

      const { data, error } = await supabase
        .from('ai_agent_settings')
        .upsert(payload as any, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;

      setTrialStartedAt(now);
      setSettings({
        id: data.id,
        agent_name: data.agent_name,
        agent_personality: data.agent_personality,
        welcome_message: data.welcome_message,
        is_whatsapp_enabled: data.is_whatsapp_enabled ?? true,
        evolution_api_url: data.evolution_api_url,
        evolution_instance_name: data.evolution_instance_name,
        working_hours_start: data.working_hours_start,
        working_hours_end: data.working_hours_end,
        work_on_weekends: data.work_on_weekends ?? false,
        auto_reply_outside_hours: data.auto_reply_outside_hours ?? true,
        outside_hours_message: data.outside_hours_message,
      });
      setIsConfigured(true);
      setSetupStep('done');
      toast.success('🎉 Agente configurado com sucesso! Teste gratuito de 15 dias ativado!');
    } catch (err) {
      console.error('Erro ao configurar agente:', err);
      toast.error('Erro ao configurar o agente');
      setSetupStep('form');
    }
  };

  // Trial calculations
  const TRIAL_DAYS = 15;
  const trialEndDate = trialStartedAt ? new Date(new Date(trialStartedAt).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000) : null;
  const nowDate = new Date();
  const trialDaysRemaining = trialEndDate ? Math.max(0, Math.ceil((trialEndDate.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24))) : TRIAL_DAYS;
  const trialExpired = trialStartedAt ? trialDaysRemaining <= 0 : false;
  const trialActive = trialStartedAt ? !trialExpired : false;
  const trialPercentUsed = trialStartedAt ? Math.min(100, ((TRIAL_DAYS - trialDaysRemaining) / TRIAL_DAYS) * 100) : 0;
  const hasAccess = isPremium || trialActive;

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
    } catch {
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

  // Trial expired
  if (trialExpired && !isPremium) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Card className="border-2 border-destructive/30">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="relative mb-6">
              <Bot className="h-20 w-20 text-muted-foreground/50" />
              <XCircle className="h-8 w-8 text-destructive absolute -bottom-1 -right-1" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Período de Teste Encerrado</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Seu teste gratuito de 15 dias do Agente IA WhatsApp expirou.
              Assine o plano Premium para continuar usando.
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

  // Not configured yet — show simple setup wizard
  if (!isConfigured && !hasAccess) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-2xl">
        <Card className="border-2 border-primary/20 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-10 w-10 text-primary" />
                </div>
                <Sparkles className="h-6 w-6 text-primary absolute -top-1 -right-1" />
              </div>
            </div>
            <CardTitle className="text-2xl">Configure seu Agente IA em segundos</CardTitle>
            <CardDescription className="text-base mt-2">
              Preencha apenas 3 campos e seu assistente WhatsApp estará pronto para atender!
            </CardDescription>
            <Badge className="mx-auto mt-3 bg-primary/10 text-primary border-primary/20">
              <Timer className="h-3 w-3 mr-1" />
              15 dias grátis — sem cartão de crédito
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {setupStep === 'done' ? (
              <div className="text-center space-y-4 py-4">
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold">Agente Configurado! 🎉</h3>
                <p className="text-muted-foreground">
                  Seu agente <strong>{settings.agent_name}</strong> está pronto para atender via WhatsApp.
                </p>
                <Button onClick={() => setIsConfigured(true)} className="gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Ir para o Painel do Agente
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    Nome do Agente *
                  </Label>
                  <Input
                    value={setupName}
                    onChange={e => setSetupName(e.target.value)}
                    placeholder="Ex: Ana, Dra. Sofia, Assistente Lab..."
                    className="h-12 text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    O nome que os pacientes/clientes verão nas conversas
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Função do Agente *
                  </Label>
                  <Textarea
                    value={setupFunction}
                    onChange={e => setSetupFunction(e.target.value)}
                    placeholder="Ex: assistente de atendimento da clínica odontológica, responsável por agendar consultas e tirar dúvidas dos pacientes"
                    rows={3}
                    className="text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    Descreva o que o agente faz — isso define como ele responde automaticamente
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    Número do WhatsApp *
                  </Label>
                  <Input
                    value={setupPhone}
                    onChange={e => setSetupPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="h-12 text-base"
                    type="tel"
                  />
                  <p className="text-xs text-muted-foreground">
                    O número que receberá as mensagens dos pacientes
                  </p>
                </div>

                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">O que será configurado automaticamente:</p>
                      <ul className="text-muted-foreground mt-1 space-y-1">
                        <li>✅ Personalidade e instruções do agente IA</li>
                        <li>✅ Mensagem de boas-vindas personalizada</li>
                        <li>✅ Horário de atendimento (seg-sex, 8h-18h)</li>
                        <li>✅ Resposta automática fora do horário</li>
                        <li>✅ Integração WhatsApp ativada</li>
                        <li>✅ Webhook pronto para conectar ao n8n</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleQuickSetup}
                  disabled={setupStep === 'activating'}
                  size="lg"
                  className="w-full gap-2 h-12 text-base"
                >
                  {setupStep === 'activating' ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Configurando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      Ativar Agente — 15 Dias Grátis
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Você pode personalizar todas as configurações depois no painel avançado
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main dashboard (after configuration)
  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            Agente IA WhatsApp
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie seu agente de atendimento automático
          </p>
        </div>
        <Button onClick={saveSettings} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>

      {/* Trial Banner */}
      {trialActive && !isPremium && (
        <Alert className="border-primary/50 bg-primary/5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-primary" />
                <AlertDescription className="font-semibold">
                  Teste Gratuito — {trialDaysRemaining} {trialDaysRemaining === 1 ? 'dia restante' : 'dias restantes'}
                </AlertDescription>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Período de teste</span>
                  <span>{Math.round(trialPercentUsed)}% usado</span>
                </div>
                <Progress value={trialPercentUsed} className="h-2" />
              </div>
              <Button size="sm" onClick={() => navigate('/planos')} variant="outline" className="mt-1 gap-1">
                <Crown className="h-3 w-3" />
                Ver Planos
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {/* Status Card */}
      <Card className="bg-green-50/50 dark:bg-green-950/10 border-green-200/50">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-green-800 dark:text-green-200">
              Agente "{settings.agent_name}" ativo
            </p>
            <p className="text-sm text-green-600 dark:text-green-400">
              WhatsApp {settings.is_whatsapp_enabled ? 'habilitado' : 'desabilitado'} • Horário: {settings.working_hours_start || '08:00'} - {settings.working_hours_end || '18:00'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="agent" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="agent" className="gap-1.5 text-xs sm:text-sm">
            <Bot className="h-4 w-4" /> Agente
          </TabsTrigger>
          <TabsTrigger value="horario" className="gap-1.5 text-xs sm:text-sm">
            <Clock className="h-4 w-4" /> Horário
          </TabsTrigger>
          <TabsTrigger value="avancado" className="gap-1.5 text-xs sm:text-sm">
            <Settings2 className="h-4 w-4" /> Avançado
          </TabsTrigger>
        </TabsList>

        {/* Tab Agente */}
        <TabsContent value="agent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Identidade do Agente</CardTitle>
              <CardDescription>Personalize o nome e comportamento do seu assistente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Agente</Label>
                <Input
                  value={settings.agent_name}
                  onChange={e => setSettings(s => ({ ...s, agent_name: e.target.value }))}
                  placeholder="Ex: Ana, Dra. Sofia..."
                />
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
                  placeholder="Mensagem enviada ao iniciar conversa..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Horário */}
        <TabsContent value="horario" className="space-y-4">
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

        {/* Tab Avançado */}
        <TabsContent value="avancado" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conexão WhatsApp (Evolution API)
              </CardTitle>
              <CardDescription>
                Configurações avançadas da conexão com a Evolution API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">WhatsApp Ativo</Label>
                  <p className="text-xs text-muted-foreground">Habilitar/desabilitar atendimento</p>
                </div>
                <Switch
                  checked={settings.is_whatsapp_enabled}
                  onCheckedChange={v => setSettings(s => ({ ...s, is_whatsapp_enabled: v }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Número do WhatsApp</Label>
                <Input
                  value={settings.evolution_instance_name?.replace('agent-', '') || ''}
                  onChange={e => {
                    const clean = e.target.value.replace(/\D/g, '');
                    setSettings(s => ({ ...s, evolution_instance_name: `agent-${clean}` }));
                  }}
                  placeholder="(11) 99999-9999"
                  type="tel"
                />
                <p className="text-xs text-muted-foreground">
                  O número vinculado ao agente de atendimento
                </p>
              </div>

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
                  <CheckCircle2 className="h-3 w-3 mr-1" /> WhatsApp conectado
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Integração n8n
              </CardTitle>
              <CardDescription>
                Webhook para conectar ao seu fluxo de automação n8n
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border p-4 space-y-2">
                <h4 className="font-medium text-sm">📨 Payload esperado:</h4>
                <pre className="text-xs bg-muted rounded p-3 overflow-x-auto">
{`{
  "action": "process_message",
  "phone_number": "5511999999999",
  "message": "Olá, quero agendar...",
  "patient_name": "João Silva",
  "user_id": "${user?.id || 'seu-user-id'}"
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
                        O agente responde automaticamente. Se o paciente pedir para falar com humano,
                        o sistema retorna <code className="bg-amber-200/50 px-1 rounded">"requires_human": true</code>.
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
