
-- ============================================================
-- FASE 2: Introduzir entidade `clinics` sem quebrar nada
-- ============================================================

-- 1) Enum de papéis
DO $$ BEGIN
  CREATE TYPE public.clinic_member_role AS ENUM ('owner','admin','reception','dentist');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Tabela clinics
CREATE TABLE IF NOT EXISTS public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS clinics_owner_user_id_idx ON public.clinics(owner_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinics TO authenticated;
GRANT ALL ON public.clinics TO service_role;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

-- 3) Tabela clinic_members
CREATE TABLE IF NOT EXISTS public.clinic_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.clinic_member_role NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, user_id)
);
CREATE INDEX IF NOT EXISTS clinic_members_user_id_idx ON public.clinic_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_members TO authenticated;
GRANT ALL ON public.clinic_members TO service_role;
ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;

-- 4) Helpers SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.has_clinic_access(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE user_id = _user_id AND clinic_id = _clinic_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_default_clinic(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.clinics WHERE owner_user_id = _user_id
  ORDER BY created_at ASC LIMIT 1;
$$;

-- 5) Policies em clinics
DROP POLICY IF EXISTS "Members can view their clinic" ON public.clinics;
CREATE POLICY "Members can view their clinic" ON public.clinics
  FOR SELECT TO authenticated
  USING (public.has_clinic_access(auth.uid(), id) OR owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own clinic" ON public.clinics;
CREATE POLICY "Users can create own clinic" ON public.clinics
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Owner can update clinic" ON public.clinics;
CREATE POLICY "Owner can update clinic" ON public.clinics
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "Owner can delete clinic" ON public.clinics;
CREATE POLICY "Owner can delete clinic" ON public.clinics
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());

-- 6) Policies em clinic_members
DROP POLICY IF EXISTS "Members can view own memberships" ON public.clinic_members;
CREATE POLICY "Members can view own memberships" ON public.clinic_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id AND c.owner_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owner manages members" ON public.clinic_members;
CREATE POLICY "Owner manages members" ON public.clinic_members
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id AND c.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id AND c.owner_user_id = auth.uid()));

-- 7) Backfill: uma clínica por usuário existente
INSERT INTO public.clinics (owner_user_id, name)
SELECT p.user_id, COALESCE(NULLIF(p.name, ''), 'Minha Clínica')
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.clinics c WHERE c.owner_user_id = p.user_id);

INSERT INTO public.clinic_members (clinic_id, user_id, role)
SELECT c.id, c.owner_user_id, 'owner'::public.clinic_member_role
FROM public.clinics c
WHERE NOT EXISTS (
  SELECT 1 FROM public.clinic_members m
  WHERE m.clinic_id = c.id AND m.user_id = c.owner_user_id
);

-- 8) Adiciona clinic_id (nullable) nas tabelas de tenant
ALTER TABLE public.ai_agent_settings       ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_conversations  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_messages       ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL;
ALTER TABLE public.appointments            ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL;
ALTER TABLE public.patients                ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ai_agent_settings_clinic_id_idx      ON public.ai_agent_settings(clinic_id);
CREATE INDEX IF NOT EXISTS whatsapp_conversations_clinic_id_idx ON public.whatsapp_conversations(clinic_id);
CREATE INDEX IF NOT EXISTS whatsapp_messages_clinic_id_idx      ON public.whatsapp_messages(clinic_id);
CREATE INDEX IF NOT EXISTS appointments_clinic_id_idx           ON public.appointments(clinic_id);
CREATE INDEX IF NOT EXISTS patients_clinic_id_idx               ON public.patients(clinic_id);

-- 9) Backfill de clinic_id a partir do owner_user_id
UPDATE public.ai_agent_settings s SET clinic_id = c.id
  FROM public.clinics c WHERE s.clinic_id IS NULL AND c.owner_user_id = s.user_id;
UPDATE public.whatsapp_conversations s SET clinic_id = c.id
  FROM public.clinics c WHERE s.clinic_id IS NULL AND c.owner_user_id = s.user_id;
UPDATE public.whatsapp_messages s SET clinic_id = c.id
  FROM public.clinics c WHERE s.clinic_id IS NULL AND c.owner_user_id = s.user_id;
UPDATE public.appointments s SET clinic_id = c.id
  FROM public.clinics c WHERE s.clinic_id IS NULL AND c.owner_user_id = s.user_id;
UPDATE public.patients s SET clinic_id = c.id
  FROM public.clinics c WHERE s.clinic_id IS NULL AND c.owner_user_id = s.user_id;

-- 10) Trigger reutilizável: preenche clinic_id no INSERT quando ausente
CREATE OR REPLACE FUNCTION public.set_clinic_id_from_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.clinic_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT id INTO NEW.clinic_id
      FROM public.clinics WHERE owner_user_id = NEW.user_id
      ORDER BY created_at ASC LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_clinic_id_ai_agent_settings ON public.ai_agent_settings;
CREATE TRIGGER set_clinic_id_ai_agent_settings BEFORE INSERT ON public.ai_agent_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_clinic_id_from_user();

DROP TRIGGER IF EXISTS set_clinic_id_whatsapp_conversations ON public.whatsapp_conversations;
CREATE TRIGGER set_clinic_id_whatsapp_conversations BEFORE INSERT ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_clinic_id_from_user();

DROP TRIGGER IF EXISTS set_clinic_id_whatsapp_messages ON public.whatsapp_messages;
CREATE TRIGGER set_clinic_id_whatsapp_messages BEFORE INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_clinic_id_from_user();

DROP TRIGGER IF EXISTS set_clinic_id_appointments ON public.appointments;
CREATE TRIGGER set_clinic_id_appointments BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_clinic_id_from_user();

DROP TRIGGER IF EXISTS set_clinic_id_patients ON public.patients;
CREATE TRIGGER set_clinic_id_patients BEFORE INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.set_clinic_id_from_user();

-- 11) Trigger: novo profile → cria clínica padrão + membership
CREATE OR REPLACE FUNCTION public.create_default_clinic_for_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_clinic_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clinics WHERE owner_user_id = NEW.user_id) THEN
    INSERT INTO public.clinics (owner_user_id, name)
    VALUES (NEW.user_id, COALESCE(NULLIF(NEW.name, ''), 'Minha Clínica'))
    RETURNING id INTO v_clinic_id;

    INSERT INTO public.clinic_members (clinic_id, user_id, role)
    VALUES (v_clinic_id, NEW.user_id, 'owner')
    ON CONFLICT (clinic_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_clinic_after_profile ON public.profiles;
CREATE TRIGGER create_clinic_after_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_default_clinic_for_profile();

-- 12) Trigger updated_at em clinics
DROP TRIGGER IF EXISTS update_clinics_updated_at ON public.clinics;
CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
