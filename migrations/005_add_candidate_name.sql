ALTER TABLE interview_sessions ADD COLUMN candidate_name text;

-- Allow 'greeting' as a valid session status
ALTER TABLE interview_sessions DROP CONSTRAINT IF EXISTS interview_sessions_status_check;
ALTER TABLE interview_sessions ADD CONSTRAINT interview_sessions_status_check
    CHECK (status IN ('greeting', 'in_progress', 'completed', 'abandoned'));
