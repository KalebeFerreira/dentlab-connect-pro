-- Add report format preferences to automatic_report_schedules
ALTER TABLE public.automatic_report_schedules 
ADD COLUMN IF NOT EXISTS report_format TEXT DEFAULT 'pdf';

-- Valid formats: pdf, word, excel, jpg, png