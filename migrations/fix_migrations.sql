-- Combined Migration Script for Report Cards and Advanced Features
-- Run this file to fix the migration errors
-- Usage: psql -U postgres -d school_db -f migrations\fix_migrations.sql

-- ============================================
-- 1. CREATE HELPER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. CREATE REPORT CARDS TABLES
-- ============================================

-- Drop existing tables first
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

-- ============================================
-- 3. CREATE ADVANCED FEATURES TABLES
-- ============================================

-- Drop existing tables
DROP TABLE IF EXISTS parent_signatures CASCADE;
DROP TABLE IF EXISTS scholarship_candidates CASCADE;
DROP TABLE IF EXISTS performance_predictions CASCADE;
DROP TABLE IF EXISTS student_portfolios CASCADE;
DROP TABLE IF EXISTS student_badges CASCADE;
DROP TABLE IF EXISTS badges CASCADE;

-- Badges & Gamification
CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url TEXT,
    criteria JSONB, -- e.g., {"min_average": 18, "subject": "Math"}
    badge_type VARCHAR(50) CHECK (badge_type IN ('academic', 'behavior', 'sport', 'art', 'other')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    awarded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    awarded_by UUID REFERENCES users(id) -- Teacher or Admin who awarded it manually (null if auto)
);

-- Student Portfolios
CREATE TABLE student_portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50), -- image, pdf, video, etc.
    tags TEXT[],
    is_public BOOLEAN DEFAULT false, -- Visible to other students/public?
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analytics & Predictions
CREATE TABLE performance_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE, -- Null for overall average
    predicted_grade DECIMAL(5, 2),
    confidence_score DECIMAL(5, 2), -- 0-100%
    factors JSONB, -- e.g., {"attendance": "low", "homework": "missing"}
    prediction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scholarship_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    criteria_met JSONB, -- e.g., {"average": 19, "income": "low"}
    status VARCHAR(50) DEFAULT 'identified' CHECK (status IN ('identified', 'reviewed', 'approved', 'rejected')),
    identified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id)
);

-- Parent Signatures
CREATE TABLE parent_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_card_id UUID NOT NULL REFERENCES report_cards(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES users(id), -- Optional if we allow guest signing via link
    parent_name VARCHAR(100), -- If not logged in
    signature_data TEXT, -- Base64 signature image or digital hash
    ip_address VARCHAR(50),
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(report_card_id) -- Only one signature per report card (for now)
);

-- Indexes
CREATE INDEX idx_student_badges_student ON student_badges(student_id);
CREATE INDEX idx_student_portfolios_student ON student_portfolios(student_id);
CREATE INDEX idx_predictions_student ON performance_predictions(student_id);
CREATE INDEX idx_scholarship_student ON scholarship_candidates(student_id);

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully! Report cards and advanced features tables created.';
END
$$;
