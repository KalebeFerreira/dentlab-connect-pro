-- Tabela de logs de webhooks do Mercado Pago para diagnóstico
CREATE TABLE IF NOT EXISTS public.mercadopago_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  payment_id text,
  event_type text,
  event_action text,
  payment_status text,
  signature_valid boolean,
  http_status integer,
  raw_body jsonb,
  raw_headers jsonb,
  payment_data jsonb,
  error_message text,
  processing_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mp_webhook_logs_created_at ON public.mercadopago_webhook_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mp_webhook_logs_user_id ON public.mercadopago_webhook_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_mp_webhook_logs_payment_id ON public.mercadopago_webhook_logs (payment_id);

ALTER TABLE public.mercadopago_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver TODOS os logs; usuários veem apenas os seus
CREATE POLICY "Admins can view all webhook logs"
  ON public.mercadopago_webhook_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own webhook logs"
  ON public.mercadopago_webhook_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Realtime
ALTER TABLE public.mercadopago_webhook_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mercadopago_webhook_logs;