-- Create table to track PDF generation usage
CREATE TABLE IF NOT EXISTS public.pdf_generation_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month, year)
);

-- Enable RLS
ALTER TABLE public.pdf_generation_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own PDF usage"
  ON public.pdf_generation_usage
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own PDF usage"
  ON public.pdf_generation_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own PDF usage"
  ON public.pdf_generation_usage
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create function to increment PDF usage
CREATE OR REPLACE FUNCTION public.increment_pdf_usage(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month INTEGER;
  v_year INTEGER;
  v_count INTEGER;
BEGIN
  v_month := EXTRACT(MONTH FROM CURRENT_DATE);
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  INSERT INTO public.pdf_generation_usage (user_id, month, year, count)
  VALUES (p_user_id, v_month, v_year, 1)
  ON CONFLICT (user_id, month, year)
  DO UPDATE SET 
    count = pdf_generation_usage.count + 1,
    updated_at = now()
  RETURNING count INTO v_count;
  
  RETURN v_count;
END;
$$;

-- Create function to get monthly PDF usage
CREATE OR REPLACE FUNCTION public.get_monthly_pdf_usage(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month INTEGER;
  v_year INTEGER;
  v_count INTEGER;
BEGIN
  v_month := EXTRACT(MONTH FROM CURRENT_DATE);
  v_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  SELECT count INTO v_count
  FROM public.pdf_generation_usage
  WHERE user_id = p_user_id
    AND month = v_month
    AND year = v_year;
  
  RETURN COALESCE(v_count, 0);
END;
$$;