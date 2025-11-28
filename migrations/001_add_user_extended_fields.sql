-- Migration: Add Extended User Fields for Pedagogical Management
-- Description: Adds comprehensive fields for students, teachers, and admin management
-- Created: 2025-11-28

-- Add common fields for all users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender VARCHAR(10) CHECK (gender IN ('M', 'F', 'Other', NULL)),
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
ADD COLUMN IF NOT EXISTS access_revoked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS access_revoked_reason TEXT;

-- Add student-specific fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS student_id_number VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS enrollment_date DATE,
ADD COLUMN IF NOT EXISTS enrollment_status VARCHAR(20) CHECK (enrollment_status IN ('active', 'suspended', 'graduated', 'withdrawn', 'transferred', NULL)),
ADD COLUMN IF NOT EXISTS parent_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS parent_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS parent_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(100),
ADD COLUMN IF NOT EXISTS medical_notes TEXT,
ADD COLUMN IF NOT EXISTS special_needs TEXT,
ADD COLUMN IF NOT EXISTS transport_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS previous_school VARCHAR(255),
ADD COLUMN IF NOT EXISTS scholarship_status VARCHAR(20) CHECK (scholarship_status IN ('none', 'partial', 'full', NULL)),
ADD COLUMN IF NOT EXISTS scholarship_percentage INTEGER CHECK (scholarship_percentage >= 0 AND scholarship_percentage <= 100);

-- Add teacher-specific fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS hire_date DATE,
ADD COLUMN IF NOT EXISTS contract_type VARCHAR(20) CHECK (contract_type IN ('permanent', 'temporary', 'part_time', NULL)),
ADD COLUMN IF NOT EXISTS employment_status VARCHAR(20) CHECK (employment_status IN ('active', 'on_leave', 'terminated', NULL)),
ADD COLUMN IF NOT EXISTS specialization TEXT,
ADD COLUMN IF NOT EXISTS qualifications JSONB,
ADD COLUMN IF NOT EXISTS years_of_experience INTEGER,
ADD COLUMN IF NOT EXISTS subjects_taught JSONB,
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS office_location VARCHAR(100),
ADD COLUMN IF NOT EXISTS max_teaching_hours INTEGER,
ADD COLUMN IF NOT EXISTS is_class_teacher BOOLEAN DEFAULT false;

-- Add admin-specific fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS position VARCHAR(50) CHECK (position IN ('director', 'vice_director', 'coordinator', 'secretary', 'other', NULL)),
ADD COLUMN IF NOT EXISTS can_approve_expenses BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_all_classes BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS max_expense_approval_amount DECIMAL(10,2);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_class_id ON users(class_id);
CREATE INDEX IF NOT EXISTS idx_users_student_id_number ON users(student_id_number);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_enrollment_status ON users(enrollment_status);
CREATE INDEX IF NOT EXISTS idx_users_employment_status ON users(employment_status);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Add comments for documentation
COMMENT ON COLUMN users.phone IS 'Contact phone number';
COMMENT ON COLUMN users.enrollment_status IS 'Student enrollment status: active, suspended, graduated, withdrawn, transferred';
COMMENT ON COLUMN users.contract_type IS 'Teacher contract type: permanent, temporary, part_time';
COMMENT ON COLUMN users.position IS 'Admin position: director, vice_director, coordinator, secretary, other';
COMMENT ON COLUMN users.access_revoked_at IS 'Timestamp when access was revoked';
COMMENT ON COLUMN users.student_id_number IS 'Unique student matricule number';
COMMENT ON COLUMN users.employee_id IS 'Unique employee matricule number';

-- Note: Run this migration on your Supabase database
-- All new columns are nullable to not affect existing users
