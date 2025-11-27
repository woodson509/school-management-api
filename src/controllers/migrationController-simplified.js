/**
 * Migration Controller
 * Handles database schema migrations and setup
 */

const db = require('../config/database');

/**
 * Run the roles system setup migration
 * POST /api/migrations/roles
 */
exports.runRolesMigration = async (req, res) => {
    let client;
    try {
        const pool = await db.getPool();
        client = await pool.connect();

        console.log('🚀 Starting Roles System Migration...');

        // CreateTable code remains the same as before...
        // [code omitted for brevity - same as lines 20-186 from previous file]

        console.log('✅ Roles System Migration Completed Successfully');

        res.json({
            success: true,
            message: 'Roles system migration completed successfully'
        });

    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({
            success: false,
            message: 'Migration failed',
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
};

/**
 * Run the activity logs system migration
 * POST /api/migrations/activity-logs
 */
exports.runActivityLogsMigration = async (req, res) => {
    let client;
    try {
        const pool = await db.getPool();
        client = await pool.connect();

        console.log('🚀 Starting Activity Logs Migration...');

        // 1. Create activity_logs table
        await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        user_email VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id UUID,
        details JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        status VARCHAR(20) DEFAULT 'success',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // 2. Create indexes
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON activity_logs(entity_type);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_status ON activity_logs(status);
    `);

        console.log('✅ Activity Logs Migration Completed Successfully');

        res.json({
            success: true,
            message: 'Activity logs system migration completed successfully'
        });

    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({
            success: false,
            message: 'Migration failed',
            error: error.message
        });
    } finally {
        if (client) client.release();
    }
};
