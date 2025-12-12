const db = require('./src/config/database');

async function listSubjects() {
    let client;
    try {
        console.log('Connecting...');
        const pool = await db.getPool();
        client = await pool.connect();
        console.log('Connected. Querying...');
        const res = await client.query('SELECT name, code, description FROM subjects');
        console.log('Current Subjects:', JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        if (client) client.release();
        process.exit(0);
    }
}

listSubjects();
