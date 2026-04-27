
CREATE TABLE public.pix_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_key TEXT NOT NULL,
  price_id TEXT NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  original_amount NUMERIC(10,2) NOT NULL,
  discounted_amount NUMERIC(10,2) NOT NULL,
  mercadopago_payment_id TEXT UNIQUE,
  qr_code TEXT,
  qr_code_base64 TEXT,
  ticket_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  subscription_start TIMESTAMP WITH TIME ZONE,
  subscription_end TIMESTAMP WITH TIME ZONE,
  payer_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pix_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pix payments"
ON public.pix_payments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pix payments"
ON public.pix_payments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_pix_payments_user_id ON public.pix_payments(user_id);
CREATE INDEX idx_pix_payments_mp_id ON public.pix_payments(mercadopago_payment_id);
CREATE INDEX idx_pix_payments_status ON public.pix_payments(status);

CREATE TRIGGER update_pix_payments_updated_at
BEFORE UPDATE ON public.pix_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
