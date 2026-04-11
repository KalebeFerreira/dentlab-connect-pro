
CREATE TABLE public.invoice_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, month, year)
);

ALTER TABLE public.invoice_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invoice usage"
  ON public.invoice_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own invoice usage"
  ON public.invoice_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoice usage"
  ON public.invoice_usage FOR UPDATE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_monthly_invoice_usage(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT count INTO v_count FROM public.invoice_usage
  WHERE user_id = p_user_id
    AND month = EXTRACT(MONTH FROM CURRENT_DATE)
    AND year = EXTRACT(YEAR FROM CURRENT_DATE);
  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_invoice_usage(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month INTEGER := EXTRACT(MONTH FROM CURRENT_DATE);
  v_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_count INTEGER;
BEGIN
  INSERT INTO public.invoice_usage (user_id, month, year, count)
  VALUES (p_user_id, v_month, v_year, 1)
  ON CONFLICT (user_id, month, year)
  DO UPDATE SET count = invoice_usage.count + 1, updated_at = now()
  RETURNING count INTO v_count;
  RETURN v_count;
END;
$$;
