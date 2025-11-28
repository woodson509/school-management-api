/**
 * Validation Utilities
 * Centralized validation rules using express-validator
 */

const { body, param, validationResult } = require('express-validator');

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg
      }))
    });
  }

  next();
};

/**
 * Validation rules for user registration
 */
const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('full_name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 255 })
    .withMessage('Full name must be between 2 and 255 characters'),
  body('role')
    .isIn(['admin', 'teacher', 'student', 'agent', 'superadmin'])
    .withMessage('Role must be one of: admin, teacher, student, agent, superadmin'),
  body('school_id')
    .optional()
    .isUUID()
    .withMessage('School ID must be a valid UUID'),
  handleValidationErrors
];

/**
 * Validation rules for user login
 */
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

/**
 * Validation rules for course creation
 */
const validateCourse = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Course title is required')
    .isLength({ max: 255 })
    .withMessage('Title must not exceed 255 characters'),
  body('description')
    .optional()
    .trim(),
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Course code is required')
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('Course code must contain only uppercase letters, numbers, and hyphens'),
  body('credits')
    .optional()
    .isInt({ min: 0, max: 20 })
    .withMessage('Credits must be between 0 and 20'),
  body('school_id')
    .isUUID()
    .withMessage('Valid school ID is required'),
  body('teacher_id')
    .optional()
    .isUUID()
    .withMessage('Teacher ID must be a valid UUID'),
  handleValidationErrors
];

/**
 * Validation rules for exam creation
 */
const validateExam = [
  body('course_id')
    .isUUID()
    .withMessage('Valid course ID is required'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Exam title is required')
    .isLength({ max: 255 })
    .withMessage('Title must not exceed 255 characters'),
  body('description')
    .optional()
    .trim(),
  body('duration_minutes')
    .isInt({ min: 1, max: 600 })
    .withMessage('Duration must be between 1 and 600 minutes'),
  body('total_marks')
    .isInt({ min: 1 })
    .withMessage('Total marks must be at least 1'),
  body('passing_marks')
    .isInt({ min: 0 })
    .withMessage('Passing marks must be at least 0')
    .custom((value, { req }) => {
      if (value > req.body.total_marks) {
        throw new Error('Passing marks cannot exceed total marks');
      }
      return true;
    }),
  body('exam_date')
    .optional()
    .isISO8601()
    .withMessage('Exam date must be a valid date'),
  handleValidationErrors
];

/**
 * Validation rules for exam submission
 */
const validateExamSubmission = [
  body('answers')
    .notEmpty()
    .withMessage('Answers are required')
    .isObject()
    .withMessage('Answers must be a valid JSON object'),
  handleValidationErrors
];

/**
 * Validation rules for sales record
 */
const validateSale = [
  body('school_id')
    .isUUID()
    .withMessage('Valid school ID is required'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  body('subscription_type')
    .trim()
    .notEmpty()
    .withMessage('Subscription type is required'),
  body('subscription_months')
    .isInt({ min: 1, max: 60 })
    .withMessage('Subscription months must be between 1 and 60'),
  body('notes')
    .optional()
    .trim(),
  handleValidationErrors
];

/**
 * Validation for UUID parameters
 */
const validateUUID = (paramName = 'id') => [
  param(paramName)
    .isUUID()
    .withMessage(`${paramName} must be a valid UUID`),
  handleValidationErrors
];

/**
 * Validation rules for school creation/update
 */
const validateSchool = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('School name is required')
    .isLength({ max: 255 })
    .withMessage('Name must not exceed 255 characters'),
  body('address')
    .trim()
    .notEmpty()
    .withMessage('Address is required'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9\s\-\+\(\)]+$/)
    .withMessage('Invalid phone number format'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('website')
    .optional()
    .trim()
    .isURL()
    .withMessage('Valid URL is required'),
  body('principal_name')
    .optional()
    .trim(),
  handleValidationErrors
];

/**
 * Validation rules for class creation/update
 */
const validateClass = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Class name is required')
    .isLength({ max: 255 })
    .withMessage('Name must not exceed 255 characters'),
  body('grade_level')
    .trim()
    .notEmpty()
    .withMessage('Grade level is required'),
  body('school_year')
    .trim()
    .notEmpty()
    .withMessage('School year is required')
    .matches(/^\d{4}-\d{4}$/)
    .withMessage('School year must be in format YYYY-YYYY (e.g., 2023-2024)'),
  body('teacher_id')
    .optional()
    .isUUID()
    .withMessage('Teacher ID must be a valid UUID'),
  handleValidationErrors
];

/**
 * Validation rules for subject creation/update
 */
const validateSubject = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Subject name is required')
    .isLength({ max: 255 })
    .withMessage('Name must not exceed 255 characters'),
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Subject code is required')
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('Code must contain only uppercase letters, numbers, and hyphens'),
  body('description')
    .optional()
    .trim(),
  body('credits')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Credits must be between 1 and 10'),
  handleValidationErrors
];

/**
 * Validation rules for user update
 */
const validateUserUpdate = [
  body('full_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('Full name must be between 2 and 255 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('role')
    .optional()
    .isIn(['admin', 'teacher', 'student', 'agent', 'superadmin'])
    .withMessage('Role must be one of: admin, teacher, student, agent, superadmin'),
  handleValidationErrors
];

/**
 * Validation rules for extended user fields
 */
const validateUserExtended = [
  // Common fields
  body('phone').optional().trim().matches(/^[0-9\s\-\+\(\)]+$/).withMessage('Invalid phone number'),
  body('date_of_birth').optional().isDate().withMessage('Invalid date'),
  body('gender').optional().isIn(['M', 'F', 'Other']).withMessage('Invalid gender'),

  // Student fields
  body('class_id').optional().isUUID().withMessage('Invalid class ID'),
  body('enrollment_status').optional().isIn(['active', 'suspended', 'graduated', 'withdrawn', 'transferred']).withMessage('Invalid status'),
  body('parent_email').optional().isEmail().normalizeEmail().withMessage('Invalid parent email'),
  body('scholarship_status').optional().isIn(['none', 'partial', 'full']).withMessage('Invalid scholarship status'),
  body('scholarship_percentage').optional().isInt({ min: 0, max: 100 }).withMessage('Must be 0-100'),

  // Teacher fields
  body('contract_type').optional().isIn(['permanent', 'temporary', 'part_time']).withMessage('Invalid contract type'),
  body('employment_status').optional().isIn(['active', 'on_leave', 'terminated']).withMessage('Invalid employment status'),
  body('years_of_experience').optional().isInt({ min: 0 }).withMessage('Must be positive'),
  body('max_teaching_hours').optional().isInt({ min: 1, max: 60 }).withMessage('Must be 1-60'),
  body('is_class_teacher').optional().isBoolean().withMessage('Must be boolean'),

  // Admin fields
  body('position').optional().isIn(['director', 'vice_director', 'coordinator', 'secretary', 'other']).withMessage('Invalid position'),
  body('can_approve_expenses').optional().isBoolean().withMessage('Must be boolean'),
  body('can_manage_all_classes').optional().isBoolean().withMessage('Must be boolean'),
  body('max_expense_approval_amount').optional().isFloat({ min: 0 }).withMessage('Must be positive'),

  handleValidationErrors
];

/**
 * Validation rules for password change
 */
const validatePasswordChange = [
  body('currentPassword')
    .optional()
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  handleValidationErrors
];

module.exports = {
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
  validateUserExtended,
  validatePasswordChange,
  handleValidationErrors
};

