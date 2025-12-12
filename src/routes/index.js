/**
 * API Routes Configuration
 * Defines all API endpoints and their middleware
 */

const express = require('express');
const router = express.Router();

// Import middleware
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { logActivity } = require('../middleware/loggingMiddleware');

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
const logController = require('../controllers/logController');
const backupController = require('../controllers/backupController');
const assignmentController = require('../controllers/assignmentController');
const attendanceController = require('../controllers/attendanceController');
const paymentController = require('../controllers/paymentController');
const settingsController = require('../controllers/settingsController');
const gradesController = require('../controllers/gradesController');
const competencyController = require('../controllers/competencyController');
const reportCardController = require('../controllers/reportCardController');
const badgeController = require('../controllers/badgeController');
const analyticsController = require('../controllers/analyticsController');
const announcementController = require('../controllers/announcementController');
const eventController = require('../controllers/eventController');

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

// Apply global logging middleware
router.use(logActivity);

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
// ASSIGNMENT ROUTES
// ============================================

/**
 * @route   GET /api/assignments
 * @desc    Get all assignments (filtered by user role)
 * @access  Private
 */
router.get(
  '/assignments',
  authenticate,
  assignmentController.getAll
);

/**
 * @route   POST /api/assignments
 * @desc    Create a new assignment
 * @access  Private (Teacher, Admin)
 */
router.post(
  '/assignments',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  assignmentController.create
);

/**
 * @route   GET /api/courses/:courseId/assignments
 * @desc    Get assignments by course
 * @access  Private
 */
router.get(
  '/courses/:courseId/assignments',
  authenticate,
  validateUUID('courseId'),
  assignmentController.getByCourse
);

/**
 * @route   GET /api/assignments/:id
 * @desc    Get assignment by ID
 * @access  Private
 */
router.get(
  '/assignments/:id',
  authenticate,
  validateUUID('id'),
  assignmentController.getById
);

/**
 * @route   POST /api/assignments
 * @desc    Create assignment
 * @access  Private (Admin, Teacher)
 */
router.post(
  '/assignments',
  authenticate,
  authorize('admin', 'teacher'),
  assignmentController.create
);

/**
 * @route   PUT /api/assignments/:id
 * @desc    Update assignment
 * @access  Private (Admin, Teacher)
 */
router.put(
  '/assignments/:id',
  authenticate,
  authorize('admin', 'teacher'),
  validateUUID('id'),
  assignmentController.update
);

/**
 * @route   DELETE /api/assignments/:id
 * @desc    Delete assignment
 * @access  Private (Admin, Teacher)
 */
router.delete(
  '/assignments/:id',
  authenticate,
  authorize('admin', 'teacher'),
  validateUUID('id'),
  assignmentController.delete
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
  authorize('admin', 'superadmin', 'teacher'),
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
 * @route   GET /api/announcements
 * @desc    Get all announcements
 * @access  Private
 */
router.get(
  '/announcements',
  authenticate,
  announcementController.getAnnouncements
);

/**
 * @route   POST /api/announcements
 * @desc    Create a new announcement
 * @access  Private (Admin, Superadmin)
 */
router.post(
  '/announcements',
  authenticate,
  authorize('admin', 'superadmin'),
  announcementController.createAnnouncement
);

/**
 * @route   PUT /api/announcements/:id
 * @desc    Update an announcement
 * @access  Private (Admin, Superadmin)
 */
router.put(
  '/announcements/:id',
  authenticate,
  authorize('admin', 'superadmin'),
  validateUUID('id'),
  announcementController.updateAnnouncement
);

/**
 * @route   DELETE /api/announcements/:id
 * @desc    Delete an announcement
 * @access  Private (Admin, Superadmin)
 */
router.delete(
  '/announcements/:id',
  authenticate,
  authorize('admin', 'superadmin'),
  validateUUID('id'),
  announcementController.deleteAnnouncement
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
// BACKUP ROUTES
// ============================================

/**
 * @route   POST /api/backups
 * @desc    Create manual database backup
 * @access  Private (Superadmin only)
 */
router.post(
  '/backups',
  authenticate,
  authorize('superadmin'),
  backupController.createBackup
);

/**
 * @route   GET /api/backups
 * @desc    Get all backups
 * @access  Private (Superadmin only)
 */
router.get(
  '/backups',
  authenticate,
  authorize('superadmin'),
  backupController.getAllBackups
);

/**
 * @route   GET /api/backups/stats
 * @desc    Get backup storage statistics
 * @access  Private (Superadmin only)
 */
router.get(
  '/backups/stats',
  authenticate,
  authorize('superadmin'),
  backupController.getBackupStats
);

/**
 * @route   GET /api/backups/:filename/download
 * @desc    Download backup file
 * @access  Private (Superadmin only)
 */
router.get(
  '/backups/:filename/download',
  authenticate,
  authorize('superadmin'),
  backupController.downloadBackup
);

/**
 * @route   DELETE /api/backups/:filename
 * @desc    Delete backup file
 * @access  Private (Superadmin only)
 */
router.delete(
  '/backups/:filename',
  authenticate,
  authorize('superadmin'),
  backupController.deleteBackup
);

// ============================================
// ACTIVITY LOGS ROUTES
// ============================================

/**
 * @route   GET /api/logs
 * @desc    Get all activity logs
 * @access  Private (Superadmin only)
 */
router.get(
  '/logs',
  authenticate,
  authorize('superadmin'),
  logController.getAllLogs
);

/**
 * @route   GET /api/logs/stats
 * @desc    Get activity log statistics
 * @access  Private (Superadmin only)
 */
router.get(
  '/logs/stats',
  authenticate,
  authorize('superadmin'),
  logController.getLogStats
);

/**
 * @route   GET /api/logs/export
 * @desc    Export activity logs as CSV
 * @access  Private (Superadmin only)
 */
router.get(
  '/logs/export',
  authenticate,
  authorize('superadmin'),
  logController.exportLogs
);

/**
 * @route   GET /api/logs/:id
 * @desc    Get single activity log
 * @access  Private (Superadmin only)
 */
router.get(
  '/logs/:id',
  authenticate,
  authorize('superadmin'),
  logController.getLogById
);

// ============================================
// MIGRATION ROUTES
// ============================================

// Grade routes
const gradeController = require('../controllers/gradeController');


router.get('/grades', authenticate, authorize('admin', 'teacher'), gradeController.getAllGrades);
router.get('/exams/:id/attempts', authenticate, authorize('admin', 'teacher'), examController.getExamAttempts);
router.put('/exams/:id', authenticate, authorize('admin', 'teacher'), examController.updateExam);
router.delete('/exams/:id', authenticate, authorize('admin', 'teacher'), examController.deleteExam);
router.put('/grades/:id', authenticate, authorize('admin', 'teacher'), gradeController.updateGrade);

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

/**
 * @route   POST /api/migrations/activity-logs
 * @desc    Run activity logs migration
 * @access  Private (Superadmin only)
 */
router.post(
  '/migrations/activity-logs',
  authenticate,
  authorize('superadmin'),
  migrationController.runActivityLogsMigration
);

/**
 * @route   POST /api/migrations/schools-schema
 * @desc    Run schools schema migration
 * @access  Private (Superadmin only)
 */
router.post(
  '/migrations/schools-schema',
  authenticate,
  authorize('superadmin'),
  migrationController.runSchoolsSchemaMigration
);

// ============================================
// E-LEARNING ROUTES
// ============================================

const lessonController = require('../controllers/lessonController');
const enrollmentController = require('../controllers/enrollmentController');

// Lesson routes
router.get('/courses/:courseId/lessons', authenticate, lessonController.getLessonsByCourse);
router.get('/lessons/:id', authenticate, lessonController.getLessonById);
router.post('/lessons', authenticate, authorize('admin', 'teacher'), lessonController.createLesson);
router.put('/lessons/:id', authenticate, authorize('admin', 'teacher'), lessonController.updateLesson);
router.delete('/lessons/:id', authenticate, authorize('admin', 'teacher'), lessonController.deleteLesson);

// Enrollment routes
router.post('/enrollments', authenticate, authorize('admin', 'teacher'), enrollmentController.enrollStudent);
router.get('/courses/:courseId/enrollments', authenticate, enrollmentController.getEnrollmentsByCourse);
router.get('/students/:studentId/enrollments', authenticate, enrollmentController.getEnrollmentsByStudent);
router.put('/enrollments/:id', authenticate, authorize('admin', 'teacher'), enrollmentController.updateEnrollment);
router.delete('/enrollments/:id', authenticate, authorize('admin', 'teacher'), enrollmentController.unenrollStudent);

// Announcement routes
router.get('/announcements', authenticate, announcementController.getAnnouncements);
router.post('/announcements', authenticate, authorize('admin', 'teacher'), announcementController.createAnnouncement);
router.put('/announcements/:id', authenticate, authorize('admin', 'teacher'), announcementController.updateAnnouncement);
router.delete('/announcements/:id', authenticate, authorize('admin', 'teacher'), announcementController.deleteAnnouncement);

// Attendance routes
router.get('/attendance', authenticate, authorize('admin', 'teacher'), attendanceController.getAttendance);
router.post('/attendance', authenticate, authorize('admin', 'teacher'), attendanceController.saveAttendance);

// Curriculum routes
const curriculumController = require('../controllers/curriculumController');
router.get('/curricula', authenticate, curriculumController.getCurricula);
router.post('/curricula', authenticate, authorize('admin', 'superadmin'), curriculumController.createCurriculum);
router.put('/curricula/:id', authenticate, authorize('admin', 'superadmin'), curriculumController.updateCurriculum);
router.delete('/curricula/:id', authenticate, authorize('admin', 'superadmin'), curriculumController.deleteCurriculum);

// Schedule routes
const scheduleController = require('../controllers/scheduleController');
router.get('/schedules', authenticate, scheduleController.getSchedules);
router.post('/schedules', authenticate, authorize('admin', 'teacher'), scheduleController.createSchedule);
router.put('/schedules/:id', authenticate, authorize('admin', 'teacher'), scheduleController.updateSchedule);
router.delete('/schedules/:id', authenticate, authorize('admin', 'teacher'), scheduleController.deleteSchedule);


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

// ============================================
// PAYMENT ROUTES
// ============================================

/**
 * @route   GET /api/student-fees
 * @desc    Get all student fees (invoices)
 * @access  Private (Admin, Superadmin)
 */
router.get(
  '/student-fees',
  authenticate,
  authorize('admin', 'superadmin'),
  paymentController.getStudentFees
);

/**
 * @route   POST /api/student-fees
 * @desc    Assign fee to student
 * @access  Private (Admin, Superadmin)
 */
router.post(
  '/student-fees',
  authenticate,
  authorize('admin', 'superadmin'),
  paymentController.createStudentFee
);

/**
 * @route   POST /api/payments
 * @desc    Record a payment
 * @access  Private (Admin, Superadmin)
 */
router.post(
  '/payments',
  authenticate,
  authorize('admin', 'superadmin'),
  paymentController.recordPayment
);

/**
 * @route   GET /api/payments/stats
 * @desc    Get payment statistics
 * @access  Private (Admin, Superadmin)
 */
router.get(
  '/payments/stats',
  authenticate,
  authorize('admin', 'superadmin'),
  paymentController.getStats
);

/**
 * @route   GET /api/fees
 * @desc    Get standard fees list
 * @access  Private (Admin, Superadmin)
 */
router.get(
  '/fees',
  authenticate,
  authorize('admin', 'superadmin'),
  paymentController.getFees
);

/**
 * @route   POST /api/fees
 * @desc    Create a new fee type
 * @access  Private (Admin, Superadmin)
 */
router.post(
  '/fees',
  authenticate,
  authorize('admin', 'superadmin'),
  paymentController.createFee
);

/**
 * @route   PUT /api/fees/:id
 * @desc    Update a fee type
 * @access  Private (Admin, Superadmin)
 */
router.put(
  '/fees/:id',
  authenticate,
  authorize('admin', 'superadmin'),
  validateUUID('id'),
  paymentController.updateFee
);

/**
 * @route   DELETE /api/fees/:id
 * @desc    Delete a fee type
 * @access  Private (Admin, Superadmin)
 */
router.delete(
  '/fees/:id',
  authenticate,
  authorize('admin', 'superadmin'),
  validateUUID('id'),
  paymentController.deleteFee
);

/**
 * @route   GET /api/teacher-payments
 * @desc    Get teacher payments
 * @access  Private (Admin, Superadmin)
 */
router.get(
  '/teacher-payments',
  authenticate,
  authorize('admin', 'superadmin'),
  paymentController.getTeacherPayments
);

/**
 * @route   POST /api/teacher-payments
 * @desc    Record teacher payment
 * @access  Private (Admin, Superadmin)
 */
router.post(
  '/teacher-payments',
  authenticate,
  authorize('admin', 'superadmin'),
  paymentController.createTeacherPayment
);

// ============================================================================
// GRADING SYSTEM ROUTES
// ============================================================================

/**
 * @route   GET /api/settings
 * @desc    Get all school settings
 * @access  Private (Admin, Superadmin)
 */
router.get(
  '/settings',
  authenticate,
  authorize('admin', 'superadmin'),
  settingsController.getSettings
);

/**
 * @route   PUT /api/settings
 * @desc    Update a school setting
 * @access  Private (Admin, Superadmin)
 */
router.put(
  '/settings',
  authenticate,
  authorize('admin', 'superadmin'),
  settingsController.updateSetting
);

/**
 * @route   GET /api/grading-scales
 * @desc    Get all grading scales
 * @access  Private
 */
router.get(
  '/grading-scales',
  authenticate,
  settingsController.getGradingScales
);

/**
 * @route   POST /api/grading-scales
 * @desc    Create a new grading scale
 * @access  Private (Admin, Superadmin)
 */
router.post(
  '/grading-scales',
  authenticate,
  authorize('admin', 'superadmin'),
  settingsController.createGradingScale
);

/**
 * @route   GET /api/report-periods
 * @desc    Get all report periods
 * @access  Private
 */
router.get(
  '/report-periods',
  authenticate,
  settingsController.getReportPeriods
);

/**
 * @route   POST /api/report-periods
 * @desc    Create a new report period
 * @access  Private (Admin, Superadmin)
 */
router.post(
  '/report-periods',
  authenticate,
  authorize('admin', 'superadmin'),
  settingsController.createReportPeriod
);

/**
 * @route   PUT /api/report-periods/:id
 * @desc    Update a report period
 * @access  Private (Admin, Superadmin)
 */
router.put(
  '/report-periods/:id',
  authenticate,
  authorize('admin', 'superadmin'),
  validateUUID('id'),
  settingsController.updateReportPeriod
);

/**
 * @route   DELETE /api/report-periods/:id
 * @desc    Delete a report period
 * @access  Private (Admin, Superadmin)
 */
router.delete(
  '/report-periods/:id',
  authenticate,
  authorize('admin', 'superadmin'),
  validateUUID('id'),
  settingsController.deleteReportPeriod
);

/**
 * @route   GET /api/subject-coefficients
 * @desc    Get subject coefficients
 * @access  Private
 */
router.get(
  '/subject-coefficients',
  authenticate,
  settingsController.getSubjectCoefficients
);

/**
 * @route   POST /api/subject-coefficients
 * @desc    Set subject coefficient
 * @access  Private (Admin, Superadmin)
 */
router.post(
  '/subject-coefficients',
  authenticate,
  authorize('admin', 'superadmin'),
  settingsController.setSubjectCoefficient
);

/**
 * @route   GET /api/grades
 * @desc    Get grades with filtering
 * @access  Private
 */
router.get(
  '/grades',
  authenticate,
  gradesController.getGrades
);

/**
 * @route   POST /api/grades
 * @desc    Create a new grade
 * @access  Private (Teacher, Admin)
 */
router.post(
  '/grades',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  gradesController.createGrade
);

/**
 * @route   PUT /api/grades/:id
 * @desc    Update a grade
 * @access  Private (Teacher, Admin)
 */
router.put(
  '/grades/:id',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  validateUUID('id'),
  gradesController.updateGrade
);

/**
 * @route   DELETE /api/grades/:id
 * @desc    Delete a grade
 * @access  Private (Teacher, Admin)
 */
router.delete(
  '/grades/:id',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  validateUUID('id'),
  gradesController.deleteGrade
);

/**
 * @route   GET /api/grades/average
 * @desc    Calculate average for a student/subject/period
 * @access  Private
 */
router.get(
  '/grades/average',
  authenticate,
  gradesController.calculateAverage
);

/**
 * @route   GET /api/grades/overall-average
 * @desc    Calculate overall average for a student/period
 * @access  Private
 */
router.get(
  '/grades/overall-average',
  authenticate,
  gradesController.calculateOverallAverage
);

/**
 * @route   GET /api/competencies
 * @desc    Get all competencies
 * @access  Private
 */
router.get(
  '/competencies',
  authenticate,
  competencyController.getCompetencies
);

/**
 * @route   POST /api/competencies
 * @desc    Create a new competency
 * @access  Private (Admin, Teacher)
 */
router.post(
  '/competencies',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  competencyController.createCompetency
);

/**
 * @route   PUT /api/competencies/:id
 * @desc    Update a competency
 * @access  Private (Admin, Teacher)
 */
router.put(
  '/competencies/:id',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  validateUUID('id'),
  competencyController.updateCompetency
);

/**
 * @route   DELETE /api/competencies/:id
 * @desc    Delete a competency
 * @access  Private (Admin)
 */
router.delete(
  '/competencies/:id',
  authenticate,
  authorize('admin', 'superadmin'),
  validateUUID('id'),
  competencyController.deleteCompetency
);

/**
 * @route   GET /api/competency-evaluations
 * @desc    Get competency evaluations
 * @access  Private
 */
router.get(
  '/competency-evaluations',
  authenticate,
  competencyController.getEvaluations
);

/**
 * @route   POST /api/competency-evaluations
 * @desc    Evaluate a competency
 * @access  Private (Teacher, Admin)
 */
router.post(
  '/competency-evaluations',
  authenticate,
  authorize('teacher', 'admin', 'superadmin'),
  competencyController.evaluateCompetency
);

/**
 * @route   GET /api/competency-evaluations/summary
 * @desc    Get competency summary for a student
 * @access  Private
 */
router.get(
  '/competency-evaluations/summary',
  authenticate,
  competencyController.getStudentCompetencySummary
);

/**
 * Report Card Routes
 */

/**
 * @route   POST /api/report-cards/generate
 * @desc    Generate report cards for a class
 * @access  Private (Admin)
 */
router.post(
  '/report-cards/generate',
  authenticate,
  authorize('admin', 'superadmin'),
  reportCardController.generateClassReportCards
);

/**
 * @route   GET /api/report-cards
 * @desc    Get report cards for a class
 * @access  Private (Admin, Teacher)
 */
router.get(
  '/report-cards',
  authenticate,
  authorize('admin', 'superadmin', 'teacher'),
  reportCardController.getClassReportCards
);

/**
 * @route   GET /api/report-cards/:id
 * @desc    Get report card details
 * @access  Private
 */
router.get(
  '/report-cards/:id',
  authenticate,
  validateUUID('id'),
  reportCardController.getReportCardDetails
);

/**
 * Advanced Features Routes
 */

// Badges
router.get('/badges', authenticate, badgeController.getAllBadges);
router.post('/badges', authenticate, authorize('admin', 'superadmin'), badgeController.createBadge);
router.post('/badges/award', authenticate, authorize('admin', 'superadmin', 'teacher'), badgeController.awardBadge);
router.get('/students/:student_id/badges', authenticate, badgeController.getStudentBadges);

// Analytics
router.get('/analytics/stats', authenticate, authorize('admin', 'superadmin'), analyticsController.getSchoolStats);
router.get('/analytics/predictions/:student_id', authenticate, authorize('admin', 'superadmin', 'teacher'), analyticsController.getStudentPredictions);
router.get('/analytics/scholarships', authenticate, authorize('admin', 'superadmin'), analyticsController.getScholarshipCandidates);

// Calendar Events
router.get('/events', authenticate, eventController.getEvents);
router.get('/events/:id', authenticate, eventController.getEventById);
router.post('/events', authenticate, authorize('admin', 'superadmin'), eventController.createEvent);
router.put('/events/:id', authenticate, authorize('admin', 'superadmin'), eventController.updateEvent);
router.delete('/events/:id', authenticate, authorize('admin', 'superadmin'), eventController.deleteEvent);

// Migrations
router.post('/migrations/announcements', authenticate, authorize('superadmin'), migrationController.runAnnouncementsMigration);
router.post('/migrations/seed-demo', authenticate, authorize('superadmin'), migrationController.seedDemoData);
router.post('/migrations/add-school-to-classes', authenticate, authorize('superadmin'), migrationController.addSchoolToClasses);
router.post('/migrations/add-school-to-pedagogy', authenticate, authorize('superadmin'), migrationController.addSchoolToPedagogy);
router.post('/migrations/add-school-to-subjects', authenticate, authorize('superadmin'), migrationController.addSchoolToSubjects);
router.post('/migrations/user-fields', migrationController.runUserFieldsMigration);

/**
 * @route   POST /api/migrations/lesson-online-fields
 * @desc    Add online fields to lessons
 * @access  Public (for development/setup)
 */
router.post('/migrations/lesson-online-fields', migrationController.runLessonOnlineMsg);

/**
 * @route   POST /api/migrations/missing-tables
 * @desc    Create assignments and enrollments tables
 * @access  Public (for fix)
 */
router.post('/migrations/missing-tables', migrationController.runMissingTablesMigration);

/**
 * @route   POST /api/migrations/link-courses-subjects
 * @desc    Add subject_id to courses
 * @access  Public (for update)
 */
router.post('/migrations/link-courses-subjects', migrationController.runLinkCoursesToSubjects);

/**
 * @route   POST /api/migrations/fix-assignments
 * @desc    Add missing columns to assignments table
 * @access  Public (for fix)
 */
router.post('/migrations/fix-assignments', migrationController.runFixAssignmentsSchema);

module.exports = router;

