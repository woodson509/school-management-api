/**
 * Create missing database tables and test users
 * Run this script ONCE to set up the complete database schema
 */

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    process.exit(1);
}

async function setupDatabase() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected!\n');

        // Create schools table
        console.log('📊 Creating schools table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS schools (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        address TEXT,
        phone VARCHAR(50),
        email VARCHAR(255),
        website VARCHAR(255),
        principal_name VARCHAR(255),
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('✅ Schools table ready\n');

        // Create classes table
        console.log('📊 Creating classes table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        grade_level VARCHAR(50) NOT NULL,
        school_year VARCHAR(20) NOT NULL,
        teacher_id UUID REFERENCES users(id),
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('✅ Classes table ready\n');

        // Create subjects table
        console.log('📊 Creating subjects table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        credits INTEGER DEFAULT 1,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('✅ Subjects table ready\n');

        // Create test users
        console.log('👥 Creating test users...');

        const users = [
            {
                email: 'admin@school.com',
                password: 'admin123',
                full_name: 'Administrateur École',
                role: 'admin'
            },
            {
                email: 'teacher@school.com',
                password: 'teacher123',
                full_name: 'Professeur Test',
                role: 'teacher'
            },
            {
                email: 'student@school.com',
                password: 'student123',
                full_name: 'Élève Test',
                role: 'student'
            },
            {
                email: 'agent@school.com',
                password: 'agent123',
                full_name: 'Agent Commercial',
                role: 'agent'
            }
        ];

        for (const user of users) {
            const hashedPassword = await bcrypt.hash(user.password, 10);

            try {
                await client.query(`
          INSERT INTO users (email, password, full_name, role, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
          ON CONFLICT (email) DO UPDATE SET
            password = EXCLUDED.password,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            updated_at = NOW()
        `, [user.email, hashedPassword, user.full_name, user.role]);

                console.log(`✅ ${user.role.toUpperCase().padEnd(10)} - ${user.email} (password: ${user.password})`);
            } catch (err) {
                console.error(`❌ Error creating ${user.email}:`, err.message);
            }
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 Database setup complete!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n📋 Test Users Created:');
        console.log('');
        console.log('Role       | Email                  | Password');
        console.log('-----------|------------------------|----------');
        console.log('Admin      | admin@school.com       | admin123');
        console.log('Teacher    | teacher@school.com     | teacher123');
        console.log('Student    | student@school.com     | student123');
        console.log('Agent      | agent@school.com       | agent123');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await client.end();
        console.log('👋 Connection closed.');
    }
}

setupDatabase();
