-- Migration: Link Courses to Subjects
-- Description: Add subject_id column to courses table

ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_courses_subject_id ON courses(subject_id);

-- Optional: Try to auto-link based on name matching (if useful)
-- UPDATE courses c SET subject_id = s.id 
-- FROM subjects s 
-- WHERE c.title ILIKE '%' || s.name || '%' AND c.subject_id IS NULL;
