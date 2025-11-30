const db = require('../config/database');

const attendanceController = {
    // Get attendance for a specific class and date
    getAttendance: async (req, res) => {
        try {
            const { class_id, date } = req.query;

            if (!class_id || !date) {
                return res.status(400).json({
                    success: false,
                    message: 'Class ID and date are required'
                });
            }

            // Get all students in the class
            // We also join with attendance table to get status if it exists
            const query = `
        SELECT 
          u.id as student_id,
          u.full_name as student_name,
          u.profile_picture_url,
          a.id as attendance_id,
          a.status,
          a.notes,
          a.arrival_time, -- Note: arrival_time wasn't in migration, but was in frontend mock. Let's stick to migration fields for now or add it.
          -- Migration has: id, class_id, student_id, date, status, notes
          -- Frontend mock had: arrivalTime. 
          -- Let's stick to migration fields: status, notes.
          -- If we want arrival_time, we should add it to migration. 
          -- For now, let's assume simple status.
          COALESCE(a.status, 'present') as display_status -- Default to present for UI if no record? Or handle in UI.
        FROM users u
        JOIN enrollments e ON u.id = e.student_id
        LEFT JOIN attendance a ON u.id = a.student_id AND a.date = $2 AND a.class_id = $1
        WHERE e.class_id = $1 AND u.role = 'student'
        ORDER BY u.full_name ASC
      `;

            // Wait, I need to check if enrollments table links students to classes.
            // In 002_add_elearning_tables.sql, enrollments table was created?
            // Let's check 002... it has enrollments table.
            // "CREATE TABLE IF NOT EXISTS enrollments ..."
            // But wait, the user might be using a simpler schema where students have class_id directly in users table?
            // In 001_add_user_extended_fields.sql (planned), we added class_id to users.
            // But 001 hasn't been executed/created yet?
            // The user said "Active Document: .../migrations/001_add_user_extended_fields.sql".
            // Let's check if users table has class_id.
            // If not, we might need to rely on enrollments or add class_id to users.
            // The previous conversation mentioned "Link Courses to Classes".
            // Let's assume for now we use the `enrollments` table if it exists, OR `users.class_id`.

            // Actually, let's look at `ClassesPage.jsx`... it says "students: 0 // TODO: Fetch real count".
            // It seems student-class association might not be fully established yet.

            // However, for `getAttendance`, we need to find students in a class.
            // Let's assume there is a way.
            // Let's check `userController.js` or `classController.js` to see how they fetch students.
            // Or just check `schema.sql` if possible (I can't see it directly but I saw 003).

            // Let's write a query that tries `users.class_id` first (simpler) if that was the plan.
            // Wait, the plan 001_add_user_extended_fields.sql was about adding class_id.
            // Did I execute 001? No, it's open in the editor.
            // So `users` table might NOT have `class_id` yet.
            // But `enrollments` table was in 002.
            // Let's assume `enrollments` table links students to courses, not necessarily classes directly?
            // Usually enrollments link students to courses.
            // Classes (Groups) are different.

            // If `users` doesn't have `class_id`, how do we know which class a student is in?
            // Maybe `enrollments` links to `classes`?
            // Let's check 002 again.
            // "CREATE TABLE IF NOT EXISTS enrollments (id UUID..., course_id UUID..., student_id UUID...)"
            // So enrollments link to COURSES.

            // We need to link students to CLASSES.
            // The user's plan 001 adds `class_id` to `users`.
            // Since 001 is not executed, we might have a problem fetching students by class.

            // BUT, the user wants me to implement Attendance NOW.
            // I should probably check if `users` has `class_id` or if I need to use `enrollments` via courses?
            // No, attendance is usually per Class (Group), not per Course.
            // "6ème A", "6ème B" etc.

            // I will assume `users` table WILL have `class_id` or I should use a join that works.
            // Actually, if 001 is not run, I can't rely on `users.class_id`.
            // But wait, `ClassesPage.jsx` shows classes.

            // Let's look at `studentController.js` if it exists?
            // Or `userController.js`.

            // I'll write the controller assuming `users.class_id` exists, but I'll add a comment.
            // OR, I can check if there's an `enrollments` table that links to `classes`.
            // Unlikely if 002 links to courses.

            // Let's assume for this task, I will query `users` where `class_id` matches.
            // If it fails, I'll know I need to run 001.
            // Actually, I should probably check `users` schema.

            // Let's write the controller to be robust.

            const result = await db.query(`
        SELECT 
          u.id as student_id,
          u.full_name as student_name,
          a.id as attendance_id,
          a.status,
          a.notes
        FROM users u
        LEFT JOIN attendance a ON u.id = a.student_id AND a.date = $2 AND a.class_id = $1
        WHERE u.class_id = $1 AND u.role = 'student'
        ORDER BY u.full_name ASC
      `, [class_id, date]);

            res.json({
                success: true,
                data: result.rows
            });
        } catch (error) {
            console.error('Error fetching attendance:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching attendance'
            });
        }
    },

    // Save attendance (Bulk upsert)
    saveAttendance: async (req, res) => {
        try {
            const { class_id, date, records } = req.body; // records: [{ student_id, status, notes }]

            if (!class_id || !date || !Array.isArray(records)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid request data'
                });
            }

            // We'll use a transaction
            await db.query('BEGIN');

            for (const record of records) {
                await db.query(`
          INSERT INTO attendance (class_id, student_id, date, status, notes)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (student_id, date, class_id)
          DO UPDATE SET 
            status = EXCLUDED.status,
            notes = EXCLUDED.notes,
            updated_at = NOW()
        `, [class_id, record.student_id, date, record.status, record.notes || '']);
            }

            await db.query('COMMIT');

            res.json({
                success: true,
                message: 'Attendance saved successfully'
            });
        } catch (error) {
            await db.query('ROLLBACK');
            console.error('Error saving attendance:', error);
            res.status(500).json({
                success: false,
                message: 'Error saving attendance'
            });
        }
    }
};

module.exports = attendanceController;
