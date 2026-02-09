
-- Add 'employee' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employee';

-- Add auth fields to employees table
ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS auth_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE;

-- Function to get employee record from auth user
CREATE OR REPLACE FUNCTION public.get_employee_record(_auth_user_id uuid)
RETURNS TABLE(employee_id uuid, owner_user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, user_id FROM public.employees WHERE auth_user_id = _auth_user_id LIMIT 1;
$$;

-- Function to get employee's lab owner user_id
CREATE OR REPLACE FUNCTION public.get_employee_owner_id(_auth_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.employees WHERE auth_user_id = _auth_user_id LIMIT 1;
$$;

-- Function to get employee_id from auth user
CREATE OR REPLACE FUNCTION public.get_employee_id(_auth_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employees WHERE auth_user_id = _auth_user_id LIMIT 1;
$$;

-- RLS: Employees can view their own work records
CREATE POLICY "Employees can view their own work records"
ON public.work_records
FOR SELECT
USING (employee_id = public.get_employee_id(auth.uid()));

-- RLS: Employees can view their own employee record
CREATE POLICY "Employees can view their own employee record"
ON public.employees
FOR SELECT
USING (auth_user_id = auth.uid());

-- RLS: Employees can view services of their lab
CREATE POLICY "Employees can view lab services"
ON public.services
FOR SELECT
USING (user_id = public.get_employee_owner_id(auth.uid()));

-- RLS: Employees can insert services for their lab
CREATE POLICY "Employees can insert services for their lab"
ON public.services
FOR INSERT
WITH CHECK (user_id = public.get_employee_owner_id(auth.uid()));

-- RLS: Employees can view financial transactions of their lab (read-only)
CREATE POLICY "Employees can view lab transactions"
ON public.financial_transactions
FOR SELECT
USING (
  user_id = public.get_employee_owner_id(auth.uid())
  AND description LIKE '%[TRAB:%'
  AND description LIKE '%' || (SELECT name FROM public.employees WHERE auth_user_id = auth.uid()) || '%'
);
