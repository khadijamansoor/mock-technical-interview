CREATE TABLE turns (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       uuid NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    question_id      uuid REFERENCES questions(id) ON DELETE SET NULL,
    sequence_number  integer NOT NULL,
    speaker          text NOT NULL CHECK (speaker IN ('interviewer', 'candidate')),
    content          text NOT NULL,
    eval_json        jsonb,
    created_at       timestamptz NOT NULL DEFAULT now(),

    UNIQUE (session_id, sequence_number)
);

CREATE INDEX idx_turns_session_id  ON turns(session_id);
CREATE INDEX idx_turns_question_id ON turns(question_id);
