-- Migration: Add class_id to courses table
-- Description: Links courses to specific classes

ALTER TABLE courses 
ADD COLUMN class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_courses_class_id ON courses(class_id);

-- Update existing courses (optional, if you want to assign a default class or leave null)
-- UPDATE courses SET class_id = ... WHERE ...;
