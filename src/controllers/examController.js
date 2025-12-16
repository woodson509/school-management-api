/**
 * Exam Controller
 * Handles exam creation, starting, and submission
 */

const db = require('../config/database');

/**
 * Create a new exam
 * POST /api/exams
 * Access: Admin, Teacher
 */
const createExam = async (req, res) => {
  try {
    const {
      course_id,
      title,
      description,
      duration_minutes,
      total_marks,
      passing_marks,
      exam_date,
      type
    } = req.body;

    // Verify course exists
    const courseCheck = await db.query(
      'SELECT * FROM courses WHERE id = $1',
      [course_id]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const course = courseCheck.rows[0];

    // Authorization check - teachers can only create exams for their courses
    if (req.user.role === 'teacher') {
      if (course.teacher_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only create exams for your own courses'
        });
      }
    }

    // Create exam
    const result = await db.query(
      `INSERT INTO exams (
        course_id, created_by, title, description,
        duration_minutes, total_marks, passing_marks, exam_date
      )
        duration_minutes, total_marks, passing_marks, exam_date, type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        course_id,
        req.user.id,
        title,
        description || null,
        duration_minutes,
        total_marks,
        passing_marks,
        passing_marks,
        exam_date || null,
        type || 'written'
      ]
    );

    const exam = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'Exam created successfully',
      data: exam
    });

  } catch (error) {
    console.error('Create exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create exam',
      error: error.message
    });
  }
};

/**
 * Get all exams (with optional filtering)
 * GET /api/exams
 */
const getExams = async (req, res) => {
  try {
    const { course_id, is_published } = req.query;

    let query = `
      SELECT e.*, c.title as course_title, c.code as course_code, c.subject_id, c.subject_id as c_subject_id,
             cl.name as class_name,
             s.name as subject_name,
             u.full_name as created_by_name
      FROM exams e
      JOIN courses c ON e.course_id = c.id
      LEFT JOIN classes cl ON c.class_id = cl.id
      LEFT JOIN subjects s ON c.subject_id = s.id
      JOIN users u ON e.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // Apply filters
    if (course_id) {
      query += ` AND e.course_id = $${paramCount}`;
      params.push(course_id);
      paramCount++;
    }

    if (is_published !== undefined) {
      query += ` AND e.is_published = $${paramCount}`;
      params.push(is_published === 'true');
      paramCount++;
    }

    // Students see only published exams from their school
    if (req.user.role === 'student') {
      query += ` AND e.is_published = true AND c.school_id = $${paramCount}`;
      params.push(req.user.school_id);
      paramCount++;
    }

    // Teachers see exams from their school
    if (req.user.role === 'teacher') {
      query += ` AND c.school_id = $${paramCount}`;
      params.push(req.user.school_id);
      paramCount++;
    }

    // Admins see exams from their school only
    if (req.user.role === 'admin') {
      query += ` AND c.school_id = $${paramCount}`;
      params.push(req.user.school_id);
      paramCount++;
    }

    query += ' ORDER BY e.created_at DESC';

    console.log(`[DEBUG] Executing Exam Query: ${query}`);
    console.log(`[DEBUG] Params: ${JSON.stringify(params)}`);

    const result = await db.query(query, params);

    if (result.rows.length > 0) {
      console.log('[DEBUG] First exam result sample:', JSON.stringify(result.rows[0]));
    }

    // Post-processing to ensure subject_id is present
    const processedRows = result.rows.map(row => ({
      ...row,
      subject_id: row.subject_id || row.c_subject_id || null // Fallback
    }));

    res.status(200).json({
      success: true,
      data: processedRows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Get exams error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exams',
      error: error.message
    });
  }
};

/**
 * Get exam by ID
 * GET /api/exams/:id
 */
const getExamById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT e.*, c.title as course_title, c.code as course_code, c.school_id,
              cl.name as class_name, s.name as subject_name,
              u.full_name as created_by_name
       FROM exams e
       JOIN courses c ON e.course_id = c.id
       LEFT JOIN classes cl ON c.class_id = cl.id
       LEFT JOIN subjects s ON c.subject_id = s.id
       JOIN users u ON e.created_by = u.id
       WHERE e.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    const exam = result.rows[0];

    // Authorization check
    if (req.user.role === 'student') {
      if (!exam.is_published || exam.school_id !== req.user.school_id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    if (req.user.role === 'teacher' && exam.school_id !== req.user.school_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: exam
    });

  } catch (error) {
    console.error('Get exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exam',
      error: error.message
    });
  }
};

/**
 * Start an exam (create exam attempt)
 * POST /api/exams/:id/start
 * Access: Student only
 */
const startExam = async (req, res) => {
  try {
    const { id: exam_id } = req.params;
    const student_id = req.user.id;

    // Verify exam exists and is published
    const examCheck = await db.query(
      `SELECT e.*, c.school_id
       FROM exams e
       JOIN courses c ON e.course_id = c.id
       WHERE e.id = $1 AND e.is_published = true`,
      [exam_id]
    );

    if (examCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found or not published'
      });
    }

    const exam = examCheck.rows[0];

    // Check if student belongs to the same school
    if (exam.school_id !== req.user.school_id) {
      return res.status(403).json({
        success: false,
        message: 'You cannot take exams from other schools'
      });
    }

    // Check if student has already attempted this exam
    const attemptCheck = await db.query(
      'SELECT id, status FROM exam_attempts WHERE exam_id = $1 AND student_id = $2',
      [exam_id, student_id]
    );

    if (attemptCheck.rows.length > 0) {
      const existingAttempt = attemptCheck.rows[0];

      if (existingAttempt.status === 'in_progress') {
        return res.status(409).json({
          success: false,
          message: 'You have already started this exam',
          data: existingAttempt
        });
      }

      if (existingAttempt.status === 'submitted' || existingAttempt.status === 'graded') {
        return res.status(409).json({
          success: false,
          message: 'You have already completed this exam'
        });
      }
    }

    // Create exam attempt
    const result = await db.query(
      `INSERT INTO exam_attempts (exam_id, student_id, started_at, status)
       VALUES ($1, $2, CURRENT_TIMESTAMP, 'in_progress')
       RETURNING *`,
      [exam_id, student_id]
    );

    const attempt = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'Exam started successfully',
      data: {
        attempt_id: attempt.id,
        exam_id: attempt.exam_id,
        started_at: attempt.started_at,
        duration_minutes: exam.duration_minutes,
        total_marks: exam.total_marks
      }
    });

  } catch (error) {
    console.error('Start exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start exam',
      error: error.message
    });
  }
};

/**
 * Submit exam answers
 * POST /api/exams/:id/submit
 * Access: Student only
 */
const submitExam = async (req, res) => {
  try {
    const { id: exam_id } = req.params;
    const { answers } = req.body;
    const student_id = req.user.id;

    // Check if there's an in-progress attempt
    const attemptCheck = await db.query(
      `SELECT ea.*, e.duration_minutes
       FROM exam_attempts ea
       JOIN exams e ON ea.exam_id = e.id
       WHERE ea.exam_id = $1 AND ea.student_id = $2 AND ea.status = 'in_progress'`,
      [exam_id, student_id]
    );

    if (attemptCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active exam attempt found. Please start the exam first.'
      });
    }

    const attempt = attemptCheck.rows[0];

    // Calculate time taken
    const startedAt = new Date(attempt.started_at);
    const submittedAt = new Date();
    const timeTakenMinutes = Math.round((submittedAt - startedAt) / 60000);

    // Check if time limit exceeded
    if (timeTakenMinutes > attempt.duration_minutes) {
      return res.status(400).json({
        success: false,
        message: `Time limit exceeded. Maximum allowed: ${attempt.duration_minutes} minutes`
      });
    }

    // Update exam attempt with submission
    const result = await db.query(
      `UPDATE exam_attempts
       SET answers = $1, submitted_at = CURRENT_TIMESTAMP,
           time_taken_minutes = $2, status = 'submitted'
       WHERE id = $3
       RETURNING *`,
      [JSON.stringify(answers), timeTakenMinutes, attempt.id]
    );

    const submittedAttempt = result.rows[0];

    res.status(200).json({
      success: true,
      message: 'Exam submitted successfully',
      data: {
        attempt_id: submittedAttempt.id,
        submitted_at: submittedAttempt.submitted_at,
        time_taken_minutes: submittedAttempt.time_taken_minutes,
        status: submittedAttempt.status
      }
    });

  } catch (error) {
    console.error('Submit exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit exam',
      error: error.message
    });
  }
};

/**
 * Get exam attempts for an exam
 * GET /api/exams/:id/attempts
 * Access: Admin, Teacher (own courses)
 */
const getExamAttempts = async (req, res) => {
  try {
    const { id: exam_id } = req.params;

    // Verify exam exists
    const examCheck = await db.query(
      `SELECT e.*, c.teacher_id, c.school_id
       FROM exams e
       JOIN courses c ON e.course_id = c.id
       WHERE e.id = $1`,
      [exam_id]
    );

    if (examCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    const exam = examCheck.rows[0];

    // Authorization check
    if (req.user.role === 'teacher' && exam.teacher_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get all attempts for this exam
    const result = await db.query(
      `SELECT ea.*, u.full_name as student_name, u.email as student_email
       FROM exam_attempts ea
       JOIN users u ON ea.student_id = u.id
       WHERE ea.exam_id = $1
       ORDER BY ea.submitted_at DESC`,
      [exam_id]
    );

    res.status(200).json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Get exam attempts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exam attempts',
      error: error.message
    });
  }
};

/**
 * Update exam
 * PUT /api/exams/:id
 * Access: Admin, Teacher (own courses)
 */
const updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      course_id,
      title,
      description,
      duration_minutes,
      total_marks,
      passing_marks,
      exam_date,
      is_published
    } = req.body;

    // Verify exam exists
    const examCheck = await db.query(
      `SELECT e.*, c.teacher_id, c.school_id
       FROM exams e
       JOIN courses c ON e.course_id = c.id
       WHERE e.id = $1`,
      [id]
    );

    if (examCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    const exam = examCheck.rows[0];

    // Authorization check
    if (req.user.role === 'teacher' && exam.teacher_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update exams for your own courses'
      });
    }

    if (exam.school_id !== req.user.school_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update exam
    const result = await db.query(
      `UPDATE exams
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           duration_minutes = COALESCE($3, duration_minutes),
           total_marks = COALESCE($4, total_marks),
           passing_marks = COALESCE($5, passing_marks),
           exam_date = COALESCE($6, exam_date),
           is_published = COALESCE($7, is_published),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        title || null,
        description || null,
        duration_minutes || null,
        total_marks || null,
        passing_marks || null,
        exam_date || null,
        is_published !== undefined ? is_published : null,
        id
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Exam updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update exam',
      error: error.message
    });
  }
};

/**
 * Delete exam
 * DELETE /api/exams/:id
 * Access: Admin, Teacher (own courses)
 */
const deleteExam = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify exam exists
    const examCheck = await db.query(
      `SELECT e.*, c.teacher_id, c.school_id
       FROM exams e
       JOIN courses c ON e.course_id = c.id
       WHERE e.id = $1`,
      [id]
    );

    if (examCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    const exam = examCheck.rows[0];

    // Authorization check
    if (req.user.role === 'teacher' && exam.teacher_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete exams for your own courses'
      });
    }

    if (exam.school_id !== req.user.school_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete exam (this will also cascade delete exam_attempts if set up)
    await db.query('DELETE FROM exams WHERE id = $1', [id]);

    res.status(200).json({
      success: true,
      message: 'Exam deleted successfully'
    });

  } catch (error) {
    console.error('Delete exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete exam',
      error: error.message
    });
  }
};

module.exports = {
  createExam,
  getExams,
  getExamById,
  startExam,
  submitExam,
  getExamAttempts,
  updateExam,
  deleteExam
};
