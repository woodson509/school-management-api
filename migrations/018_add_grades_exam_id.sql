-- Add exam_id to grades table
ALTER TABLE grades
ADD COLUMN IF NOT EXISTS exam_id UUID REFERENCES exams(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_grades_exam ON grades(exam_id);
