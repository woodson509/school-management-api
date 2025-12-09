-- Migration: Add Online Fields to Lessons
-- Created: 2025-12-09

-- Add columns for online class support
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS meeting_link TEXT,
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;

-- Enhance comments
COMMENT ON COLUMN lessons.meeting_link IS 'URL for Zoom/Meet/Teams meeting';
COMMENT ON COLUMN lessons.is_online IS 'Flag to indicate if the lesson is a synchronous online meeting';
