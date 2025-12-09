/**
 * Lesson Controller
 * Handles CRUD operations for lessons within courses
 */

const db = require('../config/database');

/**
 * Get all lessons for a course
 * GET /api/courses/:courseId/lessons
 */
exports.getLessonsByCourse = async (req, res) => {
    try {
        const { courseId } = req.params;
        const pool = await db.getPool();

        const query = `
      SELECT l.*, u.full_name as created_by_name
      FROM lessons l
      LEFT JOIN users u ON l.created_by = u.id
      WHERE l.course_id = $1
      ORDER BY l.lesson_order ASC, l.created_at ASC
    `;

        const result = await pool.query(query, [courseId]);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching lessons:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch lessons',
            error: error.message
        });
    }
};

/**
 * Get single lesson by ID
 * GET /api/lessons/:id
 */
exports.getLessonById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await db.getPool();

        const query = `
      SELECT l.*, u.full_name as created_by_name, c.title as course_title
      FROM lessons l
      LEFT JOIN users u ON l.created_by = u.id
      LEFT JOIN courses c ON l.course_id = c.id
      WHERE l.id = $1
    `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Lesson not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching lesson:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch lesson',
            error: error.message
        });
    }
};

/**
 * Create a new lesson
 * POST /api/lessons
 */
exports.createLesson = async (req, res) => {
    try {
        const {
            course_id, title, description, content, lesson_order,
            duration_minutes, video_url, attachments, type, is_published,
            meeting_link, is_online
        } = req.body;

        const pool = await db.getPool();

        // Verify course exists and user has access
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

        // Admins can only create lessons for their school's courses
        if (req.user.role === 'admin') {
            if (courseCheck.rows[0].school_id !== req.user.school_id) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot create lesson for this course'
                });
            }
        }

        const query = `
      INSERT INTO lessons (
        course_id, title, description, content, lesson_order,
        duration_minutes, video_url, attachments, type,
        is_published, published_at, created_by, created_at, updated_at,
        meeting_link, is_online
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW(), $13, $14)
      RETURNING *
    `;

        const result = await pool.query(query, [
            course_id,
            title,
            description || null,
            content || null,
            lesson_order || 1,
            duration_minutes || null,
            video_url || null,
            attachments ? JSON.stringify(attachments) : null,
            type || 'text',
            is_published || false,
            is_published ? new Date() : null,
            req.user.id,
            meeting_link || null,
            is_online || false
        ]);

        res.status(201).json({
            success: true,
            message: 'Lesson created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating lesson:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create lesson',
            error: error.message
        });
    }
};

/**
 * Update a lesson
 * PUT /api/lessons/:id
 */
exports.updateLesson = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await db.getPool();

        // Get lesson and verify access
        const lessonCheck = await pool.query(
            `SELECT l.*, c.school_id 
       FROM lessons l 
       JOIN courses c ON l.course_id = c.id 
       WHERE l.id = $1`,
            [id]
        );

        if (lessonCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Lesson not found'
            });
        }

        // Check permissions
        if (req.user.role === 'admin' && lessonCheck.rows[0].school_id !== req.user.school_id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this lesson'
            });
        }

        const updates = [];
        const params = [];
        let paramIndex = 1;

        const fields = [
            'title', 'description', 'content', 'lesson_order', 'duration_minutes',
            'video_url', 'type', 'is_published', 'meeting_link', 'is_online'
        ];

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

        if (req.body.is_published && !lessonCheck.rows[0].is_published) {
            updates.push(`published_at = NOW()`);
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
      UPDATE lessons
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

        const result = await pool.query(query, params);

        res.json({
            success: true,
            message: 'Lesson updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating lesson:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update lesson',
            error: error.message
        });
    }
};

/**
 * Delete a lesson
 * DELETE /api/lessons/:id
 */
exports.deleteLesson = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await db.getPool();

        // Verify access
        const lessonCheck = await pool.query(
            `SELECT l.*, c.school_id 
       FROM lessons l 
       JOIN courses c ON l.course_id = c.id 
       WHERE l.id = $1`,
            [id]
        );

        if (lessonCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Lesson not found'
            });
        }

        if (req.user.role === 'admin' && lessonCheck.rows[0].school_id !== req.user.school_id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this lesson'
            });
        }

        await pool.query('DELETE FROM lessons WHERE id = $1', [id]);

        res.json({
            success: true,
            message: 'Lesson deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting lesson:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete lesson',
            error: error.message
        });
    }
};
