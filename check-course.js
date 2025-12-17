const db = require('./src/config/database');

const check = async () => {
    try {
        const res = await db.query(
            "SELECT id, title, subject_id FROM courses WHERE id = '94482bd0-543e-4c73-b2b2-a9ce78ef7833'"
        );
        console.log(res.rows[0]);
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
};

check();
