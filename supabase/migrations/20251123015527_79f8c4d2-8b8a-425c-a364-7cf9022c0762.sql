-- Add dentist_id and dentist_payment columns to appointments table
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS dentist_id UUID REFERENCES public.dentists(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS dentist_payment NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS procedure_type TEXT;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_appointments_dentist_id ON public.appointments(dentist_id);

-- Update RLS policy to allow dentists to view their own appointments
CREATE POLICY "Dentists can view their own appointments"
  ON public.appointments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'dentist'
    )
    AND dentist_id IN (
      SELECT id FROM public.dentists WHERE user_id = auth.uid()
    )
  );

-- Add email and password support to dentists table for authentication
ALTER TABLE public.dentists
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS auth_enabled BOOLEAN DEFAULT false;

-- Create index for dentist user_id
CREATE INDEX IF NOT EXISTS idx_dentists_user_id ON public.dentists(user_id);