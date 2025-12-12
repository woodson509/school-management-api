-- Add missing columns to users table
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
    ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
    
    -- Student fields
    ADD COLUMN IF NOT EXISTS class_id UUID,
    ADD COLUMN IF NOT EXISTS student_id_number VARCHAR(50),
    ADD COLUMN IF NOT EXISTS enrollment_date DATE,
    ADD COLUMN IF NOT EXISTS enrollment_status VARCHAR(20) DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS parent_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS parent_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS parent_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(50),
    ADD COLUMN IF NOT EXISTS medical_notes TEXT,
    ADD COLUMN IF NOT EXISTS special_needs TEXT,
    ADD COLUMN IF NOT EXISTS transport_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS previous_school VARCHAR(255),
    ADD COLUMN IF NOT EXISTS scholarship_status VARCHAR(50) DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS scholarship_percentage DECIMAL(5,2),
    
    -- Teacher fields
    ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS hire_date DATE,
    ADD COLUMN IF NOT EXISTS contract_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50) DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS specialization VARCHAR(255),
    ADD COLUMN IF NOT EXISTS qualifications JSONB,
    ADD COLUMN IF NOT EXISTS years_of_experience INTEGER,
    ADD COLUMN IF NOT EXISTS subjects_taught JSONB,
    ADD COLUMN IF NOT EXISTS department VARCHAR(100),
    ADD COLUMN IF NOT EXISTS office_location VARCHAR(100),
    ADD COLUMN IF NOT EXISTS max_teaching_hours INTEGER,
    ADD COLUMN IF NOT EXISTS is_class_teacher BOOLEAN DEFAULT false,
    
    -- Admin fields
    ADD COLUMN IF NOT EXISTS position VARCHAR(100),
    ADD COLUMN IF NOT EXISTS can_approve_expenses BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS can_manage_all_classes BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS max_expense_approval_amount DECIMAL(10,2),
    
    -- Access control
    ADD COLUMN IF NOT EXISTS access_revoked_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS access_revoked_reason TEXT;

-- Add foreign key for class_id
ALTER TABLE users 
    DROP CONSTRAINT IF EXISTS fk_users_class;

ALTER TABLE users 
    ADD CONSTRAINT fk_users_class 
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;
