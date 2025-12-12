-- Migration: Fix Assignments Table Schema
-- Created: 2024-12-12
-- Description: Add missing columns to existing assignments table

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Add 'points' column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'assignments' AND column_name = 'points') THEN
        ALTER TABLE assignments ADD COLUMN points INTEGER DEFAULT 100;
    END IF;

    -- Add 'type' column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'assignments' AND column_name = 'type') THEN
        ALTER TABLE assignments ADD COLUMN type VARCHAR(50) DEFAULT 'homework';
    END IF;

    -- Add 'is_published' column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'assignments' AND column_name = 'is_published') THEN
        ALTER TABLE assignments ADD COLUMN is_published BOOLEAN DEFAULT false;
    END IF;

    -- Add 'created_at' column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'assignments' AND column_name = 'created_at') THEN
        ALTER TABLE assignments ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
    END IF;

    -- Add 'updated_at' column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'assignments' AND column_name = 'updated_at') THEN
        ALTER TABLE assignments ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    END IF;
END $$;
