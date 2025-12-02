-- Migration: Create Grading System Foundation
-- Description: Tables for grading scales, periods, coefficients, grades, and competencies
-- Phase: 1 - Report Card Foundations
-- Created: 2025-12-02

-- ============================================================================
-- DROP EXISTING TABLES (Clean slate)
-- ============================================================================
DROP TABLE IF EXISTS competency_evaluations CASCADE;
DROP TABLE IF EXISTS competencies CASCADE;
DROP TABLE IF EXISTS grades CASCADE;
DROP TABLE IF EXISTS subject_coefficients CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS report_periods CASCADE;
DROP TABLE IF EXISTS school_settings CASCADE;
DROP TABLE IF EXISTS grading_scales CASCADE;


-- ============================================================================
-- GRADING SCALES (Échelles de notation)
-- ============================================================================
CREATE TABLE grading_scales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL, -- e.g., "Sur 10", "Sur 20", "Sur 100"
    max_value DECIMAL(5, 2) NOT NULL, -- e.g., 10.00, 20.00, 100.00
    min_value DECIMAL(5, 2) DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- SCHOOL SETTINGS (Configuration globale)
-- ============================================================================
CREATE TABLE school_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default settings
INSERT INTO school_settings (setting_key, setting_value, description) VALUES
('grading_scale_id', NULL, 'Active grading scale ID'),
('passing_percentage', '50', 'Minimum percentage to pass'),
('excellent_threshold', '90', 'Percentage for Excellent mention'),
('very_good_threshold', '80', 'Percentage for Very Good mention'),
('good_threshold', '70', 'Percentage for Good mention'),
('passable_threshold', '60', 'Percentage for Passable mention'),
('school_year', '2024-2025', 'Current school year'),
('report_card_language', 'fr', 'Default language for report cards (fr/ht)')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- REPORT PERIODS (Périodes d'évaluation: trimestre, semestre, etc.)
-- ============================================================================
CREATE TABLE report_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL, -- e.g., "Trimestre 1", "Semestre 1"
    period_type VARCHAR(50) NOT NULL CHECK (period_type IN ('trimester', 'semester', 'quarter', 'monthly', 'custom')),
    school_year VARCHAR(20) NOT NULL, -- e.g., "2024-2025"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    order_number INT, -- Pour l'ordre d'affichage
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_periods_year ON report_periods(school_year);
CREATE INDEX IF NOT EXISTS idx_report_periods_active ON report_periods(is_active);

-- ============================================================================
-- SUBJECTS (Matières/Cours)
-- ============================================================================
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subjects_code ON subjects(code);
CREATE INDEX IF NOT EXISTS idx_subjects_active ON subjects(is_active);

-- Trigger for subjects
DROP TRIGGER IF EXISTS update_subjects_updated_at ON subjects;
CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON subjects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- SUBJECT COEFFICIENTS (Coefficients par matière et niveau)
-- ============================================================================
CREATE TABLE subject_coefficients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    coefficient DECIMAL(3, 1) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(subject_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_subject_coefficients_subject ON subject_coefficients(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_coefficients_class ON subject_coefficients(class_id);

-- ============================================================================
-- GRADES (Notes des élèves)
-- ============================================================================
CREATE TABLE grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    report_period_id UUID REFERENCES report_periods(id) ON DELETE CASCADE,
    grade_type VARCHAR(50) NOT NULL CHECK (grade_type IN ('exam', 'quiz', 'homework', 'project', 'participation', 'other')),
    value DECIMAL(5, 2) NOT NULL,
    max_value DECIMAL(5, 2) NOT NULL, -- Pour validation selon l'échelle
    weight DECIMAL(3, 2) DEFAULT 1.0, -- Poids de cette note dans la moyenne (0-1)
    notes TEXT, -- Commentaires du professeur
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_subject ON grades(subject_id);
CREATE INDEX IF NOT EXISTS idx_grades_period ON grades(report_period_id);
CREATE INDEX IF NOT EXISTS idx_grades_class ON grades(class_id);

-- ============================================================================
-- COMPETENCIES (Référentiel de compétences)
-- ============================================================================
CREATE TABLE competencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., "MATH-C1", "FR-ORAL-1"
    name VARCHAR(255) NOT NULL,
    description TEXT,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    category VARCHAR(100), -- e.g., "Résolution de problèmes", "Communication"
    level VARCHAR(50), -- e.g., "Primaire", "Secondaire"
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competencies_subject ON competencies(subject_id);
CREATE INDEX IF NOT EXISTS idx_competencies_code ON competencies(code);

-- ============================================================================
-- COMPETENCY EVALUATIONS (Évaluations des compétences)
-- ============================================================================
CREATE TABLE competency_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    competency_id UUID REFERENCES competencies(id) ON DELETE CASCADE,
    report_period_id UUID REFERENCES report_periods(id) ON DELETE CASCADE,
    level VARCHAR(50) NOT NULL CHECK (level IN ('not_acquired', 'in_progress', 'acquired', 'expert')),
    -- 0: Non Acquis, 1: En cours, 2: Acquis, 3: Expert
    level_numeric INT CHECK (level_numeric BETWEEN 0 AND 3),
    comments TEXT,
    evaluated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, competency_id, report_period_id)
);

CREATE INDEX IF NOT EXISTS idx_competency_eval_student ON competency_evaluations(student_id);
CREATE INDEX IF NOT EXISTS idx_competency_eval_competency ON competency_evaluations(competency_id);
CREATE INDEX IF NOT EXISTS idx_competency_eval_period ON competency_evaluations(report_period_id);

-- ============================================================================
-- TRIGGERS for updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS update_grading_scales_updated_at ON grading_scales;
CREATE TRIGGER update_grading_scales_updated_at BEFORE UPDATE ON grading_scales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_school_settings_updated_at ON school_settings;
CREATE TRIGGER update_school_settings_updated_at BEFORE UPDATE ON school_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_report_periods_updated_at ON report_periods;
CREATE TRIGGER update_report_periods_updated_at BEFORE UPDATE ON report_periods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subject_coefficients_updated_at ON subject_coefficients;
CREATE TRIGGER update_subject_coefficients_updated_at BEFORE UPDATE ON subject_coefficients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_grades_updated_at ON grades;
CREATE TRIGGER update_grades_updated_at BEFORE UPDATE ON grades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_competencies_updated_at ON competencies;
CREATE TRIGGER update_competencies_updated_at BEFORE UPDATE ON competencies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_competency_evaluations_updated_at ON competency_evaluations;
CREATE TRIGGER update_competency_evaluations_updated_at BEFORE UPDATE ON competency_evaluations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INSERT DEFAULT DATA
-- ============================================================================

-- Default grading scales
INSERT INTO grading_scales (name, max_value, min_value, is_default) VALUES
('Sur 10', 10.00, 0, false),
('Sur 20', 20.00, 0, true),
('Sur 50', 50.00, 0, false),
('Sur 100', 100.00, 0, false)
ON CONFLICT DO NOTHING;
