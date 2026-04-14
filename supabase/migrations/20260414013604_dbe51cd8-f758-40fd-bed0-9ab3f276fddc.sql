
ALTER TABLE public.ai_agent_settings
ADD COLUMN trial_started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Set trial_started_at for existing records that don't have it
UPDATE public.ai_agent_settings
SET trial_started_at = created_at
WHERE trial_started_at IS NULL;
