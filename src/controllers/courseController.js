/**
 * Course Controller
 * Handles course creation and management
 */

const db = require('../config/database');

/**
 * Create a new course
 * POST /api/courses
 * Access: Admin, Teacher
 */
const createCourse = async (req, res) => {
  try {
    const { title, description, code, credits, school_id, teacher_id, class_id } = req.body;

    // Authorization check
    if (req.user.role === 'teacher') {
      // Teachers can only create courses for their own school
      if (req.user.school_id !== school_id) {
        return res.status(403).json({
          success: false,
          message: 'You can only create courses for your school'
        });
      }
    }

    // Check if course code already exists in the school
    const existingCourse = await db.query(
      'SELECT id FROM courses WHERE school_id = $1 AND code = $2',
      [school_id, code]
    );

    if (existingCourse.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Course code already exists in this school'
      });
    }

    // Verify school exists
    const schoolCheck = await db.query(
      'SELECT id FROM schools WHERE id = $1',
      [school_id]
    );

    if (schoolCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }

    // If teacher_id provided, verify teacher exists and belongs to school
    if (teacher_id) {
      const teacherCheck = await db.query(
        'SELECT id FROM users WHERE id = $1 AND role = $2 AND school_id = $3',
        [teacher_id, 'teacher', school_id]
      );

      if (teacherCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Teacher not found or does not belong to this school'
        });
      }
    }

    // If class_id provided, verify class exists
    if (class_id) {
      const classCheck = await db.query(
        'SELECT id FROM classes WHERE id = $1',
        [class_id]
      );

      if (classCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Class not found'
        });
      }
    }

    // Create course
    const result = await db.query(
      `INSERT INTO courses (school_id, teacher_id, class_id, title, description, code, credits)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [school_id, teacher_id || null, class_id || null, title, description || null, code, credits || 0]
    );

    const course = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: course
    });

  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create course',
      error: error.message
    });
  }
};

/**
 * Get all courses (with optional filtering)
 * GET /api/courses
 */
const getCourses = async (req, res) => {
  try {
    const { school_id, teacher_id, is_active } = req.query;

    let query = `
      SELECT c.*, u.full_name as teacher_name, s.name as school_name, cl.name as class_name
      FROM courses c
      LEFT JOIN users u ON c.teacher_id = u.id
      LEFT JOIN schools s ON c.school_id = s.id
      LEFT JOIN classes cl ON c.class_id = cl.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // Apply filters
    if (school_id) {
      query += ` AND c.school_id = $${paramCount}`;
      params.push(school_id);
      paramCount++;
    }

    if (teacher_id) {
      query += ` AND c.teacher_id = $${paramCount}`;
      params.push(teacher_id);
      paramCount++;
    }

    if (is_active !== undefined) {
      query += ` AND c.is_active = $${paramCount}`;
      params.push(is_active === 'true');
      paramCount++;
    }

    // Students and teachers see only their school's courses
    if (req.user.role === 'student' || req.user.role === 'teacher') {
      query += ` AND c.school_id = $${paramCount}`;
      params.push(req.user.school_id);
    }

    query += ' ORDER BY c.created_at DESC';

    const result = await db.query(query, params);

    res.status(200).json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch courses',
      error: error.message
    });
  }
};

/**
 * Get course by ID
 * GET /api/courses/:id
 */
const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT c.*, u.full_name as teacher_name, s.name as school_name, cl.name as class_name
       FROM courses c
       LEFT JOIN users u ON c.teacher_id = u.id
       LEFT JOIN schools s ON c.school_id = s.id
       LEFT JOIN classes cl ON c.class_id = cl.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const course = result.rows[0];

    // Authorization check - students/teachers can only view their school's courses
    if ((req.user.role === 'student' || req.user.role === 'teacher')
      && course.school_id !== req.user.school_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: course
    });

  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch course',
      error: error.message
    });
  }
};

/**
 * Update course
 * PUT /api/courses/:id
 * Access: Admin, Teacher (own courses)
 */
const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, code, credits, teacher_id, class_id, is_active } = req.body;

    // Check if course exists
    const courseCheck = await db.query(
      'SELECT * FROM courses WHERE id = $1',
      [id]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    const course = courseCheck.rows[0];

    // Authorization check
    if (req.user.role === 'teacher' && course.teacher_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own courses'
      });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount}`);
      params.push(title);
      paramCount++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      params.push(description);
      paramCount++;
    }
    if (code !== undefined) {
      updates.push(`code = $${paramCount}`);
      params.push(code);
      paramCount++;
    }
    if (credits !== undefined) {
      updates.push(`credits = $${paramCount}`);
      params.push(credits);
      paramCount++;
    }
    if (teacher_id !== undefined) {
      updates.push(`teacher_id = $${paramCount}`);
      params.push(teacher_id);
      paramCount++;
    }
    if (class_id !== undefined) {
      updates.push(`class_id = $${paramCount}`);
      params.push(class_id);
      paramCount++;
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      params.push(is_active);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    params.push(id);
    const query = `UPDATE courses SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await db.query(query, params);

    res.status(200).json({
      success: true,
      message: 'Course updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update course',
      error: error.message
    });
  }
};

/**
 * Delete course
 * DELETE /api/courses/:id
 * Access: Admin only
 */
const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM courses WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully'
    });

  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete course',
      error: error.message
    });
  }
};

module.exports = {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse
};
