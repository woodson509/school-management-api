/**
 * User Controller
 * Handles user management operations
 */

const db = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * Create a new user
 * @access Private (admin, superadmin)
 */
exports.createUser = async (req, res) => {
    try {
        const { full_name, email, password, role, school } = req.body;
        const pool = await db.getPool();

        // Check if user exists
        const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const query = `
            INSERT INTO users (full_name, email, password, role, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            RETURNING id, full_name, email, role, created_at
        `;

        const result = await pool.query(query, [
            full_name,
            email,
            hashedPassword,
            role || 'student'
        ]);

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
      SELECT id, email, full_name, role, created_at, updated_at
      FROM users
      WHERE 1=1
    `;

        const params = [];
        let paramIndex = 1;

        if (role) {
            query += ` AND role = $${paramIndex}`;
            params.push(role);
            paramIndex++;
        }

        if (search) {
            query += ` AND (full_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get total count
        let countQuery = `SELECT COUNT(*) FROM users WHERE 1=1`;
        const countParams = [];
        let countIndex = 1;

        if (role) {
            countQuery += ` AND role = $${countIndex}`;
            countParams.push(role);
            countIndex++;
        }

        if (search) {
            countQuery += ` AND (full_name ILIKE $${countIndex} OR email ILIKE $${countIndex})`;
            countParams.push(`%${search}%`);
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
      SELECT id, email, full_name, role, created_at, updated_at
      FROM users
      WHERE id = $1
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
        const { full_name, email, role } = req.body;
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

        // Only admins can change roles
        if (role && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to change user role'
            });
        }

        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (full_name !== undefined) {
            updates.push(`full_name = $${paramIndex}`);
            params.push(full_name);
            paramIndex++;
        }

        if (email !== undefined) {
            updates.push(`email = $${paramIndex}`);
            params.push(email);
            paramIndex++;
        }

        if (role !== undefined && isAdmin) {
            updates.push(`role = $${paramIndex}`);
            params.push(role);
            paramIndex++;
        }

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
      RETURNING id, email, full_name, role, created_at, updated_at
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
