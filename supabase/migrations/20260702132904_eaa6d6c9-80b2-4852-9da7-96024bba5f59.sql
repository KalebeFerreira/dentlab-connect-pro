UPDATE public.ai_agent_settings
SET evolution_instance_name = 'clinic-' || substr(replace(user_id::text, '-', ''), 1, 24)
WHERE is_whatsapp_enabled = true AND (evolution_instance_name IS NULL OR evolution_instance_name = '' OR evolution_instance_name = 'clinica');