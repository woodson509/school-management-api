/**
 * Check current database schema
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    process.exit(1);
}

async function checkSchema() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected!\n');

        // Check schools table columns
        console.log('📊 Checking schools table structure...\n');
        const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'schools'
      ORDER BY ordinal_position
    `);

        if (result.rows.length === 0) {
            console.log('❌ Schools table does not exist!');
        } else {
            console.log('Schools table columns:');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            result.rows.forEach(row => {
                console.log(`  ${row.column_name.padEnd(25)} ${row.data_type.padEnd(20)} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
            });
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }

        // Count schools
        const countResult = await client.query('SELECT COUNT(*) FROM schools');
        console.log(`Total schools in database: ${countResult.rows[0].count}\n`);

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
    } finally {
        await client.end();
        console.log('👋 Connection closed.');
    }
}

checkSchema();
