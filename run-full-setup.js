/**
 * Run Full Setup
 * 1. Creates base tables (Schools, Classes, Subjects, Users)
 * 2. Applies migrations for Report Cards and Advanced Features
 */

const fs = require('fs');
const path = require('path');
const db = require('./src/config/database');

async function runFullSetup() {
    try {
        console.log('🔌 Connecting to database...');
        await db.query('SELECT NOW()');
        console.log('✅ Connected!\n');

        // ==========================================
        // 1. BASE SCHEMA (from setup-database.js)
        // ==========================================
        console.log('🏗️  Checking/Creating Base Schema...');

        // Schools
        await db.query(`
            CREATE TABLE IF NOT EXISTS schools (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                address TEXT,
                phone VARCHAR(50),
                email VARCHAR(255),
                website VARCHAR(255),
                principal_name VARCHAR(255),
                created_by UUID,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('   - schools table checked');

        // Users (Create first because classes reference it)
        // Note: Using gen_random_uuid() instead of uuid_generate_v4() for standard PG support
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                full_name VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'teacher', 'student', 'agent', 'superadmin')),
                school_id UUID REFERENCES schools(id),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('   - users table checked');

        // Classes
        await db.query(`
            CREATE TABLE IF NOT EXISTS classes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                grade_level VARCHAR(50) NOT NULL,
                school_year VARCHAR(20) NOT NULL,
                teacher_id UUID REFERENCES users(id),
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('   - classes table checked');

        // Subjects
        await db.query(`
            CREATE TABLE IF NOT EXISTS subjects (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                code VARCHAR(50),
                description TEXT,
                credits INTEGER DEFAULT 1,
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(code)
            );
        `);
        console.log('   - subjects table checked');

        // Report Periods (Needed for report cards)
        await db.query(`
            CREATE TABLE IF NOT EXISTS report_periods (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(100) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                school_id UUID REFERENCES schools(id),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('   - report_periods table checked');

        console.log('✅ Base Schema Ready.\n');

        // ==========================================
        // 2. APPLY MIGRATIONS
        // ==========================================
        console.log('🚀 Applying Fix Migrations (Report Cards & Advanced)...');

        const sqlFile = path.join(__dirname, 'migrations', 'fix_migrations.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');

        await db.query(sql);

        console.log('✅ Migrations applied successfully!');

    } catch (error) {
        console.error('\n❌ Setup failed!');
        console.error('Error:', error.message);
        if (error.detail) console.error('Detail:', error.detail);
        process.exit(1);
    } finally {
        if (db.pool) {
            await db.pool.end();
            console.log('👋 Connection closed.');
        }
    }
}

runFullSetup();
