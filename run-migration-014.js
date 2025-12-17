const db = require('./src/config/database');
const fs = require('fs');
const path = require('path');

const run = async () => {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'migrations', '014_add_subject_id_to_courses.sql'), 'utf8');
        await db.query(sql);
        console.log('Migration 014 executed successfully');
    } catch (error) {
        console.error('Error running migration:', error);
    } finally {
        process.exit();
    }
};

run();
