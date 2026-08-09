-- 1. Expanded Track Taxonomy: Add round_type to questions and interview_sessions
ALTER TABLE questions 
ADD COLUMN round_type text;

ALTER TABLE interview_sessions
ADD COLUMN round_type text;

-- 2. Webcam Coaching: Add nonverbal_metrics to turns
ALTER TABLE turns 
ADD COLUMN nonverbal_metrics jsonb;

-- 3. Dynamic Rubrics: Remove hardcoded constraint from scorecards
ALTER TABLE scorecards 
DROP CONSTRAINT IF EXISTS rubric_scores_has_all_dimensions;

-- 4. Hiring-manager-calibrated rubrics: Add table for weights
CREATE TABLE track_rubrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_track text NOT NULL,
    round_type text,
    dimension text NOT NULL,
    weight numeric NOT NULL CHECK (weight >= 0 AND weight <= 1),
    description text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Ensure we don't have duplicate dimensions for the same track and round_type
    -- Using COALESCE for round_type so the UNIQUE constraint works properly with NULLs if needed,
    -- but Postgres 15+ treats NULLs as distinct by default in UNIQUE constraints. 
    -- We can use a unique index for safety if round_type can be null.
    UNIQUE NULLS NOT DISTINCT (role_track, round_type, dimension)
);

-- Note: The application layer will enforce that SUM(weight) = 1.0 for a given (role_track, round_type)

-- Add index for fast querying by track and round type
CREATE INDEX idx_track_rubrics_lookup ON track_rubrics(role_track, round_type);
