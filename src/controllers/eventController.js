const db = require('../config/database');

const eventController = {
    /**
     * Get all calendar events for a school
     */
    getEvents: async (req, res) => {
        try {
            const schoolId = req.user.school_id;
            const { month, year } = req.query;

            let query;
            let params = [];

            // Handle case where user doesn't have a school_id (superadmin)
            if (schoolId) {
                query = `SELECT * FROM calendar_events WHERE school_id = $1`;
                params = [schoolId];

                if (month && year) {
                    query += ` AND (
                        (EXTRACT(MONTH FROM start_date) = $2 AND EXTRACT(YEAR FROM start_date) = $3)
                        OR (EXTRACT(MONTH FROM end_date) = $2 AND EXTRACT(YEAR FROM end_date) = $3)
                        OR (start_date <= make_date($3::int, $2::int, 1) AND end_date >= make_date($3::int, $2::int, 1))
                    )`;
                    params.push(month, year);
                }
            } else {
                // Superadmin without school_id - return all events
                query = `SELECT * FROM calendar_events WHERE 1=1`;

                if (month && year) {
                    query += ` AND (
                        (EXTRACT(MONTH FROM start_date) = $1 AND EXTRACT(YEAR FROM start_date) = $2)
                        OR (EXTRACT(MONTH FROM end_date) = $1 AND EXTRACT(YEAR FROM end_date) = $2)
                        OR (start_date <= make_date($2::int, $1::int, 1) AND end_date >= make_date($2::int, $1::int, 1))
                    )`;
                    params.push(month, year);
                }
            }

            query += ' ORDER BY start_date ASC';

            const result = await db.query(query, params);

            // Transform to frontend format
            const events = result.rows.map(e => ({
                id: e.id,
                title: e.title,
                description: e.description,
                date: e.start_date,
                endDate: e.end_date,
                type: e.event_type,
                color: e.color,
                location: e.location,
                allDay: e.all_day
            }));

            res.json({ success: true, data: events });
        } catch (error) {
            console.error('Error fetching events:', error);
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    },

    /**
     * Get a single event by ID
     */
    getEventById: async (req, res) => {
        try {
            const { id } = req.params;
            const schoolId = req.user.school_id;

            const result = await db.query(
                'SELECT * FROM calendar_events WHERE id = $1 AND school_id = $2',
                [id, schoolId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Événement non trouvé' });
            }

            const e = result.rows[0];
            res.json({
                success: true,
                data: {
                    id: e.id,
                    title: e.title,
                    description: e.description,
                    date: e.start_date,
                    endDate: e.end_date,
                    type: e.event_type,
                    color: e.color,
                    location: e.location,
                    allDay: e.all_day
                }
            });
        } catch (error) {
            console.error('Error fetching event:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    /**
     * Create a new calendar event
     */
    createEvent: async (req, res) => {
        try {
            const schoolId = req.user.school_id;
            const userId = req.user.id;
            const { title, description, date, endDate, type, color, location, allDay } = req.body;

            if (!title || !date || !type) {
                return res.status(400).json({ message: 'Titre, date et type sont requis' });
            }

            // Define color based on type if not provided
            const eventColors = {
                academic: '#3B82F6',
                exam: '#EF4444',
                holiday: '#10B981',
                meeting: '#8B5CF6',
                other: '#6B7280'
            };

            const eventColor = color || eventColors[type] || '#3B82F6';

            const result = await db.query(
                `INSERT INTO calendar_events 
                (school_id, title, description, start_date, end_date, event_type, color, location, all_day, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *`,
                [schoolId, title, description, date, endDate || date, type, eventColor, location, allDay !== false, userId]
            );

            const e = result.rows[0];
            res.status(201).json({
                success: true,
                message: 'Événement créé avec succès',
                data: {
                    id: e.id,
                    title: e.title,
                    description: e.description,
                    date: e.start_date,
                    endDate: e.end_date,
                    type: e.event_type,
                    color: e.color,
                    location: e.location,
                    allDay: e.all_day
                }
            });
        } catch (error) {
            console.error('Error creating event:', error);
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    },

    /**
     * Update a calendar event
     */
    updateEvent: async (req, res) => {
        try {
            const { id } = req.params;
            const schoolId = req.user.school_id;
            const { title, description, date, endDate, type, color, location, allDay } = req.body;

            // Check if event exists
            const check = await db.query(
                'SELECT * FROM calendar_events WHERE id = $1 AND school_id = $2',
                [id, schoolId]
            );

            if (check.rows.length === 0) {
                return res.status(404).json({ message: 'Événement non trouvé' });
            }

            const result = await db.query(
                `UPDATE calendar_events SET
                    title = COALESCE($1, title),
                    description = COALESCE($2, description),
                    start_date = COALESCE($3, start_date),
                    end_date = COALESCE($4, end_date),
                    event_type = COALESCE($5, event_type),
                    color = COALESCE($6, color),
                    location = COALESCE($7, location),
                    all_day = COALESCE($8, all_day),
                    updated_at = NOW()
                WHERE id = $9 AND school_id = $10
                RETURNING *`,
                [title, description, date, endDate, type, color, location, allDay, id, schoolId]
            );

            const e = result.rows[0];
            res.json({
                success: true,
                message: 'Événement mis à jour',
                data: {
                    id: e.id,
                    title: e.title,
                    description: e.description,
                    date: e.start_date,
                    endDate: e.end_date,
                    type: e.event_type,
                    color: e.color,
                    location: e.location,
                    allDay: e.all_day
                }
            });
        } catch (error) {
            console.error('Error updating event:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    /**
     * Delete a calendar event
     */
    deleteEvent: async (req, res) => {
        try {
            const { id } = req.params;
            const schoolId = req.user.school_id;

            const result = await db.query(
                'DELETE FROM calendar_events WHERE id = $1 AND school_id = $2 RETURNING id',
                [id, schoolId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ message: 'Événement non trouvé' });
            }

            res.json({ success: true, message: 'Événement supprimé' });
        } catch (error) {
            console.error('Error deleting event:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
};

module.exports = eventController;
