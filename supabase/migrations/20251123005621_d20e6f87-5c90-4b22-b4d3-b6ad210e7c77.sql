-- Create dentists table for clinic management
CREATE TABLE public.dentists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  specialty TEXT,
  cro TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dentists ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own dentists"
ON public.dentists
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dentists"
ON public.dentists
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dentists"
ON public.dentists
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dentists"
ON public.dentists
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_dentists_updated_at
BEFORE UPDATE ON public.dentists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();