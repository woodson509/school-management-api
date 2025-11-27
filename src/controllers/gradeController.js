/**
 * Grade Controller
 * Handles fetching and updating student grades (exam attempts)
 */

const db = require('../config/database');

/**
 * Get all grades (submitted exam attempts)
 * GET /api/grades
 * Access: Admin, Teacher
 */
const getAllGrades = async (req, res) => {
    try {
        const { class_id, subject_id, student_name } = req.query;

        // Base query
        let query = `
      SELECT 
        ea.id,
        ea.exam_id,
        ea.student_id,
        ea.score,
        ea.status,
        ea.submitted_at,
        u.full_name as student_name,
        e.title as exam_title,
        e.total_marks as max_score,
        c.title as subject_name,
        c.code as subject_code
      FROM exam_attempts ea
      JOIN users u ON ea.student_id = u.id
      JOIN exams e ON ea.exam_id = e.id
      JOIN courses c ON e.course_id = c.id
      WHERE ea.status IN ('submitted', 'graded')
    `;

        const params = [];
        let paramCount = 1;

        // Filter by school
        query += ` AND c.school_id = $${paramCount}`;
        params.push(req.user.school_id);
        paramCount++;

        // Filter by teacher (only see grades for their courses)
        if (req.user.role === 'teacher') {
            query += ` AND c.teacher_id = $${paramCount}`;
            params.push(req.user.id);
            paramCount++;
        }

        // Optional filters
        if (student_name) {
            query += ` AND u.full_name ILIKE $${paramCount}`;
            params.push(`%${student_name}%`);
            paramCount++;
        }

        // Note: class_id filter would require joining with a student_classes table or similar, 
        // which we might not have yet. Skipping for now.

        query += ' ORDER BY ea.submitted_at DESC';

        const result = await db.query(query, params);

        // Map result to match frontend expectation
        const grades = result.rows.map(row => ({
            id: row.id,
            student: row.student_name,
            class: 'Non défini', // Placeholder until we have class info
            subject: row.subject_name,
            exam: row.exam_title,
            score: row.score,
            maxScore: row.max_score,
            date: row.submitted_at ? new Date(row.submitted_at).toISOString().split('T')[0] : 'N/A',
            status: row.status === 'graded' ? 'published' : 'pending'
        }));

        res.status(200).json({
            success: true,
            data: grades,
            count: grades.length
        });

    } catch (error) {
        console.error('Get grades error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch grades',
            error: error.message
        });
    }
};

/**
 * Update a grade (score)
 * PUT /api/grades/:id
 * Access: Admin, Teacher
 */
const updateGrade = async (req, res) => {
    try {
        const { id } = req.params;
        const { score } = req.body;

        // Verify attempt exists and user has permission
        const attemptCheck = await db.query(
            `SELECT ea.*, c.teacher_id, c.school_id, e.total_marks
       FROM exam_attempts ea
       JOIN exams e ON ea.exam_id = e.id
       JOIN courses c ON e.course_id = c.id
       WHERE ea.id = $1`,
            [id]
        );

        if (attemptCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Exam attempt not found'
            });
        }

        const attempt = attemptCheck.rows[0];

        // Authorization
        if (attempt.school_id !== req.user.school_id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        if (req.user.role === 'teacher' && attempt.teacher_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You can only grade exams for your own courses'
            });
        }

        // Validation
        if (score < 0 || score > attempt.total_marks) {
            return res.status(400).json({
                success: false,
                message: `Score must be between 0 and ${attempt.total_marks}`
            });
        }

        // Update score and status
        const result = await db.query(
            `UPDATE exam_attempts
       SET score = $1, status = 'graded'
       WHERE id = $2
       RETURNING *`,
            [score, id]
        );

        res.status(200).json({
            success: true,
            message: 'Grade updated successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Update grade error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update grade',
            error: error.message
        });
    }
};

module.exports = {
    getAllGrades,
    updateGrade
};
