-- Migration: Add Curricula Table
-- Description: Create table for tracking academic curricula/programs
-- Created: 2025-12-01

CREATE TABLE IF NOT EXISTS curricula (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    level VARCHAR(50) NOT NULL CHECK (level IN ('Primaire', 'Secondaire', 'Terminale', 'Technique', 'Universitaire', 'Autre')),
    duration VARCHAR(50),
    total_credits INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('active', 'draft', 'archived')),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_curricula_school ON curricula(school_id);
CREATE INDEX IF NOT EXISTS idx_curricula_code ON curricula(code);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_curricula_updated_at ON curricula;
CREATE TRIGGER update_curricula_updated_at BEFORE UPDATE ON curricula
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
