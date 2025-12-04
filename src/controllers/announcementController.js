/**
 * Announcement Controller
 * Handles school and course announcements
 */

const db = require('../config/database');

/**
 * Get announcements
 * GET /api/announcements
 */
exports.getAnnouncements = async (req, res) => {
    try {
        const { school_id, limit = 20 } = req.query;
        const pool = await db.getPool();

        let query = `
      SELECT 
        a.*,
        u.full_name as created_by_name
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE (a.expires_at IS NULL OR a.expires_at > NOW())
    `;

        const params = [];
        let paramIndex = 1;

        // Filter by school (admins see only their school)
        if (req.user.role === 'admin') {
            query += ` AND a.school_id = $${paramIndex}`;
            params.push(req.user.school_id);
            paramIndex++;
        } else if (school_id) {
            query += ` AND a.school_id = $${paramIndex}`;
            params.push(school_id);
            paramIndex++;
        }

        query += ` ORDER BY a.is_pinned DESC, a.created_at DESC LIMIT $${paramIndex}`;
        params.push(limit);

        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch announcements',
            error: error.message
        });
    }
};

/**
 * Create announcement
 * POST /api/announcements
 */
exports.createAnnouncement = async (req, res) => {
    try {
        const {
            school_id,
            title,
            content,
            priority,
            is_pinned,
            attachments,
            target_audience,
            expires_at
        } = req.body;

        const pool = await db.getPool();

        // Determine school_id
        let targetSchoolId = school_id;
        if (req.user.role === 'admin') {
            targetSchoolId = req.user.school_id;
        }

        const query = `
      INSERT INTO announcements (
        school_id, created_by, title, content,
        priority, is_pinned, attachments, target_audience,
        is_published, published_at, expires_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), $9, NOW(), NOW())
      RETURNING *
    `;

        const result = await pool.query(query, [
            targetSchoolId,
            req.user.id,
            title,
            content,
            priority || 'medium',
            is_pinned || false,
            attachments ? JSON.stringify(attachments) : null,
            target_audience || 'all',
            expires_at || null
        ]);

        res.status(201).json({
            success: true,
            message: 'Announcement created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create announcement',
            error: error.message
        });
    }
};

/**
 * Update announcement
 * PUT /api/announcements/:id
 */
exports.updateAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await db.getPool();

        // Verify access
        const announcementCheck = await pool.query(
            'SELECT * FROM announcements WHERE id = $1',
            [id]
        );

        if (announcementCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found'
            });
        }

        if (req.user.role === 'admin' && announcementCheck.rows[0].school_id !== req.user.school_id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        const updates = [];
        const params = [];
        let paramIndex = 1;

        const fields = ['title', 'content', 'priority', 'is_pinned', 'target_audience', 'expires_at', 'is_published'];

        fields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = $${paramIndex}`);
                params.push(req.body[field]);
                paramIndex++;
            }
        });

        if (req.body.attachments !== undefined) {
            updates.push(`attachments = $${paramIndex}`);
            params.push(JSON.stringify(req.body.attachments));
            paramIndex++;
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
      UPDATE announcements
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

        const result = await pool.query(query, params);

        res.json({
            success: true,
            message: 'Announcement updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating announcement:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update announcement',
            error: error.message
        });
    }
};

/**
 * Delete announcement
 * DELETE /api/announcements/:id
 */
exports.deleteAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await db.getPool();

        // Verify access
        const announcementCheck = await pool.query(
            'SELECT school_id FROM announcements WHERE id = $1',
            [id]
        );

        if (announcementCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found'
            });
        }

        if (req.user.role === 'admin' && announcementCheck.rows[0].school_id !== req.user.school_id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        await pool.query('DELETE FROM announcements WHERE id = $1', [id]);

        res.json({
            success: true,
            message: 'Announcement deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting announcement:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete announcement',
            error: error.message
        });
    }
};
