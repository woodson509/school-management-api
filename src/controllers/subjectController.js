/**
 * Subject Controller
 * Handles subject/course subject management operations
 */

const db = require('../config/database');

/**
 * Create a new subject
 * @access Private (admin, superadmin)
 */
exports.createSubject = async (req, res) => {
    try {
        const { name, code, description } = req.body;

        const query = `
      INSERT INTO subjects (name, code, description, school_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

        const result = await db.query(query, [
            name,
            code,
            description || null,
            req.user.school_id
        ]);

        res.status(201).json({
            success: true,
            message: 'Subject created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating subject:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating subject',
            error: error.message
        });
    }
};

/**
 * Get all subjects
 * @access Private
 */
exports.getSubjects = async (req, res) => {
    try {
        const { page = 1, limit = 50, search } = req.query;
        const offset = (page - 1) * limit;

        let query = `
      SELECT * FROM subjects WHERE 1=1
    `;

        const params = [];
        let paramCount = 1;

        if (search) {
            query += ` AND (name ILIKE $${paramCount} OR code ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        // Admin and teacher see only their school's subjects
        if (req.user.role === 'admin' || req.user.role === 'teacher') {
            query += ` AND (school_id = $${paramCount} OR school_id IS NULL)`;
            params.push(req.user.school_id);
            paramCount++;
        }

        query += ` ORDER BY name LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(limit, offset);

        const result = await db.query(query, params);

        // Get total count with same filter
        let countQuery = 'SELECT COUNT(*) FROM subjects WHERE 1=1';
        const countParams = [];
        let countIndex = 1;

        if (search) {
            countQuery += ` AND (name ILIKE $${countIndex} OR code ILIKE $${countIndex})`;
            countParams.push(`%${search}%`);
            countIndex++;
        }

        if (req.user.role === 'admin' || req.user.role === 'teacher') {
            countQuery += ` AND (school_id = $${countIndex} OR school_id IS NULL)`;
            countParams.push(req.user.school_id);
        }

        const countResult = await db.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching subjects:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching subjects',
            error: error.message
        });
    }
};

/**
 * Get subject by ID
 * @access Private
 */
exports.getSubjectById = async (req, res) => {
    try {
        const { id } = req.params;

        const query = `SELECT * FROM subjects WHERE id = $1`;

        const result = await db.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching subject:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching subject',
            error: error.message
        });
    }
};

/**
 * Update subject
 * @access Private (admin, superadmin)
 */
exports.updateSubject = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, description } = req.body;

        const query = `
      UPDATE subjects
      SET name = $1, code = $2, description = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;

        const result = await db.query(query, [
            name,
            code,
            description,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        res.json({
            success: true,
            message: 'Subject updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating subject:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating subject',
            error: error.message
        });
    }
};

/**
 * Delete subject
 * @access Private (admin, superadmin)
 */
exports.deleteSubject = async (req, res) => {
    try {
        const { id } = req.params;

        const query = `DELETE FROM subjects WHERE id = $1 RETURNING *`;
        const result = await db.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        res.json({
            success: true,
            message: 'Subject deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting subject:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting subject',
            error: error.message
        });
    }
};
