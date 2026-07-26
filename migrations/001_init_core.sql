-- Extensions + users + interview_sessions

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector

CREATE TABLE users (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email             text NOT NULL UNIQUE,
    target_role       text,
    experience_level  text CHECK (experience_level IN ('entry', 'junior', 'mid', 'senior', 'staff_plus')),
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interview_sessions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_track    text NOT NULL,
    status        text NOT NULL DEFAULT 'in_progress'
                    CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    started_at    timestamptz NOT NULL DEFAULT now(),
    ended_at      timestamptz
);

CREATE INDEX idx_interview_sessions_user_id ON interview_sessions(user_id);
CREATE INDEX idx_interview_sessions_status  ON interview_sessions(status);
