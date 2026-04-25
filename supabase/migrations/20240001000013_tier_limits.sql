-- Function to get user usage counts
-- Widgets are stored as a JSONB array in profiles.settings.custom_widgets,
-- not in a separate table, so we use jsonb_array_length for that count.
CREATE OR REPLACE FUNCTION get_user_usage_counts(p_user_id UUID)
RETURNS TABLE(entries_count INT, widgets_count INT, reports_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INT FROM entries WHERE user_id = p_user_id) AS entries_count,
    (
      SELECT COALESCE(
        jsonb_array_length(
          (SELECT settings -> 'custom_widgets' FROM profiles WHERE id = p_user_id)
        ),
        0
      )
    )::INT AS widgets_count,
    (SELECT COUNT(*)::INT FROM reports WHERE user_id = p_user_id) AS reports_count;
END;
$$;
