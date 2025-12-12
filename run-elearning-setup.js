const fs = require('fs');
const path = require('path');
const db = require('./src/config/database');

async function run() {
    let client;
    try {
        console.log('Connecting to database...');
        client = await db.getClient();

        console.log('Running 002_add_elearning_tables.sql...');
        const sql002 = fs.readFileSync(path.join(__dirname, 'migrations', '002_add_elearning_tables.sql'), 'utf8');
        await client.query(sql002);
        console.log('✅ 002 Success.');

        console.log('Running 012_add_lesson_online_fields.sql...');
        const sql012 = fs.readFileSync(path.join(__dirname, 'migrations', '012_add_lesson_online_fields.sql'), 'utf8');
        await client.query(sql012);
        console.log('✅ 012 Success.');

    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    } finally {
        if (client) client.release();
        process.exit(0);
    }
}

run();
