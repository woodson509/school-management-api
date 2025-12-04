const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    process.exit(1);
}

async function runMigration() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected!');

        const migrationPath = path.join(__dirname, 'src', 'migrations', '012_create_announcements.sql');
        console.log(`📖 Reading migration file: ${migrationPath}`);

        if (!fs.existsSync(migrationPath)) {
            throw new Error(`Migration file not found at ${migrationPath}`);
        }

        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('🚀 Executing migration...');
        await client.query(sql);

        console.log('✅ Migration executed successfully!');
        console.log('   - Created table: announcements');
        console.log('   - Created indexes');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('👋 Connection closed.');
    }
}

runMigration();
