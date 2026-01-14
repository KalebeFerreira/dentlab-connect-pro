-- Create table for order message history
CREATE TABLE public.order_message_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('whatsapp', 'email')),
  recipient TEXT,
  message_content TEXT NOT NULL,
  subject TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_message_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own order messages"
ON public.order_message_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own order messages"
ON public.order_message_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own order messages"
ON public.order_message_history
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_order_message_history_order_id ON public.order_message_history(order_id);
CREATE INDEX idx_order_message_history_user_id ON public.order_message_history(user_id);