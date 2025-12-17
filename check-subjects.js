const db = require('./src/config/database');

const run = async () => {
    const client = await db.getClient();
    try {
        console.log('--- SUBJECTS SCHEMA ---');
        const schemaRes = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'subjects'
    `);
        console.log(schemaRes.rows.map(r => r.column_name).join(', '));

        console.log('--- ALL SUBJECTS SAMPLE ---');
        const subRes = await client.query(`
        SELECT id, name, code, school_id 
        FROM subjects 
        LIMIT 20
    `);
        console.log(subRes.rows);

    } catch (error) {
        console.error(error);
    } finally {
        client.release();
        process.exit();
    }
};

run();
