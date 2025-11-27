/**
 * Setup Roles & Permissions System
 * Run this script ONCE to create the necessary tables
 */

const { Client } = require('pg');
require('dotenv').config();

const setupRolesSystem = async () => {
  let client;

  // Configure client based on environment
  if (process.env.DATABASE_URL) {
    const sslConfig = process.env.DATABASE_URL.includes('localhost')
      ? false
      : { rejectUnauthorized: false };

    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig
    });
  } else {
    // Fallback to default local configuration
    client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'school_management',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    });
  }

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // 1. Create roles table
    console.log('📊 Creating roles table...');
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
    console.log('✅ Roles table created\n');

    // 2. Create permissions table
    console.log('📊 Creating permissions table...');
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
    console.log('✅ Permissions table created\n');

    // 3. Create role_permissions junction table
    console.log('📊 Creating role_permissions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
        permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, permission_id)
      );
    `);
    console.log('✅ Role_permissions table created\n');

    // 4. Insert default system roles
    console.log('👥 Creating default system roles...');
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
    console.log('✅ System roles created\n');

    // 5. Insert default permissions
    console.log('🔐 Creating permissions...');
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
    console.log('✅ Permissions created\n');

    // 6. Assign permissions to SuperAdmin (all permissions)
    console.log('🔑 Assigning permissions to SuperAdmin...');
    await client.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r
      CROSS JOIN permissions p
      WHERE r.code = 'superadmin'
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ SuperAdmin permissions assigned\n');

    // 7. Assign permissions to Admin
    console.log('🔑 Assigning permissions to Admin...');
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
    console.log('✅ Admin permissions assigned\n');

    // 8. Assign permissions to Teacher
    console.log('🔑 Assigning permissions to Teacher...');
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
    console.log('✅ Teacher permissions assigned\n');

    // 9. Assign permissions to Student
    console.log('🔑 Assigning permissions to Student...');
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
    console.log('✅ Student permissions assigned\n');

    // 10. Assign permissions to Agent
    console.log('🔑 Assigning permissions to Agent...');
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
    console.log('✅ Agent permissions assigned\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Roles & Permissions System Setup Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Display summary
    const rolesCount = await client.query('SELECT COUNT(*) FROM roles');
    const permsCount = await client.query('SELECT COUNT(*) FROM permissions');
    const assignmentsCount = await client.query('SELECT COUNT(*) FROM role_permissions');

    console.log('📊 Summary:');
    console.log(`  Roles created: ${rolesCount.rows[0].count}`);
    console.log(`  Permissions created: ${permsCount.rows[0].count}`);
    console.log(`  Permission assignments: ${assignmentsCount.rows[0].count}`);
    console.log('');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('👋 Connection closed.');
  }
};

setupRolesSystem();
