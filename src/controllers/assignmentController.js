const db = require('../config/database');

const assignmentController = {
    // Get all assignments (filtered by role)
    getAll: async (req, res) => {
        try {
            const { id, role, school_id } = req.user;
            const pool = await db.getPool();
            let query = '';
            let params = [];

            if (role === 'teacher') {
                query = `
                    SELECT a.*, c.title as course_title, c.code as course_code, c.class_id, cl.name as class_name
                    FROM assignments a
                    JOIN courses c ON a.course_id = c.id
                    LEFT JOIN classes cl ON c.class_id = cl.id
                    WHERE c.teacher_id = $1
                    ORDER BY a.due_date ASC
                `;
                params = [id];
            } else if (role === 'student') {
                query = `
                    SELECT a.*, c.title as course_title, c.code as course_code
                    FROM assignments a
                    JOIN courses c ON a.course_id = c.id
                    JOIN enrollments e ON c.id = e.course_id
                    WHERE e.student_id = $1
                    ORDER BY a.due_date ASC
                `;
                params = [id];
            } else if (role === 'admin' || role === 'superadmin') {
                query = `
                    SELECT a.*, c.title as course_title, c.code as course_code, cl.name as class_name
                    FROM assignments a
                    JOIN courses c ON a.course_id = c.id
                    LEFT JOIN classes cl ON c.class_id = cl.id
                    WHERE c.school_id = $1
                    ORDER BY a.due_date ASC
                `;
                params = [school_id];
            }

            const result = await pool.query(query, params);

            res.json({
                success: true,
                data: result.rows
            });
        } catch (error) {
            console.error('Error fetching all assignments:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch assignments',
                error: error.message
            });
        }
    },
    // Get assignments by course
    getByCourse: async (req, res) => {
        try {
            const { courseId } = req.params;
            const pool = await db.getPool();

            const result = await pool.query(
                `SELECT * FROM assignments 
         WHERE course_id = $1 
         ORDER BY due_date ASC`,
                [courseId]
            );

            res.json({
                success: true,
                data: result.rows
            });
        } catch (error) {
            console.error('Error fetching assignments:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch assignments',
                error: error.message
            });
        }
    },

    // Get assignment by ID
    getById: async (req, res) => {
        try {
            const { id } = req.params;
            const pool = await db.getPool();

            const result = await pool.query(
                'SELECT * FROM assignments WHERE id = $1',
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Assignment not found'
                });
            }

            res.json({
                success: true,
                data: result.rows[0]
            });
        } catch (error) {
            console.error('Error fetching assignment:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch assignment',
                error: error.message
            });
        }
    },

    // Create assignment
    create: async (req, res) => {
        try {
            const { course_id, title, description, due_date, points, type, is_published } = req.body;
            const pool = await db.getPool();

            const result = await pool.query(
                `INSERT INTO assignments (
          course_id, title, description, due_date, points, type, is_published, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) 
        RETURNING *`,
                [
                    course_id,
                    title,
                    description,
                    due_date,
                    points || 100,
                    type || 'homework',
                    is_published || false
                ]
            );

            res.status(201).json({
                success: true,
                message: 'Assignment created successfully',
                data: result.rows[0]
            });
        } catch (error) {
            console.error('Error creating assignment:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create assignment',
                error: error.message
            });
        }
    },

    // Update assignment
    update: async (req, res) => {
        try {
            const { id } = req.params;
            const { title, description, due_date, points, type, is_published } = req.body;
            const pool = await db.getPool();

            const result = await pool.query(
                `UPDATE assignments 
         SET title = $1, description = $2, due_date = $3, points = $4, type = $5, is_published = $6, updated_at = NOW()
         WHERE id = $7 
         RETURNING *`,
                [title, description, due_date, points, type, is_published, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Assignment not found'
                });
            }

            res.json({
                success: true,
                message: 'Assignment updated successfully',
                data: result.rows[0]
            });
        } catch (error) {
            console.error('Error updating assignment:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update assignment',
                error: error.message
            });
        }
    },

    // Delete assignment
    delete: async (req, res) => {
        try {
            const { id } = req.params;
            const pool = await db.getPool();

            const result = await pool.query(
                'DELETE FROM assignments WHERE id = $1 RETURNING *',
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Assignment not found'
                });
            }

            res.json({
                success: true,
                message: 'Assignment deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting assignment:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete assignment',
                error: error.message
            });
        }
    }
};

module.exports = assignmentController;
