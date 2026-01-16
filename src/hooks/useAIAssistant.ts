import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isPlaying?: boolean;
}

export interface AIStats {
  orders: number;
  pendingOrders: number;
  patients: number;
  upcomingAppointments: number;
  revenue: number;
  expenses: number;
}

export const useAIAssistant = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [stats, setStats] = useState<AIStats | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentPlayingId = useRef<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão expirada');
      }

      // Preparar histórico de conversa (últimas 10 mensagens)
      const conversationHistory = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          message: content.trim(),
          conversationHistory,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao processar mensagem');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      if (data.stats) {
        setStats(data.stats);
      }

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      if (errorMessage.includes('Premium') || errorMessage.includes('Super Premium')) {
        toast.error('Este recurso é exclusivo para assinantes Premium');
      } else {
        toast.error(errorMessage);
      }

      // Adicionar mensagem de erro
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ ${errorMessage}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const speakMessage = useCallback(async (messageId: string, text: string) => {
    // Se já está tocando esta mensagem, pausar
    if (currentPlayingId.current === messageId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      currentPlayingId.current = null;
      setIsSpeaking(false);
      setMessages(prev => prev.map(m => ({ ...m, isPlaying: false })));
      return;
    }

    // Parar áudio anterior
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setIsSpeaking(true);
    currentPlayingId.current = messageId;
    setMessages(prev => prev.map(m => ({
      ...m,
      isPlaying: m.id === messageId,
    })));

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant-tts', {
        body: { text, voice: 'nova' },
      });

      if (error || !data?.audioContent) {
        throw new Error('Não foi possível gerar áudio');
      }

      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))],
        { type: 'audio/mp3' }
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => {
        setIsSpeaking(false);
        currentPlayingId.current = null;
        setMessages(prev => prev.map(m => ({ ...m, isPlaying: false })));
        URL.revokeObjectURL(audioUrl);
      };
      audioRef.current.onerror = () => {
        setIsSpeaking(false);
        currentPlayingId.current = null;
        setMessages(prev => prev.map(m => ({ ...m, isPlaying: false })));
        toast.error('Erro ao reproduzir áudio');
      };
      
      await audioRef.current.play();

    } catch (error) {
      console.error('Erro ao gerar áudio:', error);
      setIsSpeaking(false);
      currentPlayingId.current = null;
      setMessages(prev => prev.map(m => ({ ...m, isPlaying: false })));
      toast.error('Síntese de voz não disponível');
    }
  }, []);

  const clearMessages = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setMessages([]);
    setStats(null);
    currentPlayingId.current = null;
    setIsSpeaking(false);
  }, []);

  return {
    messages,
    isLoading,
    isSpeaking,
    stats,
    sendMessage,
    speakMessage,
    clearMessages,
  };
};
