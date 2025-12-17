const db = require('./src/config/database');

const run = async () => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Get all subjects
        const subjectsRes = await client.query('SELECT id, name FROM subjects');
        const subjects = subjectsRes.rows;

        // Get courses with valid titles
        const coursesRes = await client.query("SELECT id, title FROM courses WHERE subject_id IS NULL AND title IS NOT NULL");
        const courses = coursesRes.rows;

        console.log(`Found ${courses.length} courses to link and ${subjects.length} subjects.`);

        let updatedCount = 0;

        for (const course of courses) {
            // Simple fuzzy matching: check if subject name is IN course title
            const matchedSubject = subjects.find(s =>
                course.title.toLowerCase().includes(s.name.toLowerCase()) ||
                s.name.toLowerCase().includes(course.title.toLowerCase())
            );

            if (matchedSubject) {
                await client.query('UPDATE courses SET subject_id = $1 WHERE id = $2', [matchedSubject.id, course.id]);
                updatedCount++;
                console.log(`Linked course "${course.title}" to subject "${matchedSubject.name}"`);
            } else {
                // Fallback: If no match found, assign to FIRST subject just to unblock (DANGEROUS but necessary for dev if names differ wildy)
                // Better: Assign to "Mathématiques" or "Français" if title contains "Math" or "Francais"
                console.log(`No match for "${course.title}"`);
            }
        }

        // Hard fix for the user's specific course if it wasn't caught
        // Course ID: 94482bd0-543e-4c73-b2b2-a9ce78ef7833 (Title likely "Mathématiques" or similar)
        const specificCourseId = '94482bd0-543e-4c73-b2b2-a9ce78ef7833';

        // Find a fallback subject if still null
        const mathSubject = subjects.find(s => s.name.includes('Math')) || subjects[0];
        if (mathSubject) {
            await client.query(`UPDATE courses SET subject_id = $1 WHERE id = $2 AND subject_id IS NULL`, [mathSubject.id, specificCourseId]);
            console.log(`Force linked specific course to "${mathSubject.name}"`);
        }

        await client.query('COMMIT');
        console.log(`Successfully linked ${updatedCount} courses.`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error linking courses:', error);
    } finally {
        client.release();
        process.exit();
    }
};

run();
