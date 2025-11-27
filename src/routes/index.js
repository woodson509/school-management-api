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
const dashboardController = require('../controllers/dashboardController');
const schoolController = require('../controllers/schoolController');
const userController = require('../controllers/userController');
const classController = require('../controllers/classController');
const subjectController = require('../controllers/subjectController');
const roleController = require('../controllers/roleController');
const migrationController = require('../controllers/migrationController');

// Import validators
const {
  validateRegister,
  validateLogin,
  validateCourse,
  validateExam,
  validateExamSubmission,
  validateSale,
  validateUUID,
  validateSchool,
  validateClass,
  validateSubject,
  validateUserUpdate,
  validatePasswordChange
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
  authorize('agent', 'admin', 'superadmin'),
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
  authorize('agent', 'admin', 'superadmin'),
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
  authorize('admin', 'superadmin'),
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

/**
 * @route   GET /api/agents
 * @desc    Get all agents
 * @access  Private (Superadmin, Admin)
 */
router.get(
  '/agents',
  authenticate,
  authorize('superadmin', 'admin'),
  agentController.getAgents
);

/**
 * @route   GET /api/agents/:id
 * @desc    Get agent by ID
 * @access  Private (Superadmin, Admin, Own)
 */
router.get(
  '/agents/:id',
  authenticate,
  authorize('superadmin', 'admin', 'agent'),
  validateUUID('id'),
  agentController.getAgentById
);

/**
 * @route   POST /api/agents
 * @desc    Create a new agent
 * @access  Private (Superadmin, Admin)
 */
router.post(
  '/agents',
  authenticate,
  authorize('superadmin', 'admin'),
  agentController.createAgent
);

/**
 * @route   PUT /api/agents/:id
 * @desc    Update agent
 * @access  Private (Superadmin, Admin)
 */
router.put(
  '/agents/:id',
  authenticate,
  authorize('superadmin', 'admin'),
  validateUUID('id'),
  agentController.updateAgent
);

/**
 * @route   DELETE /api/agents/:id
 * @desc    Delete agent
 * @access  Private (Superadmin only)
 */
router.delete(
  '/agents/:id',
  authenticate,
  authorize('superadmin'),
  validateUUID('id'),
  agentController.deleteAgent
);

/**
 * @route   GET /api/agents/:id/stats
 * @desc    Get agent statistics
 * @access  Private (Superadmin, Admin, Own)
 */
router.get(
  '/agents/:id/stats',
  authenticate,
  authorize('superadmin', 'admin', 'agent'),
  validateUUID('id'),
  agentController.getAgentStats
);

// ============================================
// DASHBOARD ROUTES
// ============================================

/**
 * @route   GET /api/dashboard/superadmin
 * @desc    Get superadmin dashboard stats
 * @access  Private (Superadmin only)
 */
router.get(
  '/dashboard/superadmin',
  authenticate,
  authorize('superadmin'),
  dashboardController.getSuperAdminDashboard
);

/**
 * @route   GET /api/dashboard/admin
 * @desc    Get admin dashboard stats
 * @access  Private (Admin only)
 */
router.get(
  '/dashboard/admin',
  authenticate,
  authorize('admin'),
  dashboardController.getAdminDashboard
);

/**
 * @route   GET /api/dashboard/teacher
 * @desc    Get teacher dashboard stats
 * @access  Private (Teacher only)
 */
router.get(
  '/dashboard/teacher',
  authenticate,
  authorize('teacher'),
  dashboardController.getTeacherDashboard
);

/**
 * @route   GET /api/dashboard/student
 * @desc    Get student dashboard stats
 * @access  Private (Student only)
 */
router.get(
  '/dashboard/student',
  authenticate,
  authorize('student'),
  dashboardController.getStudentDashboard
);

// ============================================
// SCHOOL ROUTES
// ============================================

/**
 * @route   POST /api/schools
 * @desc    Create a new school
 * @access  Private (Superadmin, Admin)
 */
router.post(
  '/schools',
  authenticate,
  authorize('superadmin', 'admin'),
  validateSchool,
  schoolController.createSchool
);

/**
 * @route   GET /api/schools
 * @desc    Get all schools
 * @access  Private (Superadmin, Admin)
 */
router.get(
  '/schools',
  authenticate,
  authorize('superadmin', 'admin'),
  schoolController.getSchools
);

/**
 * @route   GET /api/schools/:id
 * @desc    Get school by ID
 * @access  Private
 */
router.get(
  '/schools/:id',
  authenticate,
  validateUUID('id'),
  schoolController.getSchoolById
);

/**
 * @route   PUT /api/schools/:id
 * @desc    Update school
 * @access  Private (Superadmin, Admin)
 */
router.put(
  '/schools/:id',
  authenticate,
  authorize('superadmin', 'admin'),
  validateUUID('id'),
  validateSchool,
  schoolController.updateSchool
);

/**
 * @route   DELETE /api/schools/:id
 * @desc    Delete school
 * @access  Private (Superadmin, Admin)
 */
router.delete(
  '/schools/:id',
  authenticate,
  authorize('superadmin', 'admin'),
  validateUUID('id'),
  schoolController.deleteSchool
);

// ============================================
// USER MANAGEMENT ROUTES
// ============================================

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @access  Private (Admin, Superadmin)
 */
router.post(
  '/users',
  authenticate,
  authorize('admin', 'superadmin'),
  userController.createUser
);

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Private (Admin, Superadmin)
 */
router.get(
  '/users',
  authenticate,
  authorize('admin', 'superadmin'),
  userController.getUsers
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get(
  '/users/:id',
  authenticate,
  validateUUID('id'),
  userController.getUserById
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (Admin, Superadmin, or own profile)
 */
router.put(
  '/users/:id',
  authenticate,
  validateUUID('id'),
  validateUserUpdate,
  userController.updateUser
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Private (Admin, Superadmin)
 */
router.delete(
  '/users/:id',
  authenticate,
  authorize('admin', 'superadmin'),
  validateUUID('id'),
  userController.deleteUser
);

/**
 * @route   PATCH /api/users/:id/password
 * @desc    Change user password
 * @access  Private (Admin or own password)
 */
router.patch(
  '/users/:id/password',
  authenticate,
  validateUUID('id'),
  validatePasswordChange,
  userController.changePassword
);

// ============================================
// CLASS ROUTES
// ============================================

/**
 * @route   POST /api/classes
 * @desc    Create a new class
 * @access  Private (Admin, Superadmin)
 */
router.post(
  '/classes',
  authenticate,
  authorize('admin', 'superadmin'),
  validateClass,
  classController.createClass
);

/**
 * @route   GET /api/classes
 * @desc    Get all classes
 * @access  Private
 */
router.get(
  '/classes',
  authenticate,
  classController.getClasses
);

/**
 * @route   GET /api/classes/:id
 * @desc    Get class by ID
 * @access  Private
 */
router.get(
  '/classes/:id',
  authenticate,
  validateUUID('id'),
  classController.getClassById
);

/**
 * @route   PUT /api/classes/:id
 * @desc    Update class
 * @access  Private (Admin, Superadmin)
 */
router.put(
  '/classes/:id',
  authenticate,
  authorize('admin', 'superadmin'),
  validateUUID('id'),
  validateClass,
  classController.updateClass
);

/**
 * @route   DELETE /api/classes/:id
 * @desc    Delete class
 * @access  Private (Admin, Superadmin)
 */
router.delete(
  '/classes/:id',
  authenticate,
  authorize('admin', 'superadmin'),
  validateUUID('id'),
  classController.deleteClass
);

// ============================================
// SUBJECT ROUTES
// ============================================

/**
 * @route   POST /api/subjects
 * @desc    Create a new subject
 * @access  Private (Admin, Superadmin)
 */
router.post(
  '/subjects',
  authenticate,
  authorize('admin', 'superadmin'),
  validateSubject,
  subjectController.createSubject
);

/**
 * @route   GET /api/subjects
 * @desc    Get all subjects
 * @access  Private
 */
router.get(
  '/subjects',
  authenticate,
  subjectController.getSubjects
);

/**
 * @route   GET /api/subjects/:id
 * @desc    Get subject by ID
 * @access  Private
 */
router.get(
  '/subjects/:id',
  authenticate,
  validateUUID('id'),
  subjectController.getSubjectById
);

/**
 * @route   PUT /api/subjects/:id
 * @desc    Update subject
 * @access  Private (Admin, Superadmin)
 */
router.put(
  '/subjects/:id',
  authenticate,
  authorize('admin', 'superadmin'),
  validateUUID('id'),
  validateSubject,
  subjectController.updateSubject
);

/**
 * @route   DELETE /api/subjects/:id
 * @desc    Delete subject
 * @access  Private (Admin, Superadmin)
 */
router.delete(
  '/subjects/:id',
  authenticate,
  authorize('admin', 'superadmin'),
  validateUUID('id'),
  subjectController.deleteSubject
);

// ============================================
// ROLE & PERMISSION ROUTES
// ============================================

/**
 * @route   GET /api/roles
 * @desc    Get all roles with stats
 * @access  Private (Superadmin only)
 */
router.get(
  '/roles',
  authenticate,
  authorize('superadmin'),
  roleController.getAllRoles
);

/**
 * @route   GET /api/roles/:id
 * @desc    Get role by ID with permissions
 * @access  Private (Superadmin only)
 */
router.get(
  '/roles/:id',
  authenticate,
  authorize('superadmin'),
  validateUUID('id'),
  roleController.getRoleById
);

/**
 * @route   POST /api/roles
 * @desc    Create new role
 * @access  Private (Superadmin only)
 */
router.post(
  '/roles',
  authenticate,
  authorize('superadmin'),
  roleController.createRole
);

/**
 * @route   PUT /api/roles/:id
 * @desc    Update role
 * @access  Private (Superadmin only)
 */
router.put(
  '/roles/:id',
  authenticate,
  authorize('superadmin'),
  validateUUID('id'),
  roleController.updateRole
);

/**
 * @route   DELETE /api/roles/:id
 * @desc    Delete role
 * @access  Private (Superadmin only)
 */
router.delete(
  '/roles/:id',
  authenticate,
  authorize('superadmin'),
  validateUUID('id'),
  roleController.deleteRole
);

/**
 * @route   GET /api/permissions
 * @desc    Get all permissions
 * @access  Private (Superadmin only)
 */
router.get(
  '/permissions',
  authenticate,
  authorize('superadmin'),
  roleController.getAllPermissions
);

/**
 * @route   GET /api/roles/:id/permissions
 * @desc    Get permissions for a role
 * @access  Private (Superadmin only)
 */
router.get(
  '/roles/:id/permissions',
  authenticate,
  authorize('superadmin'),
  validateUUID('id'),
  roleController.getRolePermissions
);

/**
 * @route   PUT /api/roles/:id/permissions
 * @desc    Update role permissions
 * @access  Private (Superadmin only)
 */
router.put(
  '/roles/:id/permissions',
  authenticate,
  authorize('superadmin'),
  validateUUID('id'),
  roleController.updateRolePermissions
);

// ============================================
// MIGRATION ROUTES
// ============================================

/**
 * @route   POST /api/migrations/roles
 * @desc    Run roles system migration
 * @access  Private (Superadmin only)
 */
router.post(
  '/migrations/roles',
  authenticate,
  authorize('superadmin'),
  migrationController.runRolesMigration
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
