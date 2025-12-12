/**
 * Migration Controller
 * Handles database schema migrations and setup
 */

const db = require('../config/database');

/**
 * Run the roles system setup migration
 * POST /api/migrations/roles
 */
exports.runRolesMigration = async (req, res) => {
  let client;
  try {
    const pool = await db.getPool();
    client = await pool.connect();

    console.log('🚀 Starting Roles System Migration...');

    // 1. Create roles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        color VARCHAR(7) DEFAULT '#6366F1',
        is_system BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create permissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        code VARCHAR(100) UNIQUE NOT NULL,
        module VARCHAR(50) NOT NULL,
        action VARCHAR(50) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Create role_permissions junction table
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
        permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, permission_id)
      );
    `);

    // 4. Insert default system roles
    const roleInserts = [
      { name: 'Super Administrateur', code: 'superadmin', description: 'Accès complet au système', color: '#1F2937', is_system: true },
      { name: 'Administrateur', code: 'admin', description: 'Gestion de l\'école', color: '#EF4444', is_system: true },
      { name: 'Professeur', code: 'teacher', description: 'Gestion des cours et notes', color: '#3B82F6', is_system: true },
      { name: 'Étudiant', code: 'student', description: 'Accès aux cours et examens', color: '#10B981', is_system: true },
      { name: 'Agent', code: 'agent', description: 'Gestion des ventes', color: '#8B5CF6', is_system: true },
    ];

    for (const role of roleInserts) {
      await client.query(`
        INSERT INTO roles (name, code, description, color, is_system)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (code) DO NOTHING
      `, [role.name, role.code, role.description, role.color, role.is_system]);
    }

    // 5. Insert default permissions
    const modules = [
      { module: 'users', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'courses', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'exams', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'grades', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'attendance', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'sales', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'schools', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'announcements', actions: ['view', 'create', 'edit', 'delete'] },
      { module: 'reports', actions: ['view', 'export'] },
      { module: 'settings', actions: ['view', 'edit'] },
    ];

    for (const { module, actions } of modules) {
      for (const action of actions) {
        const code = `${module}.${action}`;
        const name = `${module.charAt(0).toUpperCase() + module.slice(1)} - ${action.charAt(0).toUpperCase() + action.slice(1)}`;

        await client.query(`
          INSERT INTO permissions (name, code, module, action, description)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (code) DO NOTHING
        `, [name, code, module, action, `Permission to ${action} ${module}`]);
      }
    }

    // 6. Assign permissions to SuperAdmin (all permissions)
    await client.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r
      CROSS JOIN permissions p
      WHERE r.code = 'superadmin'
      ON CONFLICT DO NOTHING
    `);

    // 7. Assign permissions to Admin
    const adminPermissions = [
      'users.view', 'users.create', 'users.edit',
      'courses.view', 'courses.create', 'courses.edit', 'courses.delete',
      'exams.view', 'exams.create', 'exams.edit', 'exams.delete',
      'grades.view', 'grades.create', 'grades.edit',
      'attendance.view', 'attendance.create', 'attendance.edit',
      'announcements.view', 'announcements.create', 'announcements.edit', 'announcements.delete',
      'reports.view', 'reports.export',
      'settings.view', 'settings.edit',
    ];

    for (const permCode of adminPermissions) {
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.code = 'admin' AND p.code = $1
        ON CONFLICT DO NOTHING
      `, [permCode]);
    }

    // 8. Assign permissions to Teacher
    const teacherPermissions = [
      'courses.view', 'courses.edit',
      'exams.view', 'exams.create', 'exams.edit',
      'grades.view', 'grades.create', 'grades.edit',
      'attendance.view', 'attendance.create', 'attendance.edit',
      'announcements.view',
      'reports.view',
    ];

    for (const permCode of teacherPermissions) {
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.code = 'teacher' AND p.code = $1
        ON CONFLICT DO NOTHING
      `, [permCode]);
    }

    // 9. Assign permissions to Student
    const studentPermissions = [
      'courses.view',
      'exams.view',
      'grades.view',
      'attendance.view',
      'announcements.view',
    ];

    for (const permCode of studentPermissions) {
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.code = 'student' AND p.code = $1
        ON CONFLICT DO NOTHING
      `, [permCode]);
    }

    // 10. Assign permissions to Agent
    const agentPermissions = [
      'sales.view', 'sales.create',
      'schools.view',
    ];

    for (const permCode of agentPermissions) {
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r, permissions p
        WHERE r.code = 'agent' AND p.code = $1
        ON CONFLICT DO NOTHING
      `, [permCode]);
    }

    console.log('✅ Roles System Migration Completed Successfully');

    res.json({
      success: true,
      message: 'Roles system migration completed successfully'
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
};

/**
 * Run the activity logs system migration
 * POST /api/migrations/activity-logs
 */
exports.runActivityLogsMigration = async (req, res) => {
  let client;
  try {
    const pool = await db.getPool();
    client = await pool.connect();

    console.log('🚀 Starting Activity Logs Migration...');

    // 1. Create activity_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        user_email VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id UUID,
        details JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        status VARCHAR(20) DEFAULT 'success',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON activity_logs(entity_type);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_status ON activity_logs(status);
    `);

    console.log('✅ Activity Logs Migration Completed Successfully');

    res.json({
      success: true,
      message: 'Activity logs system migration completed successfully'
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
};

/**
 * Run the schools schema update migration
 * POST /api/migrations/schools-schema
 */
exports.runSchoolsSchemaMigration = async (req, res) => {
  let client;
  try {
    const pool = await db.getPool();
    client = await pool.connect();

    console.log('🚀 Starting Schools Schema Migration...');

    // Add missing columns to schools table
    await client.query(`
      ALTER TABLE schools 
      ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT 500,
      ADD COLUMN IF NOT EXISTS max_teachers INTEGER DEFAULT 50;
    `);

    console.log('✅ Schools Schema Migration Completed Successfully');

    res.json({
      success: true,
      message: 'Schools schema migration completed successfully'
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
};

/**
 * Run the announcements system migration
 * POST /api/migrations/announcements
 */
exports.runAnnouncementsMigration = async (req, res) => {
  let client;
  try {
    const pool = await db.getPool();
    client = await pool.connect();

    console.log('🚀 Starting Announcements System Migration...');

    // Drop existing table to start fresh
    await client.query(`DROP TABLE IF EXISTS announcements CASCADE;`);

    // Create announcements table
    await client.query(`
      CREATE TABLE announcements (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
        created_by UUID REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        priority VARCHAR(20) DEFAULT 'medium',
        is_pinned BOOLEAN DEFAULT false,
        attachments JSONB,
        target_audience VARCHAR(50) DEFAULT 'all',
        is_published BOOLEAN DEFAULT true,
        published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX idx_announcements_school ON announcements(school_id);
      CREATE INDEX idx_announcements_created_by ON announcements(created_by);
    `);

    console.log('✅ Announcements System Migration Completed Successfully');

    res.json({
      success: true,
      message: 'Announcements system migration completed successfully'
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
};

/**
 * Seed demo data for admin user
 * POST /api/migrations/seed-demo
 */
exports.seedDemoData = async (req, res) => {
  let client;
  const bcrypt = require('bcryptjs');

  try {
    const pool = await db.getPool();
    client = await pool.connect();

    console.log('🌱 Starting Demo Data Seeding...');

    // 1. Create Admin User
    const adminPassword = await bcrypt.hash('admin123', 10);
    const adminResult = await client.query(`
      INSERT INTO users (email, password, full_name, role, phone, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        password = EXCLUDED.password,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role
      RETURNING id
    `, ['admin@example.com', adminPassword, 'Jean-Pierre Duval', 'admin', '+509 3456 7890']);
    const adminId = adminResult.rows[0].id;

    // 2. Create School
    const schoolResult = await client.query(`
      INSERT INTO schools (name, address, phone, email, website, principal_name, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [
      'Collège Saint-Louis de Gonzague',
      '18, Rue du Centre, Pétion-Ville, Haïti',
      '+509 2941 1234',
      'info@stlouis.edu.ht',
      'https://stlouis.edu.ht',
      'Fr. Michel Jean',
      adminId
    ]);

    let schoolId;
    if (schoolResult.rows.length > 0) {
      schoolId = schoolResult.rows[0].id;
    } else {
      const existing = await client.query(`SELECT id FROM schools LIMIT 1`);
      schoolId = existing.rows[0]?.id;
    }

    await client.query(`UPDATE users SET school_id = $1 WHERE id = $2`, [schoolId, adminId]);

    // 3. Create Subjects
    const subjects = [
      { name: 'Mathématiques', code: 'MATH' },
      { name: 'Français', code: 'FRAN' },
      { name: 'Sciences', code: 'PHYS' },
      { name: 'Histoire', code: 'HIST' },
      { name: 'Anglais', code: 'ANGL' }
    ];

    for (const sub of subjects) {
      await client.query(`
        INSERT INTO subjects (name, code, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (code) DO NOTHING
      `, [sub.name, sub.code]);
    }

    // 4. Create Classes
    const classes = ['6ème A', '6ème B', '5ème A', '4ème A', '3ème A'];
    const classIds = [];
    for (const cls of classes) {
      const r = await client.query(`
        INSERT INTO classes (name, grade_level, school_year, created_by, created_at, updated_at)
        VALUES ($1, $2, '2024-2025', $3, NOW(), NOW())
        RETURNING id
      `, [cls, cls.split(' ')[0], adminId]);
      classIds.push(r.rows[0].id);
    }

    // 5. Create Teachers
    const teacherPassword = await bcrypt.hash('teacher123', 10);
    const teachers = [
      { email: 'prof.math@example.com', name: 'Marc Antoine' },
      { email: 'prof.francais@example.com', name: 'Marie Claire' },
      { email: 'prof.sciences@example.com', name: 'Pierre Paul' }
    ];
    const teacherIds = [];
    for (const t of teachers) {
      const r = await client.query(`
        INSERT INTO users (email, password, full_name, role, school_id, created_at, updated_at)
        VALUES ($1, $2, $3, 'teacher', $4, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
        RETURNING id
      `, [t.email, teacherPassword, t.name, schoolId]);
      teacherIds.push(r.rows[0].id);
    }

    // 6. Create Students
    const studentPassword = await bcrypt.hash('student123', 10);
    const studentNames = [
      'Jean-Baptiste Marcel', 'Marie-Louise Pierre', 'Joseph François', 'Anne-Marie Dupont',
      'Paul Jean', 'Claire Saint-Louis', 'Michel Beauvoir', 'Sophie Charles',
      'André Bellefleur', 'Martine Célestin', 'Robert Duval', 'Isabelle Lafontaine',
      'Emmanuel Toussaint', 'Nathalie Mercier', 'Jacques Denis', 'Carole Étienne'
    ];
    for (let i = 0; i < studentNames.length; i++) {
      await client.query(`
        INSERT INTO users (email, password, full_name, role, school_id, created_at, updated_at)
        VALUES ($1, $2, $3, 'student', $4, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
      `, [`student${i + 1}@example.com`, studentPassword, studentNames[i], schoolId]);
    }

    // 7. Create Courses
    const courses = [
      { title: 'Mathématiques 6ème', code: 'MATH6', desc: 'Cours de maths', teacherIdx: 0 },
      { title: 'Français 6ème', code: 'FRAN6', desc: 'Grammaire et littérature', teacherIdx: 1 },
      { title: 'Sciences 6ème', code: 'SCI6', desc: 'Introduction aux sciences', teacherIdx: 2 }
    ];
    for (const c of courses) {
      await client.query(`
        INSERT INTO courses (title, code, description, teacher_id, school_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      `, [c.title, c.code, c.desc, teacherIds[c.teacherIdx], schoolId]);
    }

    // 8. Create Announcements
    const announcements = [
      { title: 'Rentrée Scolaire 2024-2025', content: 'La rentrée est prévue pour le 2 septembre 2024.', priority: 'high', pinned: true },
      { title: 'Examens 1er Trimestre', content: 'Les examens auront lieu du 16 au 20 décembre.', priority: 'high', pinned: true },
      { title: 'Réunion Parents-Professeurs', content: 'Samedi 14 décembre à 9h00.', priority: 'medium', pinned: false },
      { title: 'Activités Sportives', content: 'Championnat de football ce vendredi.', priority: 'low', pinned: false }
    ];
    for (const a of announcements) {
      await client.query(`
        INSERT INTO announcements (school_id, created_by, title, content, priority, is_pinned, target_audience, is_published, published_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'all', true, NOW(), NOW(), NOW())
      `, [schoolId, adminId, a.title, a.content, a.priority, a.pinned]);
    }

    console.log('✅ Demo Data Seeding Completed!');

    res.json({
      success: true,
      message: 'Demo data seeded successfully',
      data: {
        admin: 'admin@example.com / admin123',
        teachers: 'prof.math@example.com / teacher123',
        students: 'student1@example.com to student16@example.com / student123',
        school: 'Collège Saint-Louis de Gonzague',
        classes: classes.length,
        subjects: subjects.length,
        courses: courses.length,
        announcements: announcements.length
      }
    });

  } catch (error) {
    console.error('Seeding error:', error);
    res.status(500).json({
      success: false,
      message: 'Seeding failed',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
};

/**
 * Add school_id to classes table for multi-tenancy
 * POST /api/migrations/add-school-to-classes
 */
exports.addSchoolToClasses = async (req, res) => {
  let client;
  try {
    const pool = await db.getPool();
    client = await pool.connect();

    console.log('🏫 Adding school_id to classes table...');

    // Add school_id column if it doesn't exist
    await client.query(`
      ALTER TABLE classes 
      ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE
    `);

    // Update existing classes with school_id from their creator
    await client.query(`
      UPDATE classes c
      SET school_id = u.school_id
      FROM users u
      WHERE c.created_by = u.id AND c.school_id IS NULL
    `);

    // Create index for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id)
    `);

    console.log('✅ Classes table updated with school_id');

    res.json({
      success: true,
      message: 'School_id added to classes table successfully'
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
};

/**
 * Add school_id to competencies, badges, and report_periods tables
 * POST /api/migrations/add-school-to-pedagogy
 */
exports.addSchoolToPedagogy = async (req, res) => {
  let client;
  try {
    const pool = await db.getPool();
    client = await pool.connect();

    console.log('🎓 Adding school_id to pedagogy tables...');

    // 1. Add school_id to competencies table
    await client.query(`
      ALTER TABLE competencies 
      ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE
    `);
    console.log('✅ Added school_id to competencies');

    // 2. Add school_id to badges table
    await client.query(`
      ALTER TABLE badges 
      ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE
    `);
    console.log('✅ Added school_id to badges');

    // 3. Add school_id to report_periods table
    await client.query(`
      ALTER TABLE report_periods 
      ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE
    `);
    console.log('✅ Added school_id to report_periods');

    // 4. Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_competencies_school ON competencies(school_id);
      CREATE INDEX IF NOT EXISTS idx_badges_school ON badges(school_id);
      CREATE INDEX IF NOT EXISTS idx_report_periods_school ON report_periods(school_id);
    `);
    console.log('✅ Created indexes');

    // 5. Try to update existing records based on who created them (if created_by exists)
    try {
      await client.query(`
        UPDATE competencies c
        SET school_id = u.school_id
        FROM users u
        WHERE c.school_id IS NULL AND c.created_by = u.id
      `);
    } catch (e) {
      console.log('Note: Could not update competencies - no created_by column');
    }

    try {
      await client.query(`
        UPDATE badges b
        SET school_id = u.school_id
        FROM users u
        WHERE b.school_id IS NULL AND b.created_by = u.id
      `);
    } catch (e) {
      console.log('Note: Could not update badges - no created_by column');
    }

    console.log('✅ Pedagogy tables updated with school_id');

    res.json({
      success: true,
      message: 'School_id added to competencies, badges, and report_periods tables successfully'
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
};

/**
 * Add school_id to subjects table
 * POST /api/migrations/add-school-to-subjects
 */
exports.addSchoolToSubjects = async (req, res) => {
  let client;
  try {
    const pool = await db.getPool();
    client = await pool.connect();

    console.log('📚 Adding school_id to subjects table...');

    // 1. Add school_id column if it doesn't exist
    await client.query(`
      ALTER TABLE subjects 
      ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE
    `);
    console.log('✅ Added school_id to subjects');

    // 2. Create index for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_subjects_school ON subjects(school_id)
    `);
    console.log('✅ Created index');

    console.log('✅ Subjects table updated with school_id');

    res.json({
      success: true,
      message: 'School_id added to subjects table successfully'
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
};

/**
 * Add missing fields to users table
 * POST /api/migrations/user-fields
 */
exports.runUserFieldsMigration = async (req, res) => {
  let client;
  try {
    const pool = await db.getPool();
    client = await pool.connect();

    console.log('👤 Adding missing fields to users table...');

    // Add missing columns to users table
    await client.query(`
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
    `);

    // Add foreign key for class_id
    try {
      await client.query(`
        ALTER TABLE users 
        DROP CONSTRAINT IF EXISTS fk_users_class;

        ALTER TABLE users 
        ADD CONSTRAINT fk_users_class 
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;
      `);
    } catch (e) {
      console.log('Note: Could not add fk_users_class constraint (classes table might not exist or id type mismatch)');
    }

    console.log('✅ Users table updated with missing fields');

    res.json({
      success: true,
      message: 'Users table updated with missing fields successfully'
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
};

/**
 * Add online fields and attachment support to lessons
 * POST /api/migrations/lesson-online-fields
 */
exports.runLessonOnlineMsg = async (req, res) => {
  let client;
  try {
    const pool = await db.getPool();
    client = await pool.connect();

    console.log('💻 Adding online fields to lessons table...');

    // Add meeting_link and is_online columns
    await client.query(`
      ALTER TABLE lessons
      ADD COLUMN IF NOT EXISTS meeting_link TEXT,
      ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
    `);

    console.log('✅ Lessons table updated with online fields');

    res.json({
      success: true,
      message: 'Lessons table updated with online fields successfully'
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
};

/**
 * Run missing e-learning tables migration
 * POST /api/migrations/missing-tables
 */
exports.runMissingTablesMigration = async (req, res) => {
  let client;
  try {
    const pool = await db.getPool();
    client = await pool.connect();

    const fs = require('fs');
    const path = require('path');

    console.log('🏗️ Creating missing e-learning tables...');

    const sql = fs.readFileSync(path.join(__dirname, '../../migrations/013_create_missing_elearning_tables.sql'), 'utf8');
    await client.query(sql);

    console.log('✅ Tables created successfully');

    res.json({
      success: true,
      message: 'Missing tables created successfully'
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
};

/**
 * Run migration to link courses to subjects
 * POST /api/migrations/link-courses-subjects
 */
exports.runLinkCoursesToSubjects = async (req, res) => {
  let client;
  try {
    const pool = await db.getPool();
    client = await pool.connect();

    const fs = require('fs');
    const path = require('path');

    console.log('🔗 Linking courses to subjects...');

    // Check if file exists, if not use inline SQL
    const migrationPath = path.join(__dirname, '../../migrations/014_add_subject_id_to_courses.sql');
    let sql;

    if (fs.existsSync(migrationPath)) {
      sql = fs.readFileSync(migrationPath, 'utf8');
    } else {
      sql = `
        ALTER TABLE courses 
        ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_courses_subject_id ON courses(subject_id);
        `;
    }

    await client.query(sql);

    console.log('✅ Courses linked to subjects successfully');

    res.json({
      success: true,
      message: 'Migration completed successfully'
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
};

/**
 * Run migration to fix assignments table schema
 * POST /api/migrations/fix-assignments
 */
exports.runFixAssignmentsSchema = async (req, res) => {
  let client;
  try {
    const pool = await db.getPool();
    client = await pool.connect();

    console.log('🔧 Fixing assignments table schema...');

    // Add missing columns to assignments table
    const sql = `
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
    `;

    await client.query(sql);

    console.log('✅ Assignments table schema fixed successfully');

    res.json({
      success: true,
      message: 'Assignments table schema fixed successfully'
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
};

