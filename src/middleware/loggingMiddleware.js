/**
 * Logging Middleware
 * Automatically tracks user actions for audit trail
 */

const { createLog } = require('../controllers/logController');

/**
 * Extract client IP address
 */
const getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        null;
};

/**
 * Determine action type from request
 */
const getActionFromRequest = (req) => {
    const method = req.method;
    const path = req.path;

    // Auth actions
    if (path.includes('/login')) return 'Connexion';
    if (path.includes('/logout')) return 'Déconnexion';
    if (path.includes('/register')) return 'Inscription';

    // Generic CRUD actions
    if (method === 'POST') return 'Création';
    if (method === 'PUT' || method === 'PATCH') return 'Modification';
    if (method === 'DELETE') return 'Suppression';
    if (method === 'GET') return 'Consultation';

    return 'Action';
};

/**
 * Determine entity type from path
 */
const getEntityTypeFromPath = (path) => {
    if (path.includes('/users')) return 'user';
    if (path.includes('/schools')) return 'school';
    if (path.includes('/courses')) return 'course';
    if (path.includes('/exams')) return 'exam';
    if (path.includes('/grades')) return 'grade';
    if (path.includes('/classes')) return 'class';
    if (path.includes('/subjects')) return 'subject';
    if (path.includes('/agents')) return 'agent';
    if (path.includes('/roles')) return 'role';
    if (path.includes('/permissions')) return 'permission';
    if (path.includes('/students')) return 'student';
    if (path.includes('/teachers')) return 'teacher';
    if (path.includes('/auth')) return 'auth';
    if (path.includes('/dashboard')) return 'dashboard';
    return null;
};

/**
 * Logging middleware
 * Logs successful requests after response is sent
 */
const logActivity = (req, res, next) => {
    // Skip logging for certain paths
    const skipPaths = ['/health', '/api/logs', '/api/dashboard'];
    if (skipPaths.some(path => req.path.includes(path))) {
        return next();
    }

    // Skip GET requests to reduce log volume (optional)
    if (req.method === 'GET') {
        return next();
    }

    // Capture response
    const originalJson = res.json;
    res.json = function (data) {
        // Only log successful operations
        if (data && data.success !== false && res.statusCode < 400) {
            const actionType = getActionFromRequest(req);
            const entityType = getEntityTypeFromPath(req.path);

            // Extract entity ID from response or params
            let entityId = null;
            if (data.data?.id) {
                entityId = data.data.id;
            } else if (req.params.id) {
                entityId = req.params.id;
            }

            // Create log entry asynchronously (don't wait)
            createLog({
                userId: req.user?.id || null,
                userEmail: req.user?.email || null,
                action: `${actionType} ${entityType || 'ressource'}`,
                entityType,
                entityId,
                details: {
                    method: req.method,
                    path: req.path,
                    body: req.body ? Object.keys(req.body) : [],
                    statusCode: res.statusCode
                },
                ipAddress: getClientIp(req),
                userAgent: req.headers['user-agent'] || null,
                status: 'success'
            }).catch(err => {
                console.error('Failed to create activity log:', err);
            });
        }

        // Call original json method
        return originalJson.call(this, data);
    };

    next();
};

/**
 * Manual logging helper for special cases
 */
const logManualAction = async (req, action, details = {}) => {
    try {
        await createLog({
            userId: req.user?.id || null,
            userEmail: req.user?.email || null,
            action,
            entityType: details.entityType || null,
            entityId: details.entityId || null,
            details: details.data || {},
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent'] || null,
            status: details.status || 'success'
        });
    } catch (error) {
        console.error('Failed to log manual action:', error);
    }
};

module.exports = {
    logActivity,
    logManualAction,
    getClientIp
};
