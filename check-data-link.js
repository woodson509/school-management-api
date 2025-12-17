const db = require('./src/config/database');

const run = async () => {
    const client = await db.getClient();
    try {
        const courseId = '94482bd0-543e-4c73-b2b2-a9ce78ef7833'; // From user logs

        console.log('--- CHECKING COURSE ---');
        const courseRes = await client.query(`
        SELECT c.id, c.title, c.subject_id, s.name as subject_name, s.code as subject_code
        FROM courses c
        LEFT JOIN subjects s ON c.subject_id = s.id
        WHERE c.id = $1
    `, [courseId]);
        console.log(courseRes.rows[0]);

        console.log('--- CHECKING EXAM ---');
        // Using the exam ID mentioned in user logs
        const examRes = await client.query(`
        SELECT e.id, e.title, e.course_id 
        FROM exams e 
        WHERE e.course_id = $1
    `, [courseId]);
        console.log('Exams found:', examRes.rows.length);
        if (examRes.rows.length > 0) console.log(examRes.rows[0]);

        console.log('--- CHECKING RECENT GRADES ---');
        const gradesRes = await client.query(`
        SELECT id, value, student_id, subject_id, exam_id 
        FROM grades 
        WHERE exam_id IN (SELECT id FROM exams WHERE course_id = $1)
        ORDER BY created_at DESC 
        LIMIT 5
    `, [courseId]);
        console.log('Recent grades:', gradesRes.rows);

    } catch (error) {
        console.error(error);
    } finally {
        client.release();
        process.exit();
    }
};

run();
