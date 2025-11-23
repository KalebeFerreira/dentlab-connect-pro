-- Add dentist role to app_role enum (this needs to be in its own transaction)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dentist';