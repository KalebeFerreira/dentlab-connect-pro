-- Enable RLS on financial_transactions table
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own transactions
CREATE POLICY "Users can view own transactions"
ON financial_transactions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to insert their own transactions
CREATE POLICY "Users can insert own transactions"
ON financial_transactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own transactions
CREATE POLICY "Users can update own transactions"
ON financial_transactions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own transactions
CREATE POLICY "Users can delete own transactions"
ON financial_transactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);