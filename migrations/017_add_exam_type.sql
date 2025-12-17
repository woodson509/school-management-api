-- Add type column to exams table
ALTER TABLE exams 
ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'written' CHECK (type IN ('written', 'online', 'practical', 'oral', 'project'));

-- Update existing records to have a default type (optional, handled by default)
UPDATE exams SET type = 'written' WHERE type IS NULL;
