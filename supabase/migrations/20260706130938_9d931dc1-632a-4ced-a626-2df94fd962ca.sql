CREATE UNIQUE INDEX IF NOT EXISTS ai_agent_settings_evolution_instance_name_unique
  ON public.ai_agent_settings (evolution_instance_name)
  WHERE evolution_instance_name IS NOT NULL;