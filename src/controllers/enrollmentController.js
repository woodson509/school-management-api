/**
 * Enrollment Controller
 * Handles student enrollments in courses
 */

const db = require('../config/database');

/**
 * Enroll student in a course
 * POST /api/enrollments
 */
exports.enrollStudent = async (req, res) => {
    try {
        const { course_id, student_id } = req.body;
        const pool = await db.getPool();

        // Verify course exists
        const courseCheck = await pool.query(
            'SELECT id, school_id FROM courses WHERE id = $1',
            [course_id]
        );

        if (courseCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // Verify student exists and belongs to same school
        const studentCheck = await pool.query(
            'SELECT id, school_id FROM users WHERE id = $1 AND role = $2',
            [student_id, 'student']
        );

        if (studentCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        if (studentCheck.rows[0].school_id !== courseCheck.rows[0].school_id) {
            return res.status(403).json({
                success: false,
                message: 'Student does not belong to this school'
            });
        }

        // Check if already enrolled
        const enrollmentCheck = await pool.query(
            'SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2',
            [course_id, student_id]
        );

        if (enrollmentCheck.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Student already enrolled in this course'
            });
        }

        // Create enrollment
        const query = `
      INSERT INTO enrollments (course_id, student_id, enrolled_at, status)
      VALUES ($1, $2, NOW(), 'active')
      RETURNING *
    `;

        const result = await pool.query(query, [course_id, student_id]);

        res.status(201).json({
            success: true,
            message: 'Student enrolled successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error enrolling student:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to enroll student',
            error: error.message
        });
    }
};

/**
 * Get enrollments for a course
 * GET /api/courses/:courseId/enrollments
 */
exports.getEnrollmentsByCourse = async (req, res) => {
    try {
        const { courseId } = req.params;
        const pool = await db.getPool();

        const query = `
      SELECT 
        e.*,
        u.full_name as student_name,
        u.email as student_email,
        u.student_id_number
      FROM enrollments e
      JOIN users u ON e.student_id = u.id
      WHERE e.course_id = $1
      ORDER BY u.full_name ASC
    `;

        const result = await pool.query(query, [courseId]);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching enrollments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch enrollments',
            error: error.message
        });
    }
};

/**
 * Get courses for a student
 * GET /api/students/:studentId/enrollments
 */
exports.getEnrollmentsByStudent = async (req, res) => {
    try {
        const { studentId } = req.params;
        const pool = await db.getPool();

        const query = `
      SELECT 
        e.*,
        c.title as course_title,
        c.code as course_code,
        c.description as course_description,
        u.full_name as teacher_name
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      LEFT JOIN users u ON c.teacher_id = u.id
      WHERE e.student_id = $1
      ORDER BY e.enrolled_at DESC
    `;

        const result = await pool.query(query, [studentId]);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching student enrollments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch enrollments',
            error: error.message
        });
    }
};

/**
 * Update enrollment (progress, grade, status)
 * PUT /api/enrollments/:id
 */
exports.updateEnrollment = async (req, res) => {
    try {
        const { id } = req.params;
        const { progress_percentage, final_grade, status } = req.body;
        const pool = await db.getPool();

        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (progress_percentage !== undefined) {
            updates.push(`progress_percentage = $${paramIndex}`);
            params.push(progress_percentage);
            paramIndex++;
        }

        if (final_grade !== undefined) {
            updates.push(`final_grade = $${paramIndex}`);
            params.push(final_grade);
            paramIndex++;
        }

        if (status !== undefined) {
            updates.push(`status = $${paramIndex}`);
            params.push(status);
            paramIndex++;

            if (status === 'completed') {
                updates.push(`completed_at = NOW()`);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        updates.push(`updated_at = NOW()`);
        params.push(id);

        const query = `
      UPDATE enrollments
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Enrollment not found'
            });
        }

        res.json({
            success: true,
            message: 'Enrollment updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating enrollment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update enrollment',
            error: error.message
        });
    }
};

/**
 * Unenroll student from course
 * DELETE /api/enrollments/:id
 */
exports.unenrollStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await db.getPool();

        await pool.query('DELETE FROM enrollments WHERE id = $1', [id]);

        res.json({
            success: true,
            message: 'Student unenrolled successfully'
        });
    } catch (error) {
        console.error('Error unenrolling student:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unenroll student',
            error: error.message
        });
    }
};
