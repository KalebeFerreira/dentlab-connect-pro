import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircleQuestion, X, Send, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '👋 Olá! Sou o atendente de suporte do DentLab Connect. Pergunte qualquer coisa sobre o sistema que eu te ajudo!',
};

export const SupportChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    try {
      const history = messages.filter(m => m.id !== 'welcome').map(m => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke('support-chat', {
        body: { message: text, conversationHistory: history },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
      }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar';
      toast.error(msg);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '❌ Desculpe, não consegui responder agora. Tente novamente.',
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
    setMessages([WELCOME_MESSAGE]);
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
          <MessageCircleQuestion className="w-5 h-5" />
          <span className="font-semibold text-sm">Suporte DentLab</span>
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
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl px-3 py-2 rounded-bl-sm">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
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
