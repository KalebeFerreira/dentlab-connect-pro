-- Allow employees to view goals assigned to them by the lab owner
CREATE POLICY "Employees can view their own goals"
ON public.production_goals
FOR SELECT
USING (
  employee_id = get_employee_id(auth.uid())
  AND user_id = get_employee_owner_id(auth.uid())
);