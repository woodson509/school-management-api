-- Migration: Add Teacher Payments Table
-- Description: Create table for tracking teacher salaries and payments
-- Created: 2025-12-01

CREATE TABLE IF NOT EXISTS teacher_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date TIMESTAMP DEFAULT NOW(),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'check', 'mobile_money', 'other')),
    reference VARCHAR(100),
    period_month VARCHAR(20) NOT NULL, -- e.g., "2023-10" or "October 2023"
    period_year INT NOT NULL,
    status VARCHAR(20) DEFAULT 'paid' CHECK (status IN ('pending', 'paid')),
    notes TEXT,
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teacher_payments_teacher ON teacher_payments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_payments_period ON teacher_payments(period_month, period_year);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_teacher_payments_updated_at ON teacher_payments;
CREATE TRIGGER update_teacher_payments_updated_at BEFORE UPDATE ON teacher_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
