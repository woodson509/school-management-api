-- Migration: Create Report Cards Tables
-- Description: Stores generated report cards, subject summaries, and related data

-- Create or replace the trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop tables if they exist (cascade to remove dependencies)
DROP TABLE IF EXISTS report_card_subjects CASCADE;
DROP TABLE IF EXISTS report_cards CASCADE;

-- Create report_cards table
CREATE TABLE report_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    report_period_id UUID NOT NULL REFERENCES report_periods(id) ON DELETE CASCADE,
    
    -- Statistics
    overall_average DECIMAL(5, 2), -- e.g., 15.50
    class_average DECIMAL(5, 2),   -- Average of the whole class
    min_average DECIMAL(5, 2),     -- Lowest average in class
    max_average DECIMAL(5, 2),     -- Highest average in class
    rank INTEGER,
    total_students INTEGER,
    
    -- Metadata
    appreciation TEXT,             -- General comment (Principal/Teacher)
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(student_id, report_period_id) -- One report card per student per period
);

-- Create report_card_subjects table (Subject-wise breakdown)
CREATE TABLE report_card_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_card_id UUID NOT NULL REFERENCES report_cards(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    
    -- Subject Stats
    subject_average DECIMAL(5, 2),
    class_subject_average DECIMAL(5, 2),
    min_subject_average DECIMAL(5, 2),
    max_subject_average DECIMAL(5, 2),
    coefficient DECIMAL(4, 2) DEFAULT 1.0,
    rank_in_subject INTEGER,
    
    -- Teacher's comment for this subject
    appreciation TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_report_cards_student ON report_cards(student_id);
CREATE INDEX idx_report_cards_class ON report_cards(class_id);
CREATE INDEX idx_report_cards_period ON report_cards(report_period_id);
CREATE INDEX idx_report_card_subjects_card ON report_card_subjects(report_card_id);

-- Trigger to update updated_at
CREATE TRIGGER update_report_cards_modtime
    BEFORE UPDATE ON report_cards
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();
