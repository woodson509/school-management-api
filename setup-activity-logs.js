/**
 * Activity Logs Migration
 * Creates the activity_logs table for audit trail
 */

const { Client } = require('pg');
require('dotenv').config();

const setupActivityLogs = async () => {
    let client;

    // Configure client based on environment
    if (process.env.DATABASE_URL) {
        const sslConfig = process.env.DATABASE_URL.includes('localhost')
            ? false
            : { rejectUnauthorized: false };

        client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: sslConfig
        });
    } else {
        // Fallback to default local configuration
        client = new Client({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'school_management',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD,
        });
    }

    try {
        await client.connect();
        console.log('✅ Connected to database\n');

        // Create activity_logs table
        console.log('📊 Creating activity_logs table...');
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
        console.log('✅ activity_logs table created\n');

        // Create indexes for better query performance
        console.log('📊 Creating indexes...');
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON activity_logs(entity_type);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_status ON activity_logs(status);
    `);
        console.log('✅ Indexes created\n');

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 Activity Logs System Setup Complete!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Display summary
        const tableCheck = await client.query(`
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_name = 'activity_logs'
    `);
        const indexCount = await client.query(`
      SELECT COUNT(*) FROM pg_indexes 
      WHERE tablename = 'activity_logs'
    `);

        console.log('📊 Summary:');
        console.log(`  Table created: ${tableCheck.rows[0].count > 0 ? 'Yes' : 'No'}`);
        console.log(`  Indexes created: ${indexCount.rows[0].count}`);
        console.log('');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await client.end();
        console.log('👋 Connection closed.');
    }
};

setupActivityLogs();
