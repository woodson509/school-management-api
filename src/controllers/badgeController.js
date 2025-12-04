const db = require('../config/database');
const { validateUUID } = require('../utils/validation');

const badgeController = {
    /**
     * Get all badges
     */
    getAllBadges: async (req, res) => {
        try {
            const result = await db.query('SELECT * FROM badges ORDER BY created_at DESC');
            res.json({ success: true, data: result.rows });
        } catch (error) {
            console.error('Error fetching badges:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    /**
     * Create a new badge
     */
    createBadge: async (req, res) => {
        try {
            const { name, description, icon_url, criteria, badge_type } = req.body;

            const query = `
        INSERT INTO badges (name, description, icon_url, criteria, badge_type)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
            const values = [name, description, icon_url, criteria, badge_type];

            const result = await db.query(query, values);
            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            console.error('Error creating badge:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    /**
     * Award a badge to a student
     */
    awardBadge: async (req, res) => {
        try {
            const { student_id, badge_id } = req.body;
            const awarded_by = req.user.id; // From auth middleware

            if (!validateUUID(student_id) || !validateUUID(badge_id)) {
                return res.status(400).json({ message: 'Invalid IDs' });
            }

            // Check if already awarded
            const checkQuery = `
        SELECT * FROM student_badges 
        WHERE student_id = $1 AND badge_id = $2
      `;
            const checkRes = await db.query(checkQuery, [student_id, badge_id]);

            if (checkRes.rows.length > 0) {
                return res.status(400).json({ message: 'Badge already awarded to this student' });
            }

            const query = `
        INSERT INTO student_badges (student_id, badge_id, awarded_by)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
            const result = await db.query(query, [student_id, badge_id, awarded_by]);

            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            console.error('Error awarding badge:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    /**
     * Get badges for a student
     */
    getStudentBadges: async (req, res) => {
        try {
            const { student_id } = req.params;

            const query = `
        SELECT sb.*, b.name, b.description, b.icon_url, b.badge_type
        FROM student_badges sb
        JOIN badges b ON sb.badge_id = b.id
        WHERE sb.student_id = $1
        ORDER BY sb.awarded_at DESC
      `;
            const result = await db.query(query, [student_id]);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            console.error('Error fetching student badges:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    /**
     * Auto-award badges based on report card results
     * (To be called after report card generation)
     */
    checkAndAwardBadges: async (studentId, reportCardId) => {
        // This is an internal helper, not an API endpoint directly
        try {
            // 1. Fetch report card
            const rcRes = await db.query('SELECT * FROM report_cards WHERE id = $1', [reportCardId]);
            const rc = rcRes.rows[0];
            if (!rc) return;

            // 2. Fetch auto-awardable badges
            const badgesRes = await db.query("SELECT * FROM badges WHERE criteria IS NOT NULL");
            const badges = badgesRes.rows;

            for (const badge of badges) {
                const criteria = badge.criteria;
                let eligible = false;

                // Example Criteria: {"min_average": 18}
                if (criteria.min_average && parseFloat(rc.overall_average) >= criteria.min_average) {
                    eligible = true;
                }

                // Example Criteria: {"rank": 1}
                if (criteria.rank && rc.rank === criteria.rank) {
                    eligible = true;
                }

                if (eligible) {
                    // Check if already awarded (maybe allow re-awarding for different periods? For now, unique)
                    // Or maybe we want to award it again? Let's check if awarded recently?
                    // For simplicity, let's just award it if not present.
                    const check = await db.query(
                        'SELECT * FROM student_badges WHERE student_id = $1 AND badge_id = $2',
                        [studentId, badge.id]
                    );

                    if (check.rows.length === 0) {
                        await db.query(
                            'INSERT INTO student_badges (student_id, badge_id) VALUES ($1, $2)',
                            [studentId, badge.id]
                        );
                    }
                }
            }
        } catch (error) {
            console.error('Error auto-awarding badges:', error);
        }
    }
};

module.exports = badgeController;
