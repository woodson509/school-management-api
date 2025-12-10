/**
 * User Controller
 * Handles user management operations with extended pedagogical fields
 */

const db = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * Create a new user with extended fields
 * @access Private (admin, superadmin)
 */
exports.createUser = async (req, res) => {
    try {
        const pool = await db.getPool();

        // Extract all possible fields from request body
        const {
            full_name, email, password, role, school_id,
            // Common fields
            phone, address, date_of_birth, gender, profile_picture_url,
            // Student fields
            class_id, student_id_number, enrollment_date, enrollment_status,
            parent_name, parent_phone, parent_email,
            emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
            medical_notes, special_needs, transport_method, previous_school,
            scholarship_status, scholarship_percentage,
            // Teacher fields
            employee_id, hire_date, contract_type, employment_status,
            specialization, qualifications, years_of_experience, subjects_taught,
            department, office_location, max_teaching_hours, is_class_teacher,
            // Admin fields
            position, can_approve_expenses, can_manage_all_classes, max_expense_approval_amount
        } = req.body;

        // Check if user exists
        const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        // Determine school_id based on creator's role
        let targetSchoolId = school_id;
        if (req.user.role === 'admin') {
            targetSchoolId = req.user.school_id;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Build dynamic INSERT query
        const fields = ['full_name', 'email', 'password', 'role', 'school_id'];
        const values = [full_name, email, hashedPassword, role || 'student', targetSchoolId || null];
        const placeholders = ['$1', '$2', '$3', '$4', '$5'];
        let paramCounter = 6;

        // Helper function to add optional fields
        const addField = (fieldName, fieldValue) => {
            if (fieldValue !== undefined && fieldValue !== null) {
                fields.push(fieldName);
                values.push(fieldValue);
                placeholders.push(`$${paramCounter}`);
                paramCounter++;
            }
        };

        // Add common fields
        addField('phone', phone);
        addField('address', address);
        addField('date_of_birth', date_of_birth);
        addField('gender', gender);
        addField('profile_picture_url', profile_picture_url);

        // Add student-specific fields
        if (role === 'student') {
            addField('class_id', class_id);
            addField('student_id_number', student_id_number);
            addField('enrollment_date', enrollment_date || new Date().toISOString().split('T')[0]);
            addField('enrollment_status', enrollment_status || 'active');
            addField('parent_name', parent_name);
            addField('parent_phone', parent_phone);
            addField('parent_email', parent_email);
            addField('emergency_contact_name', emergency_contact_name);
            addField('emergency_contact_phone', emergency_contact_phone);
            addField('emergency_contact_relationship', emergency_contact_relationship);
            addField('medical_notes', medical_notes);
            addField('special_needs', special_needs);
            addField('transport_method', transport_method);
            addField('previous_school', previous_school);
            addField('scholarship_status', scholarship_status || 'none');
            addField('scholarship_percentage', scholarship_percentage);
        }

        // Add teacher-specific fields
        if (role === 'teacher') {
            addField('employee_id', employee_id);
            addField('hire_date', hire_date || new Date().toISOString().split('T')[0]);
            addField('contract_type', contract_type);
            addField('employment_status', employment_status || 'active');
            addField('specialization', specialization);
            addField('qualifications', qualifications ? JSON.stringify(qualifications) : null);
            addField('years_of_experience', years_of_experience);
            addField('subjects_taught', subjects_taught ? JSON.stringify(subjects_taught) : null);
            addField('department', department);
            addField('office_location', office_location);
            addField('max_teaching_hours', max_teaching_hours);
            addField('is_class_teacher', is_class_teacher || false);
        }

        // Add admin-specific fields
        if (role === 'admin') {
            addField('employee_id', employee_id);
            addField('hire_date', hire_date || new Date().toISOString().split('T')[0]);
            addField('position', position);
            addField('department', department);
            addField('can_approve_expenses', can_approve_expenses || false);
            addField('can_manage_all_classes', can_manage_all_classes || false);
            addField('max_expense_approval_amount', max_expense_approval_amount);
        }

        // Add created_at and updated_at at the end
        fields.push('created_at', 'updated_at');
        placeholders.push('NOW()', 'NOW()');

        const query = `
            INSERT INTO users (${fields.join(', ')})
            VALUES (${placeholders.join(', ')})
            RETURNING *
        `;

        const result = await pool.query(query, values);

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating user',
            error: error.message
        });
    }
};

/**
 * Get all users
 * @access Private (admin, superadmin)
 */
exports.getUsers = async (req, res) => {
    try {
        const pool = await db.getPool();
        const { page = 1, limit = 10, role, search } = req.query;
        const offset = (page - 1) * limit;

        let query = `
      SELECT u.*, s.name as school_name, c.name as class_name
      FROM users u
      LEFT JOIN schools s ON u.school_id = s.id
      LEFT JOIN classes c ON u.class_id = c.id
      WHERE 1=1
    `;

        const params = [];
        let paramIndex = 1;

        // Enforce school isolation for admins and teachers
        if (req.user.role === 'admin' || req.user.role === 'teacher') {
            query += ` AND u.school_id = $${paramIndex}`;
            params.push(req.user.school_id);
            paramIndex++;
        }

        if (role) {
            query += ` AND u.role = $${paramIndex}`;
            params.push(role);
            paramIndex++;
        }

        if (search) {
            query += ` AND (u.full_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.student_id_number ILIKE $${paramIndex} OR u.employee_id ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get total count
        let countQuery = `SELECT COUNT(*) FROM users u WHERE 1=1`;
        const countParams = [];
        let countIndex = 1;

        if (req.user.role === 'admin' || req.user.role === 'teacher') {
            countQuery += ` AND u.school_id = $${countIndex}`;
            countParams.push(req.user.school_id);
            countIndex++;
        }

        if (role) {
            countQuery += ` AND u.role = $${countIndex}`;
            countParams.push(role);
            countIndex++;
        }

        if (search) {
            countQuery += ` AND (u.full_name ILIKE $${countIndex} OR u.email ILIKE $${countIndex} OR u.student_id_number ILIKE $${countIndex} OR u.employee_id ILIKE $${countIndex})`;
            countParams.push(`%${search}%`);
            countIndex++;
        }

        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching users',
            error: error.message
        });
    }
};

/**
 * Get user by ID
 * @access Private
 */
exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await db.getPool();

        const query = `
      SELECT u.*, s.name as school_name, c.name as class_name
      FROM users u
      LEFT JOIN schools s ON u.school_id = s.id
      LEFT JOIN classes c ON u.class_id = c.id
      WHERE u.id = $1
    `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user',
            error: error.message
        });
    }
};

/**
 * Update user
 * @access Private (admin, superadmin, or own profile)
 */
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await db.getPool();

        // Check if user is updating their own profile or is admin
        const isOwnProfile = req.user.id === id;
        const isAdmin = ['admin', 'superadmin'].includes(req.user.role);

        if (!isOwnProfile && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this user'
            });
        }

        const updates = [];
        const params = [];
        let paramIndex = 1;

        // Helper function to add update fields
        const addUpdate = (fieldName, fieldValue) => {
            if (fieldValue !== undefined) {
                updates.push(`${fieldName} = $${paramIndex}`);
                params.push(fieldValue);
                paramIndex++;
            }
        };

        // Basic fields
        addUpdate('full_name', req.body.full_name);
        addUpdate('email', req.body.email);

        // Only admins can change roles
        if (isAdmin) {
            addUpdate('role', req.body.role);
            addUpdate('school_id', req.body.school_id);
            addUpdate('is_active', req.body.is_active);
        }

        // Common fields
        addUpdate('phone', req.body.phone);
        addUpdate('address', req.body.address);
        addUpdate('date_of_birth', req.body.date_of_birth);
        addUpdate('gender', req.body.gender);
        addUpdate('profile_picture_url', req.body.profile_picture_url);
        addUpdate('access_revoked_at', req.body.access_revoked_at);
        addUpdate('access_revoked_reason', req.body.access_revoked_reason);

        // Student fields
        addUpdate('class_id', req.body.class_id);
        addUpdate('student_id_number', req.body.student_id_number);
        addUpdate('enrollment_date', req.body.enrollment_date);
        addUpdate('enrollment_status', req.body.enrollment_status);
        addUpdate('parent_name', req.body.parent_name);
        addUpdate('parent_phone', req.body.parent_phone);
        addUpdate('parent_email', req.body.parent_email);
        addUpdate('emergency_contact_name', req.body.emergency_contact_name);
        addUpdate('emergency_contact_phone', req.body.emergency_contact_phone);
        addUpdate('emergency_contact_relationship', req.body.emergency_contact_relationship);
        addUpdate('medical_notes', req.body.medical_notes);
        addUpdate('special_needs', req.body.special_needs);
        addUpdate('transport_method', req.body.transport_method);
        addUpdate('previous_school', req.body.previous_school);
        addUpdate('scholarship_status', req.body.scholarship_status);
        addUpdate('scholarship_percentage', req.body.scholarship_percentage);

        // Teacher fields
        addUpdate('employee_id', req.body.employee_id);
        addUpdate('hire_date', req.body.hire_date);
        addUpdate('contract_type', req.body.contract_type);
        addUpdate('employment_status', req.body.employment_status);
        addUpdate('specialization', req.body.specialization);
        if (req.body.qualifications) addUpdate('qualifications', JSON.stringify(req.body.qualifications));
        addUpdate('years_of_experience', req.body.years_of_experience);
        if (req.body.subjects_taught) addUpdate('subjects_taught', JSON.stringify(req.body.subjects_taught));
        addUpdate('department', req.body.department);
        addUpdate('office_location', req.body.office_location);
        addUpdate('max_teaching_hours', req.body.max_teaching_hours);
        addUpdate('is_class_teacher', req.body.is_class_teacher);

        // Admin fields
        addUpdate('position', req.body.position);
        addUpdate('can_approve_expenses', req.body.can_approve_expenses);
        addUpdate('can_manage_all_classes', req.body.can_manage_all_classes);
        addUpdate('max_expense_approval_amount', req.body.max_expense_approval_amount);

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        updates.push(`updated_at = NOW()`);
        params.push(id);

        const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating user',
            error: error.message
        });
    }
};

/**
 * Delete user
 * @access Private (admin, superadmin only)
 */
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await db.getPool();

        // Prevent deleting yourself
        if (req.user.id === id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }

        const query = `
      DELETE FROM users 
      WHERE id = $1 
      RETURNING id, email, full_name
    `;

        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting user',
            error: error.message
        });
    }
};

/**
 * Change user password
 * @access Private (own password or admin)
 */
exports.changePassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { currentPassword, newPassword } = req.body;
        const pool = await db.getPool();

        const isOwnProfile = req.user.id === id;
        const isAdmin = ['admin', 'superadmin'].includes(req.user.role);

        if (!isOwnProfile && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized'
            });
        }

        // If changing own password, verify current password
        if (isOwnProfile && currentPassword) {
            const userQuery = `SELECT password FROM users WHERE id = $1`;
            const userResult = await pool.query(userQuery, [id]);

            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const isMatch = await bcrypt.compare(currentPassword, userResult.rows[0].password);
            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    message: 'Current password is incorrect'
                });
            }
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const query = `
      UPDATE users
      SET password = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email
    `;

        const result = await pool.query(query, [hashedPassword, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            message: 'Error changing password',
            error: error.message
        });
    }
};
