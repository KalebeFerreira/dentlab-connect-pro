-- Tabela para configurações do agente IA
CREATE TABLE public.ai_agent_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_name TEXT NOT NULL DEFAULT 'Assistente Virtual',
  agent_personality TEXT DEFAULT 'Sou um assistente virtual amigável e profissional, especializado em atendimento odontológico.',
  evolution_instance_name TEXT,
  evolution_api_url TEXT,
  is_whatsapp_enabled BOOLEAN DEFAULT false,
  welcome_message TEXT DEFAULT 'Olá! 👋 Sou o assistente virtual da clínica. Como posso ajudar você hoje?',
  working_hours_start TIME DEFAULT '08:00:00',
  working_hours_end TIME DEFAULT '18:00:00',
  work_on_weekends BOOLEAN DEFAULT false,
  auto_reply_outside_hours BOOLEAN DEFAULT true,
  outside_hours_message TEXT DEFAULT 'Olá! Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Deixe sua mensagem que responderemos assim que possível.',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- Tabela para histórico de conversas WhatsApp
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  patient_name TEXT,
  patient_id UUID REFERENCES public.patients(id),
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para mensagens do WhatsApp
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'document')),
  content TEXT NOT NULL,
  is_from_ai BOOLEAN DEFAULT false,
  evolution_message_id TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies para ai_agent_settings
CREATE POLICY "Users can view their own agent settings"
  ON public.ai_agent_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own agent settings"
  ON public.ai_agent_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agent settings"
  ON public.ai_agent_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies para whatsapp_conversations
CREATE POLICY "Users can view their own conversations"
  ON public.whatsapp_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create conversations"
  ON public.whatsapp_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON public.whatsapp_conversations FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies para whatsapp_messages
CREATE POLICY "Users can view their own messages"
  ON public.whatsapp_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create messages"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Triggers para updated_at
CREATE TRIGGER update_ai_agent_settings_updated_at
  BEFORE UPDATE ON public.ai_agent_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_whatsapp_conversations_user_phone ON public.whatsapp_conversations(user_id, phone_number);
CREATE INDEX idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_messages_created_at ON public.whatsapp_messages(created_at DESC);