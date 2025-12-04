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
        const { name, code, description, credits } = req.body;

        const query = `
      INSERT INTO subjects (name, code, description, credits, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

        const result = await db.query(query, [
            name,
            code,
            description || null,
            credits || 1,
            req.user.id
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
      SELECT s.*, u.full_name as created_by_name
      FROM subjects s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE 1=1
    `;

        const params = [];

        if (search) {
            query += ` AND (s.name ILIKE $1 OR s.code ILIKE $1)`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY s.name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await db.query(query, params);

        // Get total count
        const countQuery = search
            ? `SELECT COUNT(*) FROM subjects WHERE name ILIKE $1 OR code ILIKE $1`
            : `SELECT COUNT(*) FROM subjects`;
        const countParams = search ? [`%${search}%`] : [];
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

        const query = `
      SELECT s.*, u.full_name as created_by_name
      FROM subjects s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = $1
    `;

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
        const { name, code, description, credits } = req.body;

        const query = `
      UPDATE subjects
      SET name = $1, code = $2, description = $3, 
          credits = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;

        const result = await db.query(query, [
            name,
            code,
            description,
            credits,
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
