import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  MessageSquare, Send, Loader2, User, Bot, ArrowLeft,
  AlertTriangle, Phone, Clock
} from 'lucide-react';

interface Conversation {
  id: string;
  phone_number: string;
  patient_name: string | null;
  last_message_at: string;
  is_active: boolean;
  requires_human?: boolean;
  whatsapp_messages?: {
    content: string;
    direction: string;
    is_from_ai: boolean;
    created_at: string;
  }[];
}

interface Message {
  id: string;
  content: string;
  direction: string;
  is_from_ai: boolean | null;
  created_at: string;
  message_type: string;
}

export default function WhatsAppInbox() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('n8n-whatsapp-webhook', {
        body: { action: 'get_conversations' },
      });
      if (error) throw error;
      setConversations(data?.conversations || []);
    } catch (err) {
      console.error('Erro ao carregar conversas:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conv: Conversation) => {
    setSelectedConv(conv);
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase.functions.invoke('n8n-whatsapp-webhook', {
        body: { action: 'get_messages', conversation_id: conv.id },
      });
      if (error) throw error;
      setMessages(data?.messages || []);
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendManualMessage = async () => {
    if (!newMessage.trim() || !selectedConv) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('n8n-whatsapp-webhook', {
        body: {
          action: 'send_manual_message',
          conversation_id: selectedConv.id,
          phone_number: selectedConv.phone_number,
          message: newMessage.trim(),
        },
      });
      if (error) throw error;

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        content: newMessage.trim(),
        direction: 'outbound',
        is_from_ai: false,
        created_at: new Date().toISOString(),
        message_type: 'text',
      }]);
      setNewMessage('');

      if (data?.whatsapp_sent) {
        toast.success('Mensagem enviada via WhatsApp!');
      } else {
        toast.info('Mensagem salva (WhatsApp não configurado para envio)');
      }
    } catch (err) {
      console.error('Erro ao enviar:', err);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const getLastMessage = (conv: Conversation) => {
    const msgs = conv.whatsapp_messages;
    if (!msgs || msgs.length === 0) return 'Sem mensagens';
    const last = msgs[msgs.length - 1];
    return last.content.substring(0, 50) + (last.content.length > 50 ? '...' : '');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium mb-1">Nenhuma conversa ainda</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            As conversas aparecerão aqui quando pacientes enviarem mensagens pelo WhatsApp.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Message view
  if (selectedConv) {
    return (
      <Card className="flex flex-col h-[600px]">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedConv(null); setMessages([]); }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <CardTitle className="text-base flex items-center gap-2">
                {selectedConv.patient_name || selectedConv.phone_number}
                {(selectedConv as any).requires_human && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Aguardando humano
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {selectedConv.phone_number}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <ScrollArea className="flex-1 p-4">
            {loadingMessages ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        msg.direction === 'outbound'
                          ? msg.is_from_ai
                            ? 'bg-primary/10 text-foreground border border-primary/20'
                            : 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {msg.direction === 'outbound' && (
                        <div className="flex items-center gap-1 mb-1">
                          {msg.is_from_ai ? (
                            <Bot className="h-3 w-3 text-primary" />
                          ) : (
                            <User className="h-3 w-3" />
                          )}
                          <span className="text-[10px] opacity-70">
                            {msg.is_from_ai ? 'IA' : 'Você'}
                          </span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${msg.direction === 'outbound' && !msg.is_from_ai ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
          <div className="border-t p-3 flex gap-2">
            <Input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendManualMessage()}
            />
            <Button onClick={sendManualMessage} disabled={sending || !newMessage.trim()} size="icon">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Conversation list
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Conversas ({conversations.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => loadMessages(conv)}
              className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors border-b text-left"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm truncate">
                    {conv.patient_name || conv.phone_number}
                  </p>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                    {formatDate(conv.last_message_at)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{getLastMessage(conv)}</p>
                {(conv as any).requires_human && (
                  <Badge variant="destructive" className="text-[10px] mt-1 gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Precisa de atenção
                  </Badge>
                )}
              </div>
            </button>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
