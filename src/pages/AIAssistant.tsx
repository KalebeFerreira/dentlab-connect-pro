import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAIAssistant } from '@/hooks/useAIAssistant';
import { useSubscription } from '@/hooks/useSubscription';
import { 
  Bot, 
  Send, 
  Loader2, 
  Volume2, 
  VolumeX, 
  Trash2, 
  Sparkles,
  TrendingUp,
  Users,
  FileText,
  Calendar,
  DollarSign,
  Crown,
  Mic,
  MicOff,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

// Tipos para Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInterface extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInterface;
    webkitSpeechRecognition?: new () => SpeechRecognitionInterface;
  }
}

const quickActions = [
  { label: '📊 Resumo do meu negócio', prompt: 'Me dê um resumo completo do meu laboratório: pedidos, finanças e próximos compromissos' },
  { label: '💰 Análise financeira', prompt: 'Analise minhas finanças e me dê sugestões de melhoria' },
  { label: '📋 Pedidos pendentes', prompt: 'Quais são meus pedidos pendentes e prioridades?' },
  { label: '🦷 Tipos de próteses', prompt: 'Quais são os principais tipos de próteses dentárias e suas indicações?' },
  { label: '📈 Dicas de crescimento', prompt: 'Me dê 5 dicas para aumentar a produtividade do meu laboratório' },
  { label: '❓ Como usar o sistema', prompt: 'Me explique as principais funcionalidades do DentLab Connect' },
];

export default function AIAssistant() {
  const { messages, isLoading, isSpeaking, stats, sendMessage, speakMessage, clearMessages } = useAIAssistant();
  const { currentPlan, loading: subscriptionLoading } = useSubscription();
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInterface | null>(null);
  const navigate = useNavigate();

  // Verificar se usuário tem acesso (premium ou super_premium)
  const hasAccess = currentPlan?.key === 'premium' || currentPlan?.key === 'super_premium';

  // Scroll para última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Inicializar reconhecimento de voz
  useEffect(() => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionClass) {
      recognitionRef.current = new SpeechRecognitionClass();
      recognitionRef.current.lang = 'pt-BR';
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(prev => prev + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const message = inputValue;
    setInputValue('');
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleQuickAction = (prompt: string) => {
    setInputValue(prompt);
    textareaRef.current?.focus();
  };

  if (subscriptionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Tela de bloqueio para não-premium
  if (!hasAccess) {
    return (
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Card className="border-2 border-dashed border-muted">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="relative mb-6">
              <Bot className="h-20 w-20 text-muted-foreground/50" />
              <Lock className="h-8 w-8 text-primary absolute -bottom-1 -right-1" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Assistente IA Premium</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Este recurso exclusivo está disponível apenas para assinantes do plano Premium.
              Tenha acesso a um assistente inteligente que ajuda com análises, suporte e dúvidas técnicas.
            </p>
            <div className="flex flex-wrap gap-3 justify-center mb-6">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" /> Chat por texto e voz
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <TrendingUp className="h-3 w-3" /> Análise de dados
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Bot className="h-3 w-3" /> Suporte ao sistema
              </Badge>
            </div>
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
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar com estatísticas */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Assistente IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Seu assistente pessoal para análises, suporte e dúvidas técnicas.
              </p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs">Chat</Badge>
                <Badge variant="outline" className="text-xs">Voz</Badge>
                <Badge variant="outline" className="text-xs">Análises</Badge>
              </div>
            </CardContent>
          </Card>

          {stats && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Seus Dados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <FileText className="h-3 w-3" /> Pedidos
                  </span>
                  <span className="font-medium">{stats.orders}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" /> Pacientes
                  </span>
                  <span className="font-medium">{stats.patients}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" /> Agendamentos
                  </span>
                  <span className="font-medium">{stats.upcomingAppointments}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <DollarSign className="h-3 w-3" /> Receita
                  </span>
                  <span className="font-medium text-green-600">
                    R$ {stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-auto py-2 px-2"
                  onClick={() => handleQuickAction(action.prompt)}
                >
                  {action.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Chat principal */}
        <Card className="lg:col-span-3 flex flex-col h-[calc(100vh-12rem)]">
          <CardHeader className="pb-2 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Chat com Assistente
              </CardTitle>
              {messages.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearMessages}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>

          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Bot className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium mb-2">Olá! Como posso ajudar?</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Sou seu assistente IA. Posso ajudar com análises do seu negócio, 
                  dúvidas sobre o sistema ou questões técnicas sobre odontologia.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-3',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[80%] rounded-lg px-4 py-3',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      {message.role === 'assistant' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-6 px-2 text-xs"
                          onClick={() => speakMessage(message.id, message.content)}
                        >
                          {message.isPlaying ? (
                            <>
                              <VolumeX className="h-3 w-3 mr-1" /> Parar
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3 w-3 mr-1" /> Ouvir
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t flex-shrink-0">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleListening}
                disabled={!recognitionRef.current}
                className={cn(isListening && 'bg-red-100 border-red-300')}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4 text-red-500" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem..."
                className="min-h-[44px] max-h-32 resize-none"
                rows={1}
              />
              <Button onClick={handleSend} disabled={isLoading || !inputValue.trim()}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            {isListening && (
              <p className="text-xs text-center text-red-500 mt-2 animate-pulse">
                🎤 Ouvindo... Fale agora
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
