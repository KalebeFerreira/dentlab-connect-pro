ALTER TABLE public.ai_agent_settings
  ADD COLUMN IF NOT EXISTS connection_status text NOT NULL DEFAULT 'disconnected',
  ADD COLUMN IF NOT EXISTS webhook_url text,
  ADD COLUMN IF NOT EXISTS connected_at timestamptz;