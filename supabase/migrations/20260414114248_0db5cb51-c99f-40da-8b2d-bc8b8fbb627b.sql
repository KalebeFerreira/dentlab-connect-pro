-- Add unique constraint on whatsapp_conversations(user_id, phone_number) for upsert support
ALTER TABLE public.whatsapp_conversations
ADD CONSTRAINT whatsapp_conversations_user_id_phone_number_key UNIQUE (user_id, phone_number);

-- Drop the old non-unique index since the unique constraint creates one automatically
DROP INDEX IF EXISTS idx_whatsapp_conversations_user_phone;