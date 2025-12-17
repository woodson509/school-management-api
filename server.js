/**
 * School Management API Server
 * Main entry point for the application
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./src/routes');
const db = require('./src/config/database');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : '*',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware (simple)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// ROUTES
// ============================================

// DEBUG ROUTE - TO BE REMOVED
// Must be defined BEFORE /api routes to avoid 404 handler issues if placed improperly
app.get('/api/debug/dump-grades', async (req, res) => {
  try {
    const client = await db.getClient();
    const result = await client.query(`
            SELECT id, student_id, exam_id, subject_id, class_id, value, created_at, recorded_by
            FROM grades 
            ORDER BY created_at DESC 
            LIMIT 50
        `);
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DEBUG ROUTE - TO BE REMOVED
app.get('/api/debug/dump-grades', async (req, res) => {
  try {
    const client = await db.getClient();
    const result = await client.query(`
            SELECT *
            FROM grades 
            ORDER BY created_at DESC 
            LIMIT 50
        `);
    client.release();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/debug/version', (req, res) => {
  res.json({
    version: 'v3-path-tracking',
    timestamp: new Date().toISOString(),
    controller: 'gradesControllerNew'
  });
});

// DEBUG: Test grades query directly (NO AUTH)
app.get('/api/debug/test-grades', async (req, res) => {
  try {
    const exam_id = req.query.exam_id;
    if (!exam_id) {
      return res.json({ error: 'exam_id required', received: req.query });
    }

    const cleanExamId = exam_id.trim();

    const query = `
      SELECT 
        g.*,
        u.full_name as student_name
      FROM grades g
      LEFT JOIN users u ON g.student_id = u.id
      WHERE g.exam_id = $1
      ORDER BY g.created_at DESC
    `;

    const result = await db.query(query, [cleanExamId]);

    res.json({
      received_exam_id: cleanExamId,
      exam_id_length: cleanExamId.length,
      rows_found: result.rows.length,
      data: result.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'School Management API',
    version: '1.0.1',
    endpoints: {
      health: '/api/health',
      documentation: '/api/docs',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/me'
      },
      courses: {
        create: 'POST /api/courses',
        list: 'GET /api/courses',
        get: 'GET /api/courses/:id',
        update: 'PUT /api/courses/:id',
        delete: 'DELETE /api/courses/:id'
      },
      exams: {
        create: 'POST /api/exams',
        list: 'GET /api/exams',
        get: 'GET /api/exams/:id',
        start: 'POST /api/exams/:id/start',
        submit: 'POST /api/exams/:id/submit',
        attempts: 'GET /api/exams/:id/attempts'
      },
      sales: {
        record: 'POST /api/agents/sales',
        list: 'GET /api/agents/sales',
        get: 'GET /api/agents/sales/:id',
        update: 'PUT /api/agents/sales/:id',
        dashboard: 'GET /api/agents/dashboard'
      }
    }
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler - must be after all other routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      error: err.message
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access',
      error: err.message
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// SERVER INITIALIZATION
// ============================================

/**
 * Test database connection before starting server
 */
const initializeServer = async () => {
  try {
    // Test database connection
    await db.query('SELECT NOW()');
    console.log('✓ Database connection verified');

    // Run critical setup/migrations
    try {
      console.log('Running critical setup...');
      await db.query(`
            -- ENSURE EXAMS TABLES EXIST
            CREATE TABLE IF NOT EXISTS exams (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                start_date TIMESTAMP,
                end_date TIMESTAMP,
                duration_minutes INTEGER,
                total_points INTEGER DEFAULT 20,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS exam_attempts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
                student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                score DECIMAL(5, 2),
                status VARCHAR(50) DEFAULT 'in_progress',
                submitted_at TIMESTAMP,
                graded_at TIMESTAMP,
                graded BOOLEAN DEFAULT false,
                feedback TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(exam_id, student_id)
            );

            -- ENSURE COLUMNS EXIST (Patch for existing tables)
            ALTER TABLE exams 
            ADD COLUMN IF NOT EXISTS start_date TIMESTAMP,
            ADD COLUMN IF NOT EXISTS end_date TIMESTAMP,
            ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
            ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 20,
            ADD COLUMN IF NOT EXISTS description TEXT;

            ALTER TABLE exam_attempts
            ADD COLUMN IF NOT EXISTS score DECIMAL(5, 2),
            ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'in_progress',
            ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS graded_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS graded BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS feedback TEXT;

            ALTER TABLE courses 
            ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL;
            
            CREATE INDEX IF NOT EXISTS idx_courses_subject_id ON courses(subject_id);

            -- DATA PATCH: Link courses to subjects automatically
            UPDATE courses c SET subject_id = s.id 
            FROM subjects s 
            WHERE c.subject_id IS NULL AND (
                c.title ILIKE '%' || s.name || '%' OR 
                s.name ILIKE '%' || c.title || '%'
            );
            
            -- HARD FIX: Ensure the reported course is linked to Mathematics if still null
            UPDATE courses 
            SET subject_id = (SELECT id FROM subjects WHERE name ILIKE '%Math%' LIMIT 1)
            WHERE id = '94482bd0-543e-4c73-b2b2-a9ce78ef7833' AND subject_id IS NULL;

            -- NUCLEAR OPTION: If still null, create default subject and link to it
            INSERT INTO subjects (name, code) VALUES ('Matière Par Défaut', 'DEFAULT') ON CONFLICT (code) DO NOTHING;
            
            -- CATCH-ALL: Force link ALL remaining orphaned courses to the default subject
            UPDATE courses 
            SET subject_id = (SELECT id FROM subjects WHERE code = 'DEFAULT' LIMIT 1)
            WHERE subject_id IS NULL;

            -- SCHEME FIX: Add exam_id to grades
            ALTER TABLE grades 
            ADD COLUMN IF NOT EXISTS exam_id UUID REFERENCES exams(id) ON DELETE SET NULL;
            
            CREATE INDEX IF NOT EXISTS idx_grades_exam_id ON grades(exam_id);

            -- SCHEME FIX: Add school_id to subjects (was missing)
            ALTER TABLE subjects 
            ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
            
            CREATE INDEX IF NOT EXISTS idx_subjects_school_id ON subjects(school_id);

            -- DATA CLEANUP: Remove DUPLICATE report periods (Keep newest per name/year)
            DELETE FROM report_periods a USING report_periods b 
            WHERE a.id < b.id 
              AND a.name = b.name 
              AND a.school_year = b.school_year;
            
            -- CONSTRAINT: Prevent future duplicate periods
            ALTER TABLE report_periods 
            DROP CONSTRAINT IF EXISTS uq_report_periods_name_year;
            
            ALTER TABLE report_periods 
            ADD CONSTRAINT uq_report_periods_name_year UNIQUE (name, school_year);

            -- DATA PATCH: Ensure report periods exist (Safe insert now with constraint)
            INSERT INTO report_periods (name, period_type, school_year, start_date, end_date, is_active, order_number) VALUES
            ('Trimestre 1', 'trimester', '2024-2025', '2024-09-01', '2024-12-31', true, 1),
            ('Trimestre 2', 'trimester', '2024-2025', '2025-01-01', '2025-03-31', false, 2),
            ('Trimestre 3', 'trimester', '2024-2025', '2025-04-01', '2025-06-30', false, 3)
            ON CONFLICT (name, school_year) DO NOTHING;
        `);
      console.log('✓ Critical migrations and DATA PATCH applied');
    } catch (err) {
      console.warn('Warning during critical setup:', err.message);
    }

    // DEBUG ROUTE - TO BE REMOVED
    app.get('/api/debug/dump-grades', async (req, res) => {
      try {
        const client = await db.getClient();
        const result = await client.query(`
                SELECT id, student_id, exam_id, subject_id, class_id, value, created_at, recorded_by
                FROM grades 
                ORDER BY created_at DESC 
                LIMIT 50
            `);
        client.release();
        res.json(result.rows);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Start server
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(50));
      console.log(`🚀 School Management API Server`);
      console.log('='.repeat(50));
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Server running on: http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
      console.log('='.repeat(50) + '\n');
    });

  } catch (error) {
    console.error('❌ Failed to initialize server:', error.message);
    console.error('Please check your database configuration and ensure PostgreSQL is running.');
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  if (db.closePool) {
    await db.closePool();
    console.log('Database pool closed');
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received. Shutting down gracefully...');
  if (db.closePool) {
    await db.closePool();
    console.log('Database pool closed');
  }
  process.exit(0);
});

// Start the server
initializeServer();

module.exports = app;
