-- Criar tabela para rastrear uso de geração de imagens
CREATE TABLE public.image_generation_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, month, year)
);

-- Habilitar RLS
ALTER TABLE public.image_generation_usage ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own usage"
  ON public.image_generation_usage
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage"
  ON public.image_generation_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage"
  ON public.image_generation_usage
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_image_generation_usage_updated_at
  BEFORE UPDATE ON public.image_generation_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para incrementar contador de uso
CREATE OR REPLACE FUNCTION public.increment_image_usage(p_user_id UUID)
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
  
  INSERT INTO public.image_generation_usage (user_id, month, year, count)
  VALUES (p_user_id, v_month, v_year, 1)
  ON CONFLICT (user_id, month, year)
  DO UPDATE SET 
    count = image_generation_usage.count + 1,
    updated_at = now()
  RETURNING count INTO v_count;
  
  RETURN v_count;
END;
$$;

-- Função para obter uso atual do mês
CREATE OR REPLACE FUNCTION public.get_monthly_image_usage(p_user_id UUID)
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
  FROM public.image_generation_usage
  WHERE user_id = p_user_id
    AND month = v_month
    AND year = v_year;
  
  RETURN COALESCE(v_count, 0);
END;
$$;