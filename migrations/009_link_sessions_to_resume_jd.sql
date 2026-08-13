ALTER TABLE interview_sessions
  ADD COLUMN resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  ADD COLUMN job_description_id UUID REFERENCES job_descriptions(id)
    ON DELETE SET NULL;
