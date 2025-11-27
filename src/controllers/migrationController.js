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
        process.exit(1);
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
