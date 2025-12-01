/**
 * Schedule Controller
 * Handles class timetable management
 */

const db = require('../config/database');

/**
 * Get schedules for a specific class
 * @access Private
 */
exports.getSchedules = async (req, res) => {
    try {
        const { class_id } = req.query;

        let query = `
            SELECT 
                s.id,
                s.day_of_week,
                s.start_time,
                s.end_time,
                s.room,
                s.color,
                s.notes,
                s.class_id,
                c.name as class_name,
                s.subject_id,
                sub.name as subject_name,
                s.teacher_id,
                u.full_name as teacher_name
            FROM schedules s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN subjects sub ON s.subject_id = sub.id
            LEFT JOIN users u ON s.teacher_id = u.id
            WHERE 1=1
        `;

        const params = [];

        if (class_id) {
            query += ' AND s.class_id = $1';
            params.push(class_id);
        }

        query += ' ORDER BY s.day_of_week, s.start_time';

        const result = await db.query(query, params);

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching schedules:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching schedules',
            error: error.message
        });
    }
};

/**
 * Create a new schedule entry
 * @access Private (Admin/Teacher)
 */
exports.createSchedule = async (req, res) => {
    try {
        const { class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room, color, notes } = req.body;

        const query = `
            INSERT INTO schedules (
                class_id, subject_id, teacher_id, 
                day_of_week, start_time, end_time, room, color, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;

        const result = await db.query(query, [
            class_id, subject_id, teacher_id,
            day_of_week, start_time, end_time, room, color || '#3B82F6', notes
        ]);

        res.status(201).json({
            success: true,
            message: 'Schedule created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating schedule:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating schedule',
            error: error.message
        });
    }
};

/**
 * Update a schedule entry
 * @access Private (Admin/Teacher)
 */
exports.updateSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const { class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room, color, notes } = req.body;

        const query = `
            UPDATE schedules 
            SET class_id = $1, subject_id = $2, teacher_id = $3,
                day_of_week = $4, start_time = $5, end_time = $6,
                room = $7, color = $8, notes = $9, updated_at = NOW()
            WHERE id = $10
            RETURNING *
        `;

        const result = await db.query(query, [
            class_id, subject_id, teacher_id,
            day_of_week, start_time, end_time, room, color, notes,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Schedule not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Schedule updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating schedule:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating schedule',
            error: error.message
        });
    }
};

/**
 * Delete a schedule entry
 * @access Private (Admin/Teacher)
 */
exports.deleteSchedule = async (req, res) => {
    try {
        const { id } = req.params;

        const query = 'DELETE FROM schedules WHERE id = $1 RETURNING id';
        const result = await db.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Schedule not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Schedule deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting schedule',
            error: error.message
        });
    }
};
