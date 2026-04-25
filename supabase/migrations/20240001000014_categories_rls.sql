-- Enable RLS on categories table (was missing from migration 000004)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Users can only read their own categories
CREATE POLICY categories_select ON categories
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own categories
CREATE POLICY categories_insert ON categories
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own categories
CREATE POLICY categories_update ON categories
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own categories
CREATE POLICY categories_delete ON categories
  FOR DELETE
  USING (user_id = auth.uid());
