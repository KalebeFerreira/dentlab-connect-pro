import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircleQuestion, X, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

const getWelcomeMessage = (): ChatMessage => ({
  id: 'welcome',
  role: 'assistant',
  content: `👋 ${getGreeting()}! Sou o atendente de suporte do DentLab Connect. Estou aqui pra te ajudar com qualquer dúvida sobre o sistema. É só perguntar! 😊`,
});

// Typing indicator component
const TypingIndicator = () => (
  <div className="flex justify-start">
    <div className="bg-muted rounded-xl px-4 py-3 rounded-bl-sm flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">Digitando</span>
      <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:300ms]" />
    </div>
  </div>
);

export const SupportChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([getWelcomeMessage()]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      const history = messages.filter(m => m.id !== 'welcome').map(m => ({ role: m.role, content: m.content }));

      // Fetch response and enforce minimum "typing" delay in parallel
      const [result] = await Promise.all([
        supabase.functions.invoke('support-chat', {
          body: { message: text, conversationHistory: history },
        }),
        new Promise(resolve => setTimeout(resolve, 1500)), // min 1.5s typing
      ]);

      const { data, error } = result;
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setIsTyping(false);

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
      }]);
    } catch (err) {
      setIsTyping(false);
      const msg = err instanceof Error ? err.message : 'Erro ao processar';
      toast.error(msg);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '😔 Desculpe, tive um probleminha aqui. Pode tentar de novo, por favor?',
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([getWelcomeMessage()]);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-[9999] bg-primary text-primary-foreground rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
        aria-label="Abrir suporte"
      >
        <MessageCircleQuestion className="w-7 h-7" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-[9999] w-[360px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-2rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="relative">
            <MessageCircleQuestion className="w-5 h-5" />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-primary" />
          </div>
          <div>
            <span className="font-semibold text-sm block leading-tight">Suporte DentLab</span>
            <span className="text-[10px] opacity-80">Online agora</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clearChat} className="p-1.5 rounded-full hover:bg-primary-foreground/20 transition-colors" title="Limpar conversa">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-full hover:bg-primary-foreground/20 transition-colors" title="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-muted text-foreground rounded-bl-sm'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:my-1 [&>ol]:my-1">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap m-0">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua dúvida..."
            rows={1}
            className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-20"
            disabled={isLoading}
          />
          <Button size="icon" onClick={sendMessage} disabled={!input.trim() || isLoading} className="shrink-0 rounded-lg h-9 w-9">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
