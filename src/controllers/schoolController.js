/**
 * School Controller
 * Handles school management operations
 */

const db = require('../config/database');

/**
 * Create a new school
 * @access Private (superadmin only)
 */
exports.createSchool = async (req, res) => {
    try {
        const { name, address, phone, email, website, principal_name } = req.body;
        const pool = await db.getPool();

        const query = `
      INSERT INTO schools (name, address, phone, email, website, principal_name, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

        const result = await pool.query(query, [
            name,
            address,
            phone,
            email,
            website || null,
            principal_name || null,
            req.user.id
        ]);

        res.status(201).json({
            success: true,
            message: 'School created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating school:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating school',
            error: error.message
        });
    }
};

/**
 * Get all schools
 * @access Private (superadmin, admin)
 */
exports.getSchools = async (req, res) => {
    try {
        const pool = await db.getPool();
        const { page = 1, limit = 10, search } = req.query;
        const offset = (page - 1) * limit;

        let query = `
      SELECT s.*, u.full_name as created_by_name
      FROM schools s
      LEFT JOIN users u ON s.created_by = u.id
    `;

        const params = [];

        if (search) {
            query += ` WHERE s.name ILIKE $1 OR s.address ILIKE $1`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get total count
        const countQuery = search
            ? `SELECT COUNT(*) FROM schools WHERE name ILIKE $1 OR address ILIKE $1`
            : `SELECT COUNT(*) FROM schools`;
        const countParams = search ? [`%${search}%`] : [];
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
        console.error('Error fetching schools:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching schools',
            error: error.message
        });
    }
};

/**
 * Get school by ID
 * @access Private
 */
exports.getSchoolById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await db.getPool();

        const query = `
      SELECT s.*, u.full_name as created_by_name
      FROM schools s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = $1
    `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching school:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching school',
            error: error.message
        });
    }
};

/**
 * Update school
 * @access Private (superadmin only)
 */
exports.updateSchool = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, phone, email, website, principal_name } = req.body;
        const pool = await db.getPool();

        const query = `
      UPDATE schools
      SET name = $1, address = $2, phone = $3, email = $4, 
          website = $5, principal_name = $6, updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `;

        const result = await pool.query(query, [
            name,
            address,
            phone,
            email,
            website,
            principal_name,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        res.json({
            success: true,
            message: 'School updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating school:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating school',
            error: error.message
        });
    }
};

/**
 * Delete school
 * @access Private (superadmin only)
 */
exports.deleteSchool = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await db.getPool();

        const query = `DELETE FROM schools WHERE id = $1 RETURNING *`;
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        res.json({
            success: true,
            message: 'School deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting school:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting school',
            error: error.message
        });
    }
};
