-- Add is_public field to laboratory_info to allow visibility to other users
ALTER TABLE laboratory_info 
ADD COLUMN is_public BOOLEAN DEFAULT true,
ADD COLUMN description TEXT;

-- Add laboratory_id to orders table to track which lab is processing the order
ALTER TABLE orders 
ADD COLUMN laboratory_id UUID REFERENCES laboratory_info(id);

-- Create RLS policy to allow public viewing of laboratories marked as public
CREATE POLICY "Public laboratories are viewable by authenticated users" 
ON laboratory_info 
FOR SELECT 
TO authenticated
USING (is_public = true OR auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_laboratory_info_is_public ON laboratory_info(is_public);