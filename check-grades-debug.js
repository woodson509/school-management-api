require('dotenv').config();
const db = require('./src/config/database');

const run = async () => {
    const client = await db.getClient();
    try {
        console.log('--- LATEST GRADES ---');
        // Get the last 10 grades to see what was just saved
        const res = await client.query(`
        SELECT id, student_id, exam_id, subject_id, value, created_at 
        FROM grades 
        ORDER BY created_at DESC 
        LIMIT 10
    `);
        console.log(res.rows);

        if (res.rows.length > 0) {
            const lastExamId = res.rows[0].exam_id;
            if (lastExamId) {
                console.log(`--- CHECKING EXAM ${lastExamId} ---`);
                // Check if this exam exists
                const examRes = await client.query('SELECT * FROM exams WHERE id = $1', [lastExamId]);
                console.log('Exam:', examRes.rows[0]);

                // Check if grades retrieval works with join
                const joinRes = await client.query(`
                SELECT g.id, s.name as subject_name
                FROM grades g
                JOIN subjects s ON g.subject_id = s.id
                WHERE g.exam_id = $1
            `, [lastExamId]);
                console.log(`Join matches: ${joinRes.rows.length}`);
                if (joinRes.rows.length === 0) console.log('Buffers? Constraints? Why join fails?');
            } else {
                console.log('Last grade has NO exam_id!');
            }
        }

    } catch (error) {
        console.error(error);
    } finally {
        client.release();
        process.exit();
    }
};

run();
