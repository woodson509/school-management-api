/**
 * Add sample school to database
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    process.exit(1);
}

async function addSampleSchool() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected!\n');

        // Get superadmin user ID
        const userResult = await client.query(`
      SELECT id FROM users WHERE role = 'superadmin' LIMIT 1
    `);

        if (userResult.rows.length === 0) {
            console.error('❌ No superadmin user found!');
            process.exit(1);
        }

        const superadminId = userResult.rows[0].id;

        // Insert sample school
        console.log('🏫 Adding sample school...');
        const result = await client.query(`
      INSERT INTO schools (name, address, phone, email, website, principal_name, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
            'École Exemple EDIKA',
            'Port-au-Prince, Haïti',
            '+509 1234-5678',
            'contact@edika-example.edu.ht',
            'https://www.edika-example.edu.ht',
            'Jean-Pierre Duval',
            superadminId
        ]);

        console.log('✅ Sample school added successfully!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 School Details:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`ID:        ${result.rows[0].id}`);
        console.log(`Name:      ${result.rows[0].name}`);
        console.log(`Address:   ${result.rows[0].address}`);
        console.log(`Phone:     ${result.rows[0].phone}`);
        console.log(`Email:     ${result.rows[0].email}`);
        console.log(`Principal: ${result.rows[0].principal_name}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        if (error.message.includes('does not exist')) {
            console.error('\n⚠️  The "schools" table does not exist yet!');
            console.error('   Run: node setup-database.js first\n');
        }
        process.exit(1);
    } finally {
        await client.end();
        console.log('👋 Connection closed.');
    }
}

addSampleSchool();
