/**
 * Settings Controller
 * Manages school settings, grading scales, and report periods
 */

const db = require('../config/database');

/**
 * Get all school settings
 * @access Private (Admin, Superadmin)
 */
exports.getSettings = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM school_settings ORDER BY setting_key');

        // Convert to key-value object for easier frontend use
        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });

        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching settings',
            error: error.message
        });
    }
};

/**
 * Update a school setting
 * @access Private (Admin, Superadmin)
 */
exports.updateSetting = async (req, res) => {
    try {
        const { setting_key, setting_value } = req.body;

        const query = `
            UPDATE school_settings
            SET setting_value = $1, updated_at = NOW()
            WHERE setting_key = $2
            RETURNING *
        `;

        const result = await db.query(query, [setting_value, setting_key]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Setting not found'
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating setting:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating setting',
            error: error.message
        });
    }
};

/**
 * Get all grading scales
 * @access Private
 */
exports.getGradingScales = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM grading_scales ORDER BY max_value');

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching grading scales:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching grading scales',
            error: error.message
        });
    }
};

/**
 * Create a new grading scale
 * @access Private (Admin, Superadmin)
 */
exports.createGradingScale = async (req, res) => {
    try {
        const { name, max_value, min_value = 0, is_default = false } = req.body;

        // If setting as default, unset other defaults
        if (is_default) {
            await db.query('UPDATE grading_scales SET is_default = false');
        }

        const query = `
            INSERT INTO grading_scales (name, max_value, min_value, is_default)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;

        const result = await db.query(query, [name, max_value, min_value, is_default]);

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating grading scale:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating grading scale',
            error: error.message
        });
    }
};

/**
 * Get all report periods
 * @access Private
 */
exports.getReportPeriods = async (req, res) => {
    try {
        const { school_year, is_active } = req.query;

        let query = 'SELECT * FROM report_periods WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (school_year) {
            query += ` AND school_year = $${paramCount}`;
            params.push(school_year);
            paramCount++;
        }

        if (is_active !== undefined) {
            query += ` AND is_active = $${paramCount}`;
            params.push(is_active === 'true');
            paramCount++;
        }

        query += ' ORDER BY school_year DESC, order_number ASC';

        const result = await db.query(query, params);

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching report periods:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching report periods',
            error: error.message
        });
    }
};

/**
 * Create a new report period
 * @access Private (Admin, Superadmin)
 */
exports.createReportPeriod = async (req, res) => {
    try {
        const { name, period_type, school_year, start_date, end_date, order_number } = req.body;

        const query = `
            INSERT INTO report_periods (name, period_type, school_year, start_date, end_date, order_number)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;

        const result = await db.query(query, [
            name, period_type, school_year, start_date, end_date, order_number
        ]);

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating report period:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating report period',
            error: error.message
        });
    }
};

/**
 * Update a report period
 * @access Private (Admin, Superadmin)
 */
exports.updateReportPeriod = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, period_type, start_date, end_date, is_active, order_number } = req.body;

        const query = `
            UPDATE report_periods
            SET name = COALESCE($1, name),
                period_type = COALESCE($2, period_type),
                start_date = COALESCE($3, start_date),
                end_date = COALESCE($4, end_date),
                is_active = COALESCE($5, is_active),
                order_number = COALESCE($6, order_number),
                updated_at = NOW()
            WHERE id = $7
            RETURNING *
        `;

        const result = await db.query(query, [
            name, period_type, start_date, end_date, is_active, order_number, id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Report period not found'
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating report period:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating report period',
            error: error.message
        });
    }
};

/**
 * Delete a report period
 * @access Private (Admin, Superadmin)
 */
exports.deleteReportPeriod = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if period has grades
        const checkQuery = 'SELECT COUNT(*) FROM grades WHERE report_period_id = $1';
        const checkResult = await db.query(checkQuery, [id]);

        if (parseInt(checkResult.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete period because it has grades'
            });
        }

        await db.query('DELETE FROM report_periods WHERE id = $1', [id]);

        res.status(200).json({
            success: true,
            message: 'Report period deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting report period:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting report period',
            error: error.message
        });
    }
};

/**
 * Get subject coefficients
 * @access Private
 */
exports.getSubjectCoefficients = async (req, res) => {
    try {
        const { class_id } = req.query;

        let query = `
            SELECT 
                sc.*,
                s.name as subject_name,
                c.name as class_name
            FROM subject_coefficients sc
            JOIN subjects s ON sc.subject_id = s.id
            JOIN classes c ON sc.class_id = c.id
            WHERE 1=1
        `;

        const params = [];
        if (class_id) {
            params.push(class_id);
            query += ` AND sc.class_id = $1`;
        }

        query += ' ORDER BY c.name, s.name';

        const result = await db.query(query, params);

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching coefficients:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching coefficients',
            error: error.message
        });
    }
};

/**
 * Set subject coefficient
 * @access Private (Admin, Superadmin)
 */
exports.setSubjectCoefficient = async (req, res) => {
    try {
        const { subject_id, class_id, coefficient } = req.body;

        const query = `
            INSERT INTO subject_coefficients (subject_id, class_id, coefficient)
            VALUES ($1, $2, $3)
            ON CONFLICT (subject_id, class_id)
            DO UPDATE SET coefficient = $3, updated_at = NOW()
            RETURNING *
        `;

        const result = await db.query(query, [subject_id, class_id, coefficient]);

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error setting coefficient:', error);
        res.status(500).json({
            success: false,
            message: 'Error setting coefficient',
            error: error.message
        });
    }
};
