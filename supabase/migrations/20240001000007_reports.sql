-- Reports table — stores AI-generated retrospective reports
CREATE TABLE IF NOT EXISTS reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_type  TEXT NOT NULL CHECK (period_type IN ('daily','weekly','monthly','custom')),
  period_from  TIMESTAMPTZ NOT NULL,
  period_to    TIMESTAMPTZ NOT NULL,
  content      TEXT NOT NULL,          -- full markdown report text
  summary      TEXT NOT NULL,          -- 1-2 sentence tldr
  insights     JSONB NOT NULL DEFAULT '[]', -- structured insights array
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_user_id_idx ON reports(user_id);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports(created_at DESC);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_owner ON reports
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Report schedule stored in profiles.settings.report_schedule
-- Structure: { "daily": bool, "weekly": bool, "monthly": bool, "time": "09:00" }
