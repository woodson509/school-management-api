/**
 * Competencies Controller
 * Manages competencies and their evaluations
 */

const db = require('../config/database');

/**
 * Get all competencies
 * @access Private
 */
exports.getCompetencies = async (req, res) => {
    try {
        const { subject_id, level, is_active } = req.query;

        let query = `
            SELECT 
                comp.*,
                s.name as subject_name
            FROM competencies comp
            LEFT JOIN subjects s ON comp.subject_id = s.id
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 1;

        if (subject_id) {
            query += ` AND comp.subject_id = $${paramCount}`;
            params.push(subject_id);
            paramCount++;
        }

        if (level) {
            query += ` AND comp.level = $${paramCount}`;
            params.push(level);
            paramCount++;
        }

        if (is_active !== undefined) {
            query += ` AND comp.is_active = $${paramCount}`;
            params.push(is_active === 'true');
            paramCount++;
        }

        query += ' ORDER BY comp.code';

        const result = await db.query(query, params);

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching competencies:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching competencies',
            error: error.message
        });
    }
};

/**
 * Create a new competency
 * @access Private (Admin, Teacher)
 */
exports.createCompetency = async (req, res) => {
    try {
        const {
            code,
            name,
            description,
            subject_id,
            category,
            level
        } = req.body;

        const query = `
            INSERT INTO competencies (code, name, description, subject_id, category, level)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;

        const result = await db.query(query, [
            code, name, description, subject_id, category, level
        ]);

        res.status(201).json({
            success: true,
            message: 'Competency created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating competency:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating competency',
            error: error.message
        });
    }
};

/**
 * Update a competency
 * @access Private (Admin, Teacher)
 */
exports.updateCompetency = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, category, is_active } = req.body;

        const query = `
            UPDATE competencies
            SET name = COALESCE($1, name),
                description = COALESCE($2, description),
                category = COALESCE($3, category),
                is_active = COALESCE($4, is_active),
                updated_at = NOW()
            WHERE id = $5
            RETURNING *
        `;

        const result = await db.query(query, [name, description, category, is_active, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Competency not found'
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating competency:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating competency',
            error: error.message
        });
    }
};

/**
 * Delete a competency
 * @access Private (Admin)
 */
exports.deleteCompetency = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if competency has evaluations
        const checkQuery = 'SELECT COUNT(*) FROM competency_evaluations WHERE competency_id = $1';
        const checkResult = await db.query(checkQuery, [id]);

        if (parseInt(checkResult.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete competency because it has evaluations'
            });
        }

        await db.query('DELETE FROM competencies WHERE id = $1', [id]);

        res.status(200).json({
            success: true,
            message: 'Competency deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting competency:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting competency',
            error: error.message
        });
    }
};

/**
 * Get competency evaluations
 * @access Private
 */
exports.getEvaluations = async (req, res) => {
    try {
        const { student_id, competency_id, report_period_id } = req.query;

        let query = `
            SELECT 
                ce.*,
                u.full_name as student_name,
                comp.code as competency_code,
                comp.name as competency_name,
                rp.name as period_name,
                evaluator.full_name as evaluator_name
            FROM competency_evaluations ce
            JOIN users u ON ce.student_id = u.id
            JOIN competencies comp ON ce.competency_id = comp.id
            JOIN report_periods rp ON ce.report_period_id = rp.id
            LEFT JOIN users evaluator ON ce.evaluated_by = evaluator.id
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 1;

        if (student_id) {
            query += ` AND ce.student_id = $${paramCount}`;
            params.push(student_id);
            paramCount++;
        }

        if (competency_id) {
            query += ` AND ce.competency_id = $${paramCount}`;
            params.push(competency_id);
            paramCount++;
        }

        if (report_period_id) {
            query += ` AND ce.report_period_id = $${paramCount}`;
            params.push(report_period_id);
            paramCount++;
        }

        query += ' ORDER BY ce.created_at DESC';

        const result = await db.query(query, params);

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching evaluations:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching evaluations',
            error: error.message
        });
    }
};

/**
 * Create or update a competency evaluation
 * @access Private (Teacher, Admin)
 */
exports.evaluateCompetency = async (req, res) => {
    try {
        const {
            student_id,
            competency_id,
            report_period_id,
            level,
            comments
        } = req.body;

        const evaluated_by = req.user.id;

        // Map level to numeric value
        const levelNumericMap = {
            'not_acquired': 0,
            'in_progress': 1,
            'acquired': 2,
            'expert': 3
        };

        const level_numeric = levelNumericMap[level];

        const query = `
            INSERT INTO competency_evaluations (
                student_id, competency_id, report_period_id, level, level_numeric, comments, evaluated_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (student_id, competency_id, report_period_id)
            DO UPDATE SET
                level = $4,
                level_numeric = $5,
                comments = $6,
                evaluated_by = $7,
                updated_at = NOW()
            RETURNING *
        `;

        const result = await db.query(query, [
            student_id, competency_id, report_period_id, level, level_numeric, comments, evaluated_by
        ]);

        res.status(200).json({
            success: true,
            message: 'Competency evaluated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error evaluating competency:', error);
        res.status(500).json({
            success: false,
            message: 'Error evaluating competency',
            error: error.message
        });
    }
};

/**
 * Get competency summary for a student
 * @access Private
 */
exports.getStudentCompetencySummary = async (req, res) => {
    try {
        const { student_id, report_period_id } = req.query;

        if (!student_id || !report_period_id) {
            return res.status(400).json({
                success: false,
                message: 'student_id and report_period_id are required'
            });
        }

        const query = `
            SELECT 
                ce.level,
                ce.level_numeric,
                comp.category,
                comp.name as competency_name,
                comp.code,
                s.name as subject_name,
                ce.comments
            FROM competency_evaluations ce
            JOIN competencies comp ON ce.competency_id = comp.id
            LEFT JOIN subjects s ON comp.subject_id = s.id
            WHERE ce.student_id = $1 AND ce.report_period_id = $2
            ORDER BY s.name, comp.category, comp.code
        `;

        const result = await db.query(query, [student_id, report_period_id]);

        // Calculate statistics
        const stats = {
            total: result.rows.length,
            not_acquired: 0,
            in_progress: 0,
            acquired: 0,
            expert: 0,
            average_numeric: 0
        };

        let totalNumeric = 0;

        result.rows.forEach(row => {
            stats[row.level]++;
            totalNumeric += row.level_numeric;
        });

        if (result.rows.length > 0) {
            stats.average_numeric = (totalNumeric / result.rows.length).toFixed(2);
        }

        res.status(200).json({
            success: true,
            data: {
                evaluations: result.rows,
                statistics: stats
            }
        });
    } catch (error) {
        console.error('Error fetching competency summary:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching competency summary',
            error: error.message
        });
    }
};
