CREATE TABLE scorecards (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id        uuid NOT NULL UNIQUE REFERENCES interview_sessions(id) ON DELETE CASCADE,
    rubric_scores     jsonb NOT NULL,
    overall_feedback  text NOT NULL,
    generated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT rubric_scores_has_all_dimensions CHECK (
        rubric_scores ? 'correctness'
        AND rubric_scores ? 'depth'
        AND rubric_scores ? 'communication'
        AND rubric_scores ? 'problem_solving'
    )
);

CREATE INDEX idx_scorecards_session_id ON scorecards(session_id);
