
-- ============================================================
-- FASE 3: agents + whatsapp_instances (aditivo, sem quebrar)
-- ============================================================

-- 1) Tabela agents
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Assistente Virtual',
  system_prompt TEXT,
  personality TEXT,
  welcome_message TEXT,
  outside_hours_message TEXT,
  working_hours_start TIME,
  working_hours_end TIME,
  work_on_weekends BOOLEAN NOT NULL DEFAULT false,
  auto_reply_outside_hours BOOLEAN NOT NULL DEFAULT true,
  handoff_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  legacy_ai_agent_settings_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agents_clinic_id_idx ON public.agents(clinic_id);
CREATE UNIQUE INDEX IF NOT EXISTS agents_legacy_id_unique
  ON public.agents(legacy_ai_agent_settings_id) WHERE legacy_ai_agent_settings_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO authenticated;
GRANT ALL ON public.agents TO service_role;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic members manage agents" ON public.agents;
CREATE POLICY "Clinic members manage agents" ON public.agents
  FOR ALL TO authenticated
  USING (public.has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));

DROP TRIGGER IF EXISTS update_agents_updated_at ON public.agents;
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Tabela whatsapp_instances
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  evolution_instance_name TEXT NOT NULL,
  evolution_api_url TEXT,
  webhook_url TEXT,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  connected_at TIMESTAMPTZ,
  trial_started_at TIMESTAMPTZ,
  legacy_ai_agent_settings_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_instances_evolution_instance_name_unique
  ON public.whatsapp_instances(evolution_instance_name);
CREATE INDEX IF NOT EXISTS whatsapp_instances_clinic_id_idx ON public.whatsapp_instances(clinic_id);
CREATE INDEX IF NOT EXISTS whatsapp_instances_agent_id_idx ON public.whatsapp_instances(agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_instances_legacy_id_unique
  ON public.whatsapp_instances(legacy_ai_agent_settings_id) WHERE legacy_ai_agent_settings_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_instances TO authenticated;
GRANT ALL ON public.whatsapp_instances TO service_role;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic members manage instances" ON public.whatsapp_instances;
CREATE POLICY "Clinic members manage instances" ON public.whatsapp_instances
  FOR ALL TO authenticated
  USING (public.has_clinic_access(auth.uid(), clinic_id))
  WITH CHECK (public.has_clinic_access(auth.uid(), clinic_id));

DROP TRIGGER IF EXISTS update_whatsapp_instances_updated_at ON public.whatsapp_instances;
CREATE TRIGGER update_whatsapp_instances_updated_at BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Backfill: 1 agent + 1 whatsapp_instance por ai_agent_settings existente
INSERT INTO public.agents (
  clinic_id, name, system_prompt, personality, welcome_message, outside_hours_message,
  working_hours_start, working_hours_end, work_on_weekends, auto_reply_outside_hours,
  is_whatsapp_enabled, legacy_ai_agent_settings_id
)
SELECT
  s.clinic_id,
  COALESCE(NULLIF(s.agent_name, ''), 'Assistente Virtual'),
  NULL,
  s.agent_personality,
  s.welcome_message,
  s.outside_hours_message,
  s.working_hours_start,
  s.working_hours_end,
  COALESCE(s.work_on_weekends, false),
  COALESCE(s.auto_reply_outside_hours, true),
  COALESCE(s.is_whatsapp_enabled, false),
  s.id
FROM public.ai_agent_settings s
WHERE s.clinic_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.agents a WHERE a.legacy_ai_agent_settings_id = s.id);

INSERT INTO public.whatsapp_instances (
  clinic_id, agent_id, evolution_instance_name, evolution_api_url, webhook_url,
  phone_number, status, connected_at, trial_started_at, legacy_ai_agent_settings_id
)
SELECT
  s.clinic_id,
  a.id,
  s.evolution_instance_name,
  s.evolution_api_url,
  s.webhook_url,
  s.whatsapp_number,
  COALESCE(s.connection_status, 'disconnected'),
  s.connected_at,
  s.trial_started_at,
  s.id
FROM public.ai_agent_settings s
JOIN public.agents a ON a.legacy_ai_agent_settings_id = s.id
WHERE s.evolution_instance_name IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.whatsapp_instances wi WHERE wi.legacy_ai_agent_settings_id = s.id);

-- 4) Adiciona agent_id/instance_id em conversas e mensagens
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS whatsapp_conversations_agent_id_idx    ON public.whatsapp_conversations(agent_id);
CREATE INDEX IF NOT EXISTS whatsapp_conversations_instance_id_idx ON public.whatsapp_conversations(instance_id);
CREATE INDEX IF NOT EXISTS whatsapp_messages_agent_id_idx         ON public.whatsapp_messages(agent_id);
CREATE INDEX IF NOT EXISTS whatsapp_messages_instance_id_idx      ON public.whatsapp_messages(instance_id);

-- 5) Backfill vinculo conversa/mensagem → instance/agent (via clinic_id + primeira instância da clínica)
UPDATE public.whatsapp_conversations wc
  SET instance_id = wi.id, agent_id = wi.agent_id
  FROM public.whatsapp_instances wi
  WHERE wc.instance_id IS NULL AND wc.clinic_id = wi.clinic_id;

UPDATE public.whatsapp_messages wm
  SET instance_id = wc.instance_id, agent_id = wc.agent_id
  FROM public.whatsapp_conversations wc
  WHERE wm.instance_id IS NULL AND wm.conversation_id = wc.id;

-- 6) Sync bidirecional: ai_agent_settings → agents + whatsapp_instances
CREATE OR REPLACE FUNCTION public.sync_ai_agent_settings_to_new_tables()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_agent_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.whatsapp_instances WHERE legacy_ai_agent_settings_id = OLD.id;
    DELETE FROM public.agents WHERE legacy_ai_agent_settings_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.clinic_id IS NULL THEN
    SELECT id INTO NEW.clinic_id
      FROM public.clinics WHERE owner_user_id = NEW.user_id
      ORDER BY created_at ASC LIMIT 1;
  END IF;

  -- Upsert agent
  SELECT id INTO v_agent_id FROM public.agents WHERE legacy_ai_agent_settings_id = NEW.id;
  IF v_agent_id IS NULL THEN
    INSERT INTO public.agents (
      clinic_id, name, personality, welcome_message, outside_hours_message,
      working_hours_start, working_hours_end, work_on_weekends, auto_reply_outside_hours,
      is_whatsapp_enabled, legacy_ai_agent_settings_id
    ) VALUES (
      NEW.clinic_id,
      COALESCE(NULLIF(NEW.agent_name, ''), 'Assistente Virtual'),
      NEW.agent_personality, NEW.welcome_message, NEW.outside_hours_message,
      NEW.working_hours_start, NEW.working_hours_end,
      COALESCE(NEW.work_on_weekends, false),
      COALESCE(NEW.auto_reply_outside_hours, true),
      COALESCE(NEW.is_whatsapp_enabled, false),
      NEW.id
    ) RETURNING id INTO v_agent_id;
  ELSE
    UPDATE public.agents SET
      clinic_id = NEW.clinic_id,
      name = COALESCE(NULLIF(NEW.agent_name, ''), name),
      personality = NEW.agent_personality,
      welcome_message = NEW.welcome_message,
      outside_hours_message = NEW.outside_hours_message,
      working_hours_start = NEW.working_hours_start,
      working_hours_end = NEW.working_hours_end,
      work_on_weekends = COALESCE(NEW.work_on_weekends, false),
      auto_reply_outside_hours = COALESCE(NEW.auto_reply_outside_hours, true),
      is_whatsapp_enabled = COALESCE(NEW.is_whatsapp_enabled, false),
      updated_at = now()
    WHERE id = v_agent_id;
  END IF;

  -- Upsert whatsapp_instance (só se houver instance_name)
  IF NEW.evolution_instance_name IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.whatsapp_instances WHERE legacy_ai_agent_settings_id = NEW.id) THEN
      UPDATE public.whatsapp_instances SET
        clinic_id = NEW.clinic_id,
        agent_id = v_agent_id,
        evolution_instance_name = NEW.evolution_instance_name,
        evolution_api_url = NEW.evolution_api_url,
        webhook_url = NEW.webhook_url,
        phone_number = NEW.whatsapp_number,
        status = COALESCE(NEW.connection_status, 'disconnected'),
        connected_at = NEW.connected_at,
        trial_started_at = NEW.trial_started_at,
        updated_at = now()
      WHERE legacy_ai_agent_settings_id = NEW.id;
    ELSE
      INSERT INTO public.whatsapp_instances (
        clinic_id, agent_id, evolution_instance_name, evolution_api_url, webhook_url,
        phone_number, status, connected_at, trial_started_at, legacy_ai_agent_settings_id
      ) VALUES (
        NEW.clinic_id, v_agent_id, NEW.evolution_instance_name, NEW.evolution_api_url, NEW.webhook_url,
        NEW.whatsapp_number, COALESCE(NEW.connection_status, 'disconnected'),
        NEW.connected_at, NEW.trial_started_at, NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_ai_agent_settings_to_new_tables_iu ON public.ai_agent_settings;
CREATE TRIGGER sync_ai_agent_settings_to_new_tables_iu
  BEFORE INSERT OR UPDATE ON public.ai_agent_settings
  FOR EACH ROW EXECUTE FUNCTION public.sync_ai_agent_settings_to_new_tables();

DROP TRIGGER IF EXISTS sync_ai_agent_settings_to_new_tables_d ON public.ai_agent_settings;
CREATE TRIGGER sync_ai_agent_settings_to_new_tables_d
  AFTER DELETE ON public.ai_agent_settings
  FOR EACH ROW EXECUTE FUNCTION public.sync_ai_agent_settings_to_new_tables();
