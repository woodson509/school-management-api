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
      { name: 'Mathématiques', code: 'MATH', credits: 4 },
      { name: 'Français', code: 'FRAN', credits: 4 },
      { name: 'Sciences', code: 'PHYS', credits: 3 },
      { name: 'Histoire', code: 'HIST', credits: 2 },
      { name: 'Anglais', code: 'ANGL', credits: 3 }
    ];

    for (const sub of subjects) {
      await client.query(`
        INSERT INTO subjects (name, code, credits, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (code) DO NOTHING
      `, [sub.name, sub.code, sub.credits, adminId]);
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
      { title: 'Mathématiques 6ème', desc: 'Cours de maths', teacherIdx: 0 },
      { title: 'Français 6ème', desc: 'Grammaire et littérature', teacherIdx: 1 },
      { title: 'Sciences 6ème', desc: 'Introduction aux sciences', teacherIdx: 2 }
    ];
    for (const c of courses) {
      await client.query(`
        INSERT INTO courses (title, description, teacher_id, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
      `, [c.title, c.desc, teacherIds[c.teacherIdx]]);
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
