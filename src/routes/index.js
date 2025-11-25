/**
 * API Routes Configuration
 * Defines all API endpoints and their middleware
 */

const express = require('express');
const router = express.Router();

// Import middleware
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');

// Import controllers
const authController = require('../controllers/authController');
const courseController = require('../controllers/courseController');
const examController = require('../controllers/examController');
const agentController = require('../controllers/agentController');

// Import validators
const {
  validateRegister,
  validateLogin,
  validateCourse,
  validateExam,
  validateExamSubmission,
  validateSale,
  validateUUID
} = require('../utils/validation');

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public (except for agent role which requires admin)
 */
router.post('/auth/register', optionalAuth, validateRegister, authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user and get JWT token
 * @access  Public
 */
router.post('/auth/login', validateLogin, authController.login);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/auth/me', authenticate, authController.getProfile);

// ============================================
// COURSE ROUTES
// ============================================

/**
 * @route   POST /api/courses
 * @desc    Create a new course
 * @access  Private (Admin, Teacher)
 */
router.post(
  '/courses',
  authenticate,
  authorize('admin', 'teacher'),
  validateCourse,
  courseController.createCourse
);

/**
 * @route   GET /api/courses
 * @desc    Get all courses (with optional filters)
 * @access  Private
 */
router.get('/courses', authenticate, courseController.getCourses);

/**
 * @route   GET /api/courses/:id
 * @desc    Get course by ID
 * @access  Private
 */
router.get(
  '/courses/:id',
  authenticate,
  validateUUID('id'),
  courseController.getCourseById
);

/**
 * @route   PUT /api/courses/:id
 * @desc    Update course
 * @access  Private (Admin, Teacher - own courses)
 */
router.put(
  '/courses/:id',
  authenticate,
  authorize('admin', 'teacher'),
  validateUUID('id'),
  courseController.updateCourse
);

/**
 * @route   DELETE /api/courses/:id
 * @desc    Delete course
 * @access  Private (Admin only)
 */
router.delete(
  '/courses/:id',
  authenticate,
  authorize('admin'),
  validateUUID('id'),
  courseController.deleteCourse
);

// ============================================
// EXAM ROUTES
// ============================================

/**
 * @route   POST /api/exams
 * @desc    Create a new exam
 * @access  Private (Admin, Teacher)
 */
router.post(
  '/exams',
  authenticate,
  authorize('admin', 'teacher'),
  validateExam,
  examController.createExam
);

/**
 * @route   GET /api/exams
 * @desc    Get all exams (with optional filters)
 * @access  Private
 */
router.get('/exams', authenticate, examController.getExams);

/**
 * @route   GET /api/exams/:id
 * @desc    Get exam by ID
 * @access  Private
 */
router.get(
  '/exams/:id',
  authenticate,
  validateUUID('id'),
  examController.getExamById
);

/**
 * @route   POST /api/exams/:id/start
 * @desc    Start an exam (create exam attempt)
 * @access  Private (Student only)
 */
router.post(
  '/exams/:id/start',
  authenticate,
  authorize('student'),
  validateUUID('id'),
  examController.startExam
);

/**
 * @route   POST /api/exams/:id/submit
 * @desc    Submit exam answers
 * @access  Private (Student only)
 */
router.post(
  '/exams/:id/submit',
  authenticate,
  authorize('student'),
  validateUUID('id'),
  validateExamSubmission,
  examController.submitExam
);

/**
 * @route   GET /api/exams/:id/attempts
 * @desc    Get all attempts for an exam
 * @access  Private (Admin, Teacher)
 */
router.get(
  '/exams/:id/attempts',
  authenticate,
  authorize('admin', 'teacher'),
  validateUUID('id'),
  examController.getExamAttempts
);

// ============================================
// AGENT/SALES ROUTES
// ============================================

/**
 * @route   POST /api/agents/sales
 * @desc    Record a new sale
 * @access  Private (Agent only)
 */
router.post(
  '/agents/sales',
  authenticate,
  authorize('agent'),
  validateSale,
  agentController.recordSale
);

/**
 * @route   GET /api/agents/sales
 * @desc    Get all sales (agents: own sales, admins: all sales)
 * @access  Private (Agent, Admin)
 */
router.get(
  '/agents/sales',
  authenticate,
  authorize('agent', 'admin'),
  agentController.getSales
);

/**
 * @route   GET /api/agents/sales/:id
 * @desc    Get sale by ID
 * @access  Private (Agent, Admin)
 */
router.get(
  '/agents/sales/:id',
  authenticate,
  authorize('agent', 'admin'),
  validateUUID('id'),
  agentController.getSaleById
);

/**
 * @route   PUT /api/agents/sales/:id
 * @desc    Update sale payment status
 * @access  Private (Admin only)
 */
router.put(
  '/agents/sales/:id',
  authenticate,
  authorize('admin'),
  validateUUID('id'),
  agentController.updateSaleStatus
);

/**
 * @route   GET /api/agents/dashboard
 * @desc    Get agent dashboard with statistics
 * @access  Private (Agent only)
 */
router.get(
  '/agents/dashboard',
  authenticate,
  authorize('agent'),
  agentController.getAgentDashboard
);

// ============================================
// HEALTH CHECK
// ============================================

/**
 * @route   GET /api/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
