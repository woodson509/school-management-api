-- Migration: Create Advanced Features Tables
-- Description: Tables for Badges, Portfolios, Analytics, and Signatures

-- Drop tables if they exist
DROP TABLE IF EXISTS parent_signatures CASCADE;
DROP TABLE IF EXISTS scholarship_candidates CASCADE;
DROP TABLE IF EXISTS performance_predictions CASCADE;
DROP TABLE IF EXISTS student_portfolios CASCADE;
DROP TABLE IF EXISTS student_badges CASCADE;
DROP TABLE IF EXISTS badges CASCADE;

-- 1. Badges & Gamification
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

-- 2. Student Portfolios
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

-- 3. Analytics & Predictions
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

-- 4. Parent Signatures
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
