-- Create message_history table
CREATE TABLE public.message_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  message_type TEXT NOT NULL,
  message_content TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own message history"
ON public.message_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own message history"
ON public.message_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own message history"
ON public.message_history
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_message_history_patient_id ON public.message_history(patient_id);
CREATE INDEX idx_message_history_appointment_id ON public.message_history(appointment_id);
CREATE INDEX idx_message_history_sent_at ON public.message_history(sent_at DESC);