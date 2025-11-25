/**
 * Simple script to create a superadmin user in Supabase
 */

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    process.exit(1);
}

async function createSuperAdmin() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected!');

        // Hash the password
        const password = 'SuperAdmin123!';
        console.log('🔐 Hashing password...');
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert or update superadmin
        console.log('👤 Creating superadmin user...');
        const query = `
      INSERT INTO users (email, password, full_name, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (email) 
      DO UPDATE SET 
        password = EXCLUDED.password,
        role = EXCLUDED.role,
        updated_at = NOW()
      RETURNING id, email, full_name, role;
    `;

        const result = await client.query(query, [
            'superadmin@school.com',
            hashedPassword,
            'Super Administrator',
            'superadmin'
        ]);

        console.log('✅ Superadmin user created/updated successfully!');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📧 Email:    superadmin@school.com');
        console.log('🔑 Password: SuperAdmin123!');
        console.log('👤 Role:     superadmin');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('👋 Connection closed.');
    }
}

createSuperAdmin();
