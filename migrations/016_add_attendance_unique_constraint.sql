-- Migration: Add unique constraint to attendance table
-- Created: 2024-12-12
-- Description: Add missing unique constraint for ON CONFLICT upsert

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'attendance_student_date_class_unique'
    ) THEN
        ALTER TABLE attendance 
        ADD CONSTRAINT attendance_student_date_class_unique 
        UNIQUE (student_id, date, class_id);
    END IF;
END $$;
