-- Create laboratory_info table for storing lab information
CREATE TABLE IF NOT EXISTS public.laboratory_info (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  lab_name text NOT NULL,
  whatsapp text NOT NULL,
  email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.laboratory_info ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own lab info"
  ON public.laboratory_info
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lab info"
  ON public.laboratory_info
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lab info"
  ON public.laboratory_info
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lab info"
  ON public.laboratory_info
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updating updated_at
CREATE TRIGGER update_laboratory_info_updated_at
  BEFORE UPDATE ON public.laboratory_info
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();