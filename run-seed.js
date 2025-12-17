const db = require('./src/config/database');
const fs = require('fs');
const path = require('path');

const run = async () => {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'seed-periods.sql'), 'utf8');
        await db.query(sql);
        console.log('Seeded report periods successfully');
    } catch (error) {
        console.error('Error seeding:', error);
    } finally {
        process.exit();
    }
};

run();
