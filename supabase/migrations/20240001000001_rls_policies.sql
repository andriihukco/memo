-- Enable Row Level Security on all tables
ALTER TABLE profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights  ENABLE ROW LEVEL SECURITY;

-- profiles: users can only see/edit their own row
CREATE POLICY profiles_self ON profiles
  USING (id = auth.uid());

-- entries: users can only see/edit their own entries
CREATE POLICY entries_owner ON entries
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- insights: users can only see/edit their own insights
CREATE POLICY insights_owner ON insights
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
