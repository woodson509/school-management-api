/**
 * Class Controller
 * Handles class/group management operations
 */

const db = require('../config/database');

/**
 * Create a new class
 * @access Private (admin, superadmin)
 */
exports.createClass = async (req, res) => {
    try {
        const { name, grade_level, school_year, teacher_id } = req.body;
        const pool = await db.getPool();

        const query = `
      INSERT INTO classes (name, grade_level, school_year, teacher_id, created_by, school_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

        const result = await pool.query(query, [
            name,
            grade_level,
            school_year,
            teacher_id || null,
            req.user.id,
            req.user.school_id
        ]);

        res.status(201).json({
            success: true,
            message: 'Class created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating class:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating class',
            error: error.message
        });
    }
};

/**
 * Get all classes
 * @access Private
 */
exports.getClasses = async (req, res) => {
    try {
        const pool = await db.getPool();
        const { page = 1, limit = 10, grade_level, school_year } = req.query;
        const offset = (page - 1) * limit;

        let query = `
      SELECT c.*, u.full_name as teacher_name
      FROM classes c
      LEFT JOIN users u ON c.teacher_id = u.id
      WHERE 1=1
    `;

        const params = [];
        let paramIndex = 1;

        if (grade_level) {
            query += ` AND c.grade_level = $${paramIndex}`;
            params.push(grade_level);
            paramIndex++;
        }

        if (school_year) {
            query += ` AND c.school_year = $${paramIndex}`;
            params.push(school_year);
            paramIndex++;
        }

        // Admins and teachers see only their school's classes
        if (req.user.role === 'admin' || req.user.role === 'teacher') {
            query += ` AND c.school_id = $${paramIndex}`;
            params.push(req.user.school_id);
            paramIndex++;
        }

        query += ` ORDER BY c.grade_level, c.name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get total count
        let countQuery = `SELECT COUNT(*) FROM classes WHERE 1=1`;
        const countParams = [];
        let countIndex = 1;

        if (grade_level) {
            countQuery += ` AND grade_level = $${countIndex}`;
            countParams.push(grade_level);
            countIndex++;
        }

        if (school_year) {
            countQuery += ` AND school_year = $${countIndex}`;
            countParams.push(school_year);
            countIndex++;
        }

        // Same school filter for count
        if (req.user.role === 'admin' || req.user.role === 'teacher') {
            countQuery += ` AND school_id = $${countIndex}`;
            countParams.push(req.user.school_id);
        }

        const countResult = await pool.query(countQuery, countParams);
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
        console.error('Error fetching classes:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching classes',
            error: error.message
        });
    }
};

/**
 * Get class by ID
 * @access Private
 */
exports.getClassById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await db.getPool();

        const query = `
      SELECT c.*, u.full_name as teacher_name
      FROM classes c
      LEFT JOIN users u ON c.teacher_id = u.id
      WHERE c.id = $1
    `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching class:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching class',
            error: error.message
        });
    }
};

/**
 * Update class
 * @access Private (admin, superadmin)
 */
exports.updateClass = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, grade_level, school_year, teacher_id } = req.body;
        const pool = await db.getPool();

        const query = `
      UPDATE classes
      SET name = $1, grade_level = $2, school_year = $3, 
          teacher_id = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;

        const result = await pool.query(query, [
            name,
            grade_level,
            school_year,
            teacher_id,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        res.json({
            success: true,
            message: 'Class updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating class:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating class',
            error: error.message
        });
    }
};

/**
 * Delete class
 * @access Private (admin, superadmin)
 */
exports.deleteClass = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await db.getPool();

        const query = `DELETE FROM classes WHERE id = $1 RETURNING *`;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        res.json({
            success: true,
            message: 'Class deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting class:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting class',
            error: error.message
        });
    }
};
