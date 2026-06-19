
DO $$ BEGIN
  CREATE TYPE public.client_payment_type AS ENUM ('a_vista', 'mensalista', 'nao_definido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.client_payment_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_name text NOT NULL,
  payment_type public.client_payment_type NOT NULL DEFAULT 'nao_definido',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, client_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_payment_profiles TO authenticated;
GRANT ALL ON public.client_payment_profiles TO service_role;

ALTER TABLE public.client_payment_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own client payment profiles"
  ON public.client_payment_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own client payment profiles"
  ON public.client_payment_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own client payment profiles"
  ON public.client_payment_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own client payment profiles"
  ON public.client_payment_profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_client_payment_profiles_updated_at
  BEFORE UPDATE ON public.client_payment_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
