-- Allow employees to insert work records for their lab owner
CREATE POLICY "Employees can insert work records for their lab"
ON public.work_records
FOR INSERT
WITH CHECK (
  user_id = get_employee_owner_id(auth.uid())
  AND employee_id = get_employee_id(auth.uid())
);