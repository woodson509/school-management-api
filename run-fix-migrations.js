/**
 * Run Fix Migrations Script
 * Executes the fix_migrations.sql file using the application's database configuration
 */

const fs = require('fs');
const path = require('path');
const db = require('./src/config/database');

async function runMigration() {
    try {
        console.log('🔄 Connecting to database via app config...');

        // Test connection
        await db.query('SELECT NOW()');
        console.log('✅ Connected successfully!\n');

        // Read the SQL file
        const sqlFile = path.join(__dirname, 'migrations', 'fix_migrations.sql');
        console.log(`📄 Reading SQL file: ${sqlFile}`);
        const sql = fs.readFileSync(sqlFile, 'utf8');

        console.log('🚀 Executing migration...\n');
        await db.query(sql);

        console.log('\n✅ Migration completed successfully!');
        console.log('📊 Tables created/verified.');

    } catch (error) {
        console.error('\n❌ Migration failed!');
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        // Close the pool to allow script to exit
        // db module exports pool directly
        if (db.pool) {
            await db.pool.end();
            console.log('🔌 Connection closed.');
        }
    }
}

runMigration();
