-- Criar tabela para histórico de envios de relatórios
CREATE TABLE public.report_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  month TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  recipient TEXT NOT NULL,
  total_value NUMERIC NOT NULL,
  services_count INTEGER NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.report_history ENABLE ROW LEVEL SECURITY;

-- Política para usuários visualizarem seu próprio histórico
CREATE POLICY "Users can view their own report history"
  ON public.report_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política para usuários criarem seu próprio histórico
CREATE POLICY "Users can insert their own report history"
  ON public.report_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política para usuários deletarem seu próprio histórico
CREATE POLICY "Users can delete their own report history"
  ON public.report_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- Criar índice para melhorar performance
CREATE INDEX idx_report_history_user_id ON public.report_history(user_id);
CREATE INDEX idx_report_history_sent_at ON public.report_history(sent_at DESC);