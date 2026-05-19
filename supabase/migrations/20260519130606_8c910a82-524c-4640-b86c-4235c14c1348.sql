
CREATE TABLE public.stripe_event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  livemode boolean NOT NULL DEFAULT false,
  api_version text,
  payload jsonb,
  error text,
  processed_at timestamptz,
  stripe_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stripe_event_logs_created ON public.stripe_event_logs (stripe_created_at DESC);
CREATE INDEX idx_stripe_event_logs_type ON public.stripe_event_logs (type);
CREATE INDEX idx_stripe_event_logs_status ON public.stripe_event_logs (status);

ALTER TABLE public.stripe_event_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view stripe event logs"
  ON public.stripe_event_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_stripe_event_logs_updated_at
  BEFORE UPDATE ON public.stripe_event_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
