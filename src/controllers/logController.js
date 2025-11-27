/**
 * Activity Log Controller
 * Handles CRUD operations for activity logs
 */

const db = require('../config/database');

/**
 * Create a new activity log entry
 * Internal helper function
 */
const createLog = async ({
    userId = null,
    userEmail = null,
    action,
    entityType = null,
    entityId = null,
    details = {},
    ipAddress = null,
    userAgent = null,
    status = 'success'
}) => {
    try {
        const pool = await db.getPool();
        await pool.query(`
      INSERT INTO activity_logs (
        user_id, user_email, action, entity_type, entity_id, 
        details, ip_address, user_agent, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    `, [userId, userEmail, action, entityType, entityId, JSON.stringify(details), ipAddress, userAgent, status]);
    } catch (error) {
        console.error('Error creating activity log:', error);
        // Don't throw - logging failures shouldn't break the main operation
    }
};

/**
 * Get all activity logs with filtering and pagination
 * GET /api/logs
 */
exports.getAllLogs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 15,
            search = '',
            type = 'all',
            status = 'all',
            startDate = null,
            endDate = null
        } = req.query;

        const offset = (page - 1) * limit;
        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;

        // Search filter
        if (search) {
            whereConditions.push(`(
        action ILIKE $${paramIndex} OR 
        user_email ILIKE $${paramIndex} OR 
        details::text ILIKE $${paramIndex}
      )`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        // Type filter
        if (type && type !== 'all') {
            whereConditions.push(`entity_type = $${paramIndex}`);
            queryParams.push(type);
            paramIndex++;
        }

        // Status filter
        if (status && status !== 'all') {
            whereConditions.push(`status = $${paramIndex}`);
            queryParams.push(status);
            paramIndex++;
        }

        // Date range filter
        if (startDate) {
            whereConditions.push(`created_at >= $${paramIndex}`);
            queryParams.push(startDate);
            paramIndex++;
        }
        if (endDate) {
            whereConditions.push(`created_at <= $${paramIndex}`);
            queryParams.push(endDate + ' 23:59:59');
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        // Get total count
        const countQuery = `SELECT COUNT(*) FROM activity_logs ${whereClause}`;
        const countResult = await db.query(countQuery, queryParams);
        const totalLogs = parseInt(countResult.rows[0].count);

        // Get paginated logs
        const logsQuery = `
      SELECT 
        id,
        user_id,
        user_email,
        action,
        entity_type,
        entity_id,
        details,
        ip_address,
        user_agent,
        status,
        created_at
      FROM activity_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

        queryParams.push(parseInt(limit), offset);
        const logsResult = await db.query(logsQuery, queryParams);

        res.json({
            success: true,
            data: logsResult.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalLogs,
                totalPages: Math.ceil(totalLogs / limit)
            }
        });
    } catch (error) {
        console.error('Get all logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activity logs',
            error: error.message
        });
    }
};

/**
 * Get a single activity log by ID
 * GET /api/logs/:id
 */
exports.getLogById = async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
      SELECT 
        al.*,
        u.full_name as user_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.id = $1
    `;

        const result = await db.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Activity log not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Get log by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activity log',
            error: error.message
        });
    }
};

/**
 * Get activity log statistics
 * GET /api/logs/stats
 */
exports.getLogStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let dateFilter = '';
        let queryParams = [];

        if (startDate && endDate) {
            dateFilter = 'WHERE created_at >= $1 AND created_at <= $2';
            queryParams = [startDate, endDate + ' 23:59:59'];
        }

        const statsQuery = `
      SELECT 
        COUNT(*) as total_logs,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_actions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_actions,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
        COUNT(DISTINCT user_email) as unique_users,
        COUNT(CASE WHEN entity_type = 'auth' THEN 1 END) as auth_events,
        COUNT(CASE WHEN action LIKE '%Create%' OR action LIKE '%Création%' THEN 1 END) as creations,
        COUNT(CASE WHEN action LIKE '%Update%' OR action LIKE '%Modification%' THEN 1 END) as updates,
        COUNT(CASE WHEN action LIKE '%Delete%' OR action LIKE '%Suppression%' THEN 1 END) as deletions
      FROM activity_logs
      ${dateFilter}
    `;

        const result = await db.query(statsQuery, queryParams);

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Get log stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message
        });
    }
};

/**
 * Export activity logs as CSV
 * GET /api/logs/export
 */
exports.exportLogs = async (req, res) => {
    try {
        const {
            search = '',
            type = 'all',
            status = 'all',
            startDate = null,
            endDate = null
        } = req.query;

        let whereConditions = [];
        let queryParams = [];
        let paramIndex = 1;

        // Apply same filters as getAllLogs
        if (search) {
            whereConditions.push(`(
        action ILIKE $${paramIndex} OR 
        user_email ILIKE $${paramIndex} OR 
        details::text ILIKE $${paramIndex}
      )`);
            queryParams.push(`%${search}%`);
            paramIndex++;
        }

        if (type && type !== 'all') {
            whereConditions.push(`entity_type = $${paramIndex}`);
            queryParams.push(type);
            paramIndex++;
        }

        if (status && status !== 'all') {
            whereConditions.push(`status = $${paramIndex}`);
            queryParams.push(status);
            paramIndex++;
        }

        if (startDate) {
            whereConditions.push(`created_at >= $${paramIndex}`);
            queryParams.push(startDate);
            paramIndex++;
        }
        if (endDate) {
            whereConditions.push(`created_at <= $${paramIndex}`);
            queryParams.push(endDate + ' 23:59:59');
            paramIndex++;
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        const query = `
      SELECT 
        created_at,
        action,
        user_email,
        entity_type,
        ip_address,
        status,
        details
      FROM activity_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 10000
    `;

        const result = await db.query(query, queryParams);

        // Generate CSV
        const csvHeader = 'Date,Action,Utilisateur,Type,IP,Statut,Détails\n';
        const csvRows = result.rows.map(log => {
            const details = typeof log.details === 'object'
                ? JSON.stringify(log.details).replace(/"/g, '""')
                : String(log.details || '').replace(/"/g, '""');

            return [
                log.created_at,
                `"${log.action}"`,
                `"${log.user_email || 'Système'}"`,
                log.entity_type || '',
                log.ip_address || '',
                log.status,
                `"${details}"`
            ].join(',');
        }).join('\n');

        const csv = csvHeader + csvRows;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=activity-logs-${Date.now()}.csv`);
        res.send('\ufeff' + csv); // BOM for Excel UTF-8 support
    } catch (error) {
        console.error('Export logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export logs',
            error: error.message
        });
    }
};

// Export the createLog helper for use in other controllers
module.exports.createLog = createLog;
