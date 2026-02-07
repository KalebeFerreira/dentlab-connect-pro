
-- Create production_goals table for lab and employee targets
CREATE TABLE public.production_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('weekly', 'monthly', 'annual')),
  target_quantity INTEGER NOT NULL DEFAULT 0,
  target_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.production_goals ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own goals"
ON public.production_goals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own goals"
ON public.production_goals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
ON public.production_goals FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
ON public.production_goals FOR DELETE
USING (auth.uid() = user_id);

-- Unique constraint: one goal per type per employee (or lab-level)
CREATE UNIQUE INDEX idx_production_goals_unique 
ON public.production_goals (user_id, goal_type, COALESCE(employee_id, '00000000-0000-0000-0000-000000000000'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_goals;
