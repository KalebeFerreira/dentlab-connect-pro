-- Add signature position configuration to company_info table
ALTER TABLE public.company_info 
ADD COLUMN IF NOT EXISTS signature_position TEXT DEFAULT 'bottom' CHECK (signature_position IN ('top', 'middle', 'bottom'));