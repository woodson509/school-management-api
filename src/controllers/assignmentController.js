const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const assignmentController = {
    // Get assignments by course
    getByCourse: async (req, res) => {
        try {
            const { courseId } = req.params;
            const result = await pool.query(
                `SELECT * FROM assignments 
         WHERE course_id = $1 
         ORDER BY due_date ASC`,
                [courseId]
            );
            res.json(result.rows);
        } catch (error) {
            console.error('Error fetching assignments:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    // Get assignment by ID
    getById: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await pool.query(
                'SELECT * FROM assignments WHERE id = $1',
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Assignment not found' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error fetching assignment:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    // Create assignment
    create: async (req, res) => {
        try {
            const { course_id, title, description, due_date, points, type, is_published } = req.body;

            const result = await pool.query(
                `INSERT INTO assignments (
          id, course_id, title, description, due_date, points, type, is_published
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *`,
                [
                    uuidv4(),
                    course_id,
                    title,
                    description,
                    due_date,
                    points || 100,
                    type || 'homework',
                    is_published || false
                ]
            );

            // Log activity
            await pool.query(
                `INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    uuidv4(),
                    req.user.id,
                    'create',
                    'assignment',
                    result.rows[0].id,
                    JSON.stringify({ title, course_id })
                ]
            );

            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('Error creating assignment:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    // Update assignment
    update: async (req, res) => {
        try {
            const { id } = req.params;
            const { title, description, due_date, points, type, is_published } = req.body;

            const result = await pool.query(
                `UPDATE assignments 
         SET title = $1, description = $2, due_date = $3, points = $4, type = $5, is_published = $6, updated_at = NOW()
         WHERE id = $7 
         RETURNING *`,
                [title, description, due_date, points, type, is_published, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Assignment not found' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Error updating assignment:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    // Delete assignment
    delete: async (req, res) => {
        try {
            const { id } = req.params;
            const result = await pool.query(
                'DELETE FROM assignments WHERE id = $1 RETURNING *',
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Assignment not found' });
            }

            res.json({ message: 'Assignment deleted successfully' });
        } catch (error) {
            console.error('Error deleting assignment:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
};

module.exports = assignmentController;
