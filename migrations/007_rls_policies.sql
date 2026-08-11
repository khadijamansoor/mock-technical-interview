-- Enable RLS on track_rubrics
ALTER TABLE track_rubrics ENABLE ROW LEVEL SECURITY;

-- Grant service_role full access to track_rubrics
CREATE POLICY "service_role_all_track_rubrics" 
ON track_rubrics 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- The other 5 tables (users, interview_sessions, questions, turns, scorecards)
-- already have RLS enabled and NO policies (default deny).
-- For consistency, explicitly add the service_role policy to them as well.
CREATE POLICY "service_role_all_users" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_interview_sessions" ON interview_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_questions" ON questions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_turns" ON turns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all_scorecards" ON scorecards FOR ALL TO service_role USING (true) WITH CHECK (true);
