
-- Create scanner usage tracking table
CREATE TABLE public.scanner_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month, year)
);

ALTER TABLE public.scanner_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scanner usage" ON public.scanner_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scanner usage" ON public.scanner_usage FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scanner usage" ON public.scanner_usage FOR UPDATE USING (auth.uid() = user_id);

-- Function to increment scanner usage
CREATE OR REPLACE FUNCTION public.increment_scanner_usage(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month INT := EXTRACT(MONTH FROM now());
  current_year INT := EXTRACT(YEAR FROM now());
  new_count INT;
BEGIN
  INSERT INTO public.scanner_usage (user_id, month, year, count)
  VALUES (p_user_id, current_month, current_year, 1)
  ON CONFLICT (user_id, month, year)
  DO UPDATE SET count = scanner_usage.count + 1, updated_at = now();
  
  SELECT count INTO new_count FROM public.scanner_usage
  WHERE user_id = p_user_id AND month = current_month AND year = current_year;
  
  RETURN new_count;
END;
$$;

-- Function to get monthly scanner usage
CREATE OR REPLACE FUNCTION public.get_monthly_scanner_usage(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  usage_count INT;
BEGIN
  SELECT count INTO usage_count FROM public.scanner_usage
  WHERE user_id = p_user_id AND month = EXTRACT(MONTH FROM now()) AND year = EXTRACT(YEAR FROM now());
  RETURN COALESCE(usage_count, 0);
END;
$$;
