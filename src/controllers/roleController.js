/**
 * Role Controller
 * Handles role and permission management
 */

const db = require('../config/database');

/**
 * Get all roles with permission count and user count
 * GET /api/roles
 */
exports.getAllRoles = async (req, res) => {
    try {
        const pool = await db.getPool();

        const query = `
      SELECT 
        r.*,
        COUNT(DISTINCT rp.permission_id) as permission_count,
        COUNT(DISTINCT u.id) as user_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN users u ON u.role = r.code
      GROUP BY r.id
      ORDER BY 
        CASE r.code
          WHEN 'superadmin' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'teacher' THEN 3
          WHEN 'student' THEN 4
          WHEN 'agent' THEN 5
          ELSE 6
        END,
        r.created_at DESC
    `;

        const result = await pool.query(query);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get all roles error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching roles',
            error: error.message
        });
    }
};

/**
 * Get role by ID with permissions
 * GET /api/roles/:id
 */
exports.getRoleById = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await db.getPool();

        // Get role details
        const roleResult = await pool.query(
            'SELECT * FROM roles WHERE id = $1',
            [id]
        );

        if (roleResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        // Get role permissions
        const permissionsResult = await pool.query(`
      SELECT p.*
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1
      ORDER BY p.module, p.action
    `, [id]);

        res.json({
            success: true,
            data: {
                ...roleResult.rows[0],
                permissions: permissionsResult.rows
            }
        });
    } catch (error) {
        console.error('Get role by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching role',
            error: error.message
        });
    }
};

/**
 * Create new role
 * POST /api/roles
 */
exports.createRole = async (req, res) => {
    try {
        const { name, code, description, color } = req.body;
        const pool = await db.getPool();

        // Check if code already exists
        const existing = await pool.query(
            'SELECT id FROM roles WHERE code = $1',
            [code]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Role code already exists'
            });
        }

        const query = `
      INSERT INTO roles (name, code, description, color, is_system)
      VALUES ($1, $2, $3, $4, false)
      RETURNING *
    `;

        const result = await pool.query(query, [
            name,
            code.toLowerCase(),
            description || null,
            color || '#6366F1'
        ]);

        res.status(201).json({
            success: true,
            message: 'Role created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Create role error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating role',
            error: error.message
        });
    }
};

/**
 * Update role
 * PUT /api/roles/:id
 */
exports.updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, color } = req.body;
        const pool = await db.getPool();

        // Check if role is a system role
        const roleCheck = await pool.query(
            'SELECT is_system FROM roles WHERE id = $1',
            [id]
        );

        if (roleCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        // Build update query dynamically
        const updates = [];
        const params = [];
        let paramIndex = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramIndex}`);
            params.push(name);
            paramIndex++;
        }

        if (description !== undefined) {
            updates.push(`description = $${paramIndex}`);
            params.push(description);
            paramIndex++;
        }

        if (color !== undefined) {
            updates.push(`color = $${paramIndex}`);
            params.push(color);
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
      UPDATE roles
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

        const result = await pool.query(query, params);

        res.json({
            success: true,
            message: 'Role updated successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating role',
            error: error.message
        });
    }
};

/**
 * Delete role
 * DELETE /api/roles/:id
 */
exports.deleteRole = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await db.getPool();

        // Check if role is a system role
        const roleCheck = await pool.query(
            'SELECT is_system, code FROM roles WHERE id = $1',
            [id]
        );

        if (roleCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        if (roleCheck.rows[0].is_system) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete system roles'
            });
        }

        // Check if any users have this role
        const usersCheck = await pool.query(
            'SELECT COUNT(*) FROM users WHERE role = $1',
            [roleCheck.rows[0].code]
        );

        if (parseInt(usersCheck.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete role. ${usersCheck.rows[0].count} user(s) still have this role.`
            });
        }

        await pool.query('DELETE FROM roles WHERE id = $1', [id]);

        res.json({
            success: true,
            message: 'Role deleted successfully'
        });
    } catch (error) {
        console.error('Delete role error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting role',
            error: error.message
        });
    }
};

/**
 * Get all permissions
 * GET /api/permissions
 */
exports.getAllPermissions = async (req, res) => {
    try {
        const pool = await db.getPool();

        const result = await pool.query(`
      SELECT * FROM permissions
      ORDER BY module, action
    `);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get all permissions error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching permissions',
            error: error.message
        });
    }
};

/**
 * Get permissions for a specific role
 * GET /api/roles/:id/permissions
 */
exports.getRolePermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await db.getPool();

        const result = await pool.query(`
      SELECT p.*
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1
      ORDER BY p.module, p.action
    `, [id]);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get role permissions error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching role permissions',
            error: error.message
        });
    }
};

/**
 * Update role permissions
 * PUT /api/roles/:id/permissions
 */
exports.updateRolePermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { permission_ids } = req.body; // Array of permission IDs
        const pool = await db.getPool();

        // Check if role exists
        const roleCheck = await pool.query(
            'SELECT id, is_system, code FROM roles WHERE id = $1',
            [id]
        );

        if (roleCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }

        // Don't allow modifying superadmin permissions
        if (roleCheck.rows[0].code === 'superadmin') {
            return res.status(400).json({
                success: false,
                message: 'Cannot modify superadmin permissions'
            });
        }

        // Start transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Delete existing permissions
            await client.query(
                'DELETE FROM role_permissions WHERE role_id = $1',
                [id]
            );

            // Insert new permissions
            if (permission_ids && permission_ids.length > 0) {
                const values = permission_ids.map((permId, index) =>
                    `($1, $${index + 2})`
                ).join(', ');

                await client.query(
                    `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`,
                    [id, ...permission_ids]
                );
            }

            await client.query('COMMIT');

            // Get updated permissions
            const updatedPermissions = await client.query(`
        SELECT p.*
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = $1
      `, [id]);

            res.json({
                success: true,
                message: 'Role permissions updated successfully',
                data: updatedPermissions.rows
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Update role permissions error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating role permissions',
            error: error.message
        });
    }
};

module.exports = exports;
