-- Normaliza evolution_instance_name para o padrão determinístico usado pelo evolution-manager:
--   clinic-{substr(replace(user_id::text,'-',''),1,24)}
-- Isso corrige linhas legadas (ex.: 'agent-61993671977') que não batem com o
-- instance_name enviado pelo webhook da Evolution API, causando 404 no roteamento.

WITH target AS (
  SELECT
    id,
    user_id,
    'clinic-' || substr(replace(user_id::text, '-', ''), 1, 24) AS canonical_name
  FROM public.ai_agent_settings
)
UPDATE public.ai_agent_settings s
SET evolution_instance_name = t.canonical_name,
    updated_at = now()
FROM target t
WHERE s.id = t.id
  AND (s.evolution_instance_name IS DISTINCT FROM t.canonical_name);

-- Espelha em whatsapp_instances (o trigger de sync já cobre, mas garantimos o backfill)
WITH target AS (
  SELECT
    wi.id,
    'clinic-' || substr(replace(s.user_id::text, '-', ''), 1, 24) AS canonical_name
  FROM public.whatsapp_instances wi
  JOIN public.ai_agent_settings s ON s.id = wi.legacy_ai_agent_settings_id
)
UPDATE public.whatsapp_instances wi
SET evolution_instance_name = t.canonical_name,
    updated_at = now()
FROM target t
WHERE wi.id = t.id
  AND (wi.evolution_instance_name IS DISTINCT FROM t.canonical_name);