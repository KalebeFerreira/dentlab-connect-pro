-- Create employees table for laboratory staff management
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for employees
CREATE POLICY "Users can view their own employees"
  ON public.employees FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own employees"
  ON public.employees FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own employees"
  ON public.employees FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own employees"
  ON public.employees FOR DELETE
  USING (auth.uid() = user_id);

-- Create work_records table for tracking work done by employees
CREATE TABLE public.work_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_type TEXT NOT NULL,
  work_code TEXT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'in_progress',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.work_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for work_records
CREATE POLICY "Users can view their own work records"
  ON public.work_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own work records"
  ON public.work_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own work records"
  ON public.work_records FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own work records"
  ON public.work_records FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp for employees
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to update updated_at timestamp for work_records
CREATE TRIGGER update_work_records_updated_at
  BEFORE UPDATE ON public.work_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();