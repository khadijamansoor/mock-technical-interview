CREATE TABLE questions (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    text               text NOT NULL,
    role_track         text NOT NULL,
    topic              text NOT NULL,
    difficulty         text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    ideal_answer_points jsonb NOT NULL DEFAULT '[]'::jsonb,
    embedding          vector(384),
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_questions_role_track_difficulty ON questions(role_track, difficulty);
CREATE INDEX idx_questions_topic ON questions(topic);

CREATE INDEX idx_questions_embedding_cosine ON questions
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 10);
