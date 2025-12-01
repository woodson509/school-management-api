/**
 * Curriculum Controller
 * Handles academic program management
 */

const db = require('../config/database');

/**
 * Get all curricula for the current school
 * @access Private
 */
exports.getCurricula = async (req, res) => {
    try {
        let schoolId = req.user.school_id;

        // If superadmin, allow filtering by school_id query param
        if (req.user.role === 'superadmin' && req.query.school_id) {
            schoolId = req.query.school_id;
        }

        const query = `
            SELECT c.*, 
            (SELECT COUNT(*) FROM subjects s WHERE s.curriculum_id = c.id) as subjects_count,
            (SELECT COUNT(*) FROM classes cl WHERE cl.curriculum_id = c.id) as classes_count
            FROM curricula c
            WHERE c.school_id = $1
            ORDER BY c.name ASC
        `;

        // Note: The subqueries for subjects_count and classes_count assume those tables have curriculum_id
        // If not, we'll just return basic info for now and update later

        // Fallback query if subjects/classes don't link to curriculum yet
        const fallbackQuery = `
            SELECT * FROM curricula WHERE school_id = $1 ORDER BY name ASC
        `;

        let result;
        try {
            result = await db.query(query, [schoolId]);
        } catch (err) {
            // If subqueries fail (columns don't exist yet), use fallback
            result = await db.query(fallbackQuery, [schoolId]);
        }

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching curricula:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching curricula',
            error: error.message
        });
    }
};

/**
 * Create a new curriculum
 * @access Private (Admin)
 */
exports.createCurriculum = async (req, res) => {
    try {
        const { name, code, level, duration, total_credits, status, description } = req.body;
        const schoolId = req.user.school_id;

        const query = `
            INSERT INTO curricula (school_id, name, code, level, duration, total_credits, status, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;

        const result = await db.query(query, [
            schoolId, name, code, level, duration, total_credits || 0, status || 'draft', description
        ]);

        res.status(201).json({
            success: true,
            message: 'Curriculum created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating curriculum:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating curriculum',
            error: error.message
        });
    }
};

/**
 * Update a curriculum
 * @access Private (Admin)
 */
exports.updateCurriculum = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, level, duration, total_credits, status, description } = req.body;
        const schoolId = req.user.school_id;

        const query = `
            UPDATE curricula 
            SET name = $1, code = $2, level = $3, duration = $4, 
                total_credits = $5, status = $6, description = $7, updated_at = NOW()
            WHERE id = $8 AND school_id = $9
            RETURNING *
        `;

        const result = await db.query(query, [
            name, code, level, duration, total_credits, status, description, id, schoolId
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Curriculum not found or unauthorized'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Curriculum updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating curriculum:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating curriculum',
            error: error.message
        });
    }
};

/**
 * Delete a curriculum
 * @access Private (Admin)
 */
exports.deleteCurriculum = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolId = req.user.school_id;

        const query = 'DELETE FROM curricula WHERE id = $1 AND school_id = $2 RETURNING id';
        const result = await db.query(query, [id, schoolId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Curriculum not found or unauthorized'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Curriculum deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting curriculum:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting curriculum',
            error: error.message
        });
    }
};
