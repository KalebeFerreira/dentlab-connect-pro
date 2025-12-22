-- Add color column to services table
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS color text;

-- Add work_type column for type of work
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS work_type text;