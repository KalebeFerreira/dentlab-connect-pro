-- Corrige o plan_name das assinaturas que foram ativadas via PIX mas ficaram com plan_name='free'
-- Pega o plan_key do pagamento PIX aprovado mais recente de cada usuário
UPDATE public.user_subscriptions us
SET 
  plan_name = sub.plan_key,
  current_period_start = COALESCE(sub.subscription_start, us.current_period_start),
  current_period_end = COALESCE(sub.subscription_end, us.current_period_end),
  updated_at = now()
FROM (
  SELECT DISTINCT ON (user_id)
    user_id, plan_key, subscription_start, subscription_end
  FROM public.pix_payments
  WHERE status = 'approved' AND plan_key IS NOT NULL
  ORDER BY user_id, paid_at DESC NULLS LAST
) sub
WHERE us.user_id = sub.user_id
  AND us.status = 'active'
  AND (us.plan_name IS NULL OR us.plan_name = 'free' OR us.plan_name <> sub.plan_key);