CREATE TABLE resumes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path     TEXT NOT NULL,
  file_type     TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx')),
  raw_text      TEXT,
  embedding     vector(384),
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  parsed_at     TIMESTAMPTZ
);
CREATE INDEX idx_resumes_user_id ON resumes(user_id);

CREATE TABLE job_descriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  company       TEXT,
  raw_text      TEXT NOT NULL,
  embedding     vector(384),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jds_user_id ON job_descriptions(user_id);

ALTER TABLE users
  ADD COLUMN active_resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  ADD COLUMN active_jd_id UUID REFERENCES job_descriptions(id) ON DELETE SET NULL;
