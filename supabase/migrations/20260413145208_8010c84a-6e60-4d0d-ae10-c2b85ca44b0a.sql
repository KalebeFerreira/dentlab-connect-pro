
CREATE TABLE public.fiscal_summary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mes_referencia TEXT NOT NULL,
  faturamento_total NUMERIC NOT NULL DEFAULT 0,
  imposto_estimado NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, mes_referencia)
);

ALTER TABLE public.fiscal_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own fiscal summary" ON public.fiscal_summary FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own fiscal summary" ON public.fiscal_summary FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own fiscal summary" ON public.fiscal_summary FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own fiscal summary" ON public.fiscal_summary FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_fiscal_summary_updated_at BEFORE UPDATE ON public.fiscal_summary FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
