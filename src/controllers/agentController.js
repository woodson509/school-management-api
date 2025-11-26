/**
 * Agent Controller
 * Complete CRUD operations for managing sales agents
 */

const pool = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * Get all agents with their sales statistics
 * GET /api/agents
 * Access: Admin only
 */
const getAgents = async (req, res) => {
  try {
    const { is_active, search } = req.query;

    let query = `
      SELECT 
        a.id,
        a.agent_code,
        a.commission_rate,
        a.total_sales,
        a.is_active,
        a.created_at,
        u.id as user_id,
        u.full_name,
        u.email,
        u.phone,
        COUNT(DISTINCT s.id) as total_sales_count,
        COALESCE(SUM(CASE WHEN s.payment_status = 'completed' THEN s.amount ELSE 0 END), 0) as completed_sales_amount,
        COALESCE(SUM(CASE WHEN s.payment_status = 'pending' THEN s.amount ELSE 0 END), 0) as pending_sales_amount,
        COALESCE(SUM(CASE WHEN s.payment_status = 'completed' THEN s.commission ELSE 0 END), 0) as total_commission_earned
      FROM agents a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN sales s ON a.id = s.agent_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    // Filter by active status
    if (is_active !== undefined) {
      query += ` AND a.is_active = $${paramCount}`;
      params.push(is_active === 'true');
      paramCount++;
    }

    // Search by name, email, or agent code
    if (search) {
      query += ` AND (
        u.full_name ILIKE $${paramCount} OR 
        u.email ILIKE $${paramCount} OR 
        a.agent_code ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += `
      GROUP BY a.id, u.id
      ORDER BY a.created_at DESC
    `;

    const result = await pool.query(query, params);

    res.status(200).json({
      success: true,
      message: 'Agents retrieved successfully',
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve agents',
      error: error.message
    });
  }
};

/**
 * Get agent by ID with detailed statistics and recent sales
 * GET /api/agents/:id
 * Access: Admin or the agent themselves
 */
const getAgentById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get agent details
    const agentQuery = `
      SELECT 
        a.id,
        a.agent_code,
        a.commission_rate,
        a.total_sales,
        a.is_active,
        a.created_at,
        a.updated_at,
        u.id as user_id,
        u.full_name,
        u.email,
        u.phone,
        u.role
      FROM agents a
      JOIN users u ON a.user_id = u.id
      WHERE a.id = $1
    `;

    const agentResult = await pool.query(agentQuery, [id]);

    if (agentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    const agent = agentResult.rows[0];

    // Authorization check - agents can only view their own details
    if (req.user.role === 'agent' && agent.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get sales statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_sales_count,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END), 0) as completed_sales,
        COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN amount ELSE 0 END), 0) as pending_sales,
        COALESCE(SUM(CASE WHEN payment_status = 'failed' THEN amount ELSE 0 END), 0) as failed_sales,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN commission ELSE 0 END), 0) as total_commission_earned,
        COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN commission ELSE 0 END), 0) as pending_commission
      FROM sales
      WHERE agent_id = $1
    `;

    const statsResult = await pool.query(statsQuery, [id]);
    const statistics = statsResult.rows[0];

    // Get recent sales (last 10)
    const recentSalesQuery = `
      SELECT 
        s.id,
        s.amount,
        s.commission,
        s.subscription_type,
        s.subscription_months,
        s.payment_status,
        s.sale_date,
        s.notes,
        sch.id as school_id,
        sch.name as school_name,
        sch.email as school_email
      FROM sales s
      JOIN schools sch ON s.school_id = sch.id
      WHERE s.agent_id = $1
      ORDER BY s.sale_date DESC
      LIMIT 10
    `;

    const recentSalesResult = await pool.query(recentSalesQuery, [id]);

    res.status(200).json({
      success: true,
      message: 'Agent details retrieved successfully',
      data: {
        agent: {
          id: agent.id,
          agent_code: agent.agent_code,
          commission_rate: parseFloat(agent.commission_rate),
          total_sales: parseFloat(agent.total_sales),
          is_active: agent.is_active,
          created_at: agent.created_at,
          updated_at: agent.updated_at,
          user: {
            id: agent.user_id,
            full_name: agent.full_name,
            email: agent.email,
            phone: agent.phone,
            role: agent.role
          }
        },
        statistics: {
          total_sales_count: parseInt(statistics.total_sales_count),
          completed_sales: parseFloat(statistics.completed_sales),
          pending_sales: parseFloat(statistics.pending_sales),
          failed_sales: parseFloat(statistics.failed_sales),
          total_commission_earned: parseFloat(statistics.total_commission_earned),
          pending_commission: parseFloat(statistics.pending_commission)
        },
        recent_sales: recentSalesResult.rows
      }
    });

  } catch (error) {
    console.error('Get agent by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve agent details',
      error: error.message
    });
  }
};

/**
 * Create a new agent (creates user + agent record)
 * POST /api/agents
 * Access: Admin only
 */
const createAgent = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      full_name,
      email,
      password,
      phone,
      commission_rate
    } = req.body;

    // Validation
    if (!full_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, and password are required'
      });
    }

    if (commission_rate && (commission_rate < 0 || commission_rate > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Commission rate must be between 0 and 100'
      });
    }

    // Begin transaction
    await client.query('BEGIN');

    // Check if email already exists
    const emailCheck = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (emailCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user record
    const userResult = await client.query(
      `INSERT INTO users (full_name, email, password, phone, role)
       VALUES ($1, $2, $3, $4, 'agent')
       RETURNING id, full_name, email, phone, role, created_at`,
      [full_name, email, hashedPassword, phone || null]
    );

    const user = userResult.rows[0];

    // Generate unique agent code (AG + user_id padded)
    const agentCode = `AG${String(user.id).padStart(6, '0')}`;

    // Create agent record
    const agentResult = await client.query(
      `INSERT INTO agents (user_id, agent_code, commission_rate, total_sales, is_active)
       VALUES ($1, $2, $3, 0, true)
       RETURNING *`,
      [user.id, agentCode, commission_rate || 10.0]
    );

    const agent = agentResult.rows[0];

    // Commit transaction
    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Agent created successfully',
      data: {
        id: agent.id,
        agent_code: agent.agent_code,
        commission_rate: parseFloat(agent.commission_rate),
        total_sales: parseFloat(agent.total_sales),
        is_active: agent.is_active,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          created_at: user.created_at
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create agent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create agent',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Update an existing agent
 * PUT /api/agents/:id
 * Access: Admin only
 */
const updateAgent = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const {
      full_name,
      email,
      phone,
      password,
      commission_rate,
      is_active
    } = req.body;

    // Validation
    if (commission_rate !== undefined && (commission_rate < 0 || commission_rate > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Commission rate must be between 0 and 100'
      });
    }

    // Begin transaction
    await client.query('BEGIN');

    // Check if agent exists and get user_id
    const agentCheck = await client.query(
      'SELECT user_id FROM agents WHERE id = $1',
      [id]
    );

    if (agentCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    const userId = agentCheck.rows[0].user_id;

    // If email is being updated, check for duplicates
    if (email) {
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );

      if (emailCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Build dynamic update query for user
    const userUpdates = [];
    const userParams = [];
    let userParamCount = 1;

    if (full_name) {
      userUpdates.push(`full_name = $${userParamCount}`);
      userParams.push(full_name);
      userParamCount++;
    }

    if (email) {
      userUpdates.push(`email = $${userParamCount}`);
      userParams.push(email);
      userParamCount++;
    }

    if (phone !== undefined) {
      userUpdates.push(`phone = $${userParamCount}`);
      userParams.push(phone);
      userParamCount++;
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      userUpdates.push(`password = $${userParamCount}`);
      userParams.push(hashedPassword);
      userParamCount++;
    }

    // Update user if there are changes
    if (userUpdates.length > 0) {
      userParams.push(userId);
      const userQuery = `
        UPDATE users 
        SET ${userUpdates.join(', ')}
        WHERE id = $${userParamCount}
        RETURNING id, full_name, email, phone, role
      `;
      await client.query(userQuery, userParams);
    }

    // Build dynamic update query for agent
    const agentUpdates = [];
    const agentParams = [];
    let agentParamCount = 1;

    if (commission_rate !== undefined) {
      agentUpdates.push(`commission_rate = $${agentParamCount}`);
      agentParams.push(commission_rate);
      agentParamCount++;
    }

    if (is_active !== undefined) {
      agentUpdates.push(`is_active = $${agentParamCount}`);
      agentParams.push(is_active);
      agentParamCount++;
    }

    // Always update the updated_at timestamp
    agentUpdates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Update agent
    agentParams.push(id);
    const agentQuery = `
      UPDATE agents 
      SET ${agentUpdates.join(', ')}
      WHERE id = $${agentParamCount}
      RETURNING *
    `;
    const agentResult = await client.query(agentQuery, agentParams);

    // Get updated user info
    const userResult = await client.query(
      'SELECT id, full_name, email, phone, role FROM users WHERE id = $1',
      [userId]
    );

    // Commit transaction
    await client.query('COMMIT');

    const agent = agentResult.rows[0];
    const user = userResult.rows[0];

    res.status(200).json({
      success: true,
      message: 'Agent updated successfully',
      data: {
        id: agent.id,
        agent_code: agent.agent_code,
        commission_rate: parseFloat(agent.commission_rate),
        total_sales: parseFloat(agent.total_sales),
        is_active: agent.is_active,
        updated_at: agent.updated_at,
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          role: user.role
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update agent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update agent',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Delete an agent (soft delete - sets is_active to false)
 * DELETE /api/agents/:id
 * Access: Admin only
 */
const deleteAgent = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if agent exists
    const checkResult = await pool.query(
      'SELECT id, is_active FROM agents WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Soft delete - set is_active to false
    const result = await pool.query(
      `UPDATE agents 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, agent_code, is_active`,
      [id]
    );

    res.status(200).json({
      success: true,
      message: 'Agent deactivated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate agent',
      error: error.message
    });
  }
};

/**
 * Get detailed statistics for a specific agent
 * GET /api/agents/:id/stats
 * Access: Admin or the agent themselves
 */
const getAgentStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { period } = req.query; // 'week', 'month', 'year', or 'all'

    // Check if agent exists
    const agentCheck = await pool.query(
      'SELECT id, user_id, agent_code FROM agents WHERE id = $1',
      [id]
    );

    if (agentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    const agent = agentCheck.rows[0];

    // Authorization check
    if (req.user.role === 'agent' && agent.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Build date filter based on period
    let dateFilter = '';
    if (period === 'week') {
      dateFilter = "AND s.sale_date >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "AND s.sale_date >= CURRENT_DATE - INTERVAL '30 days'";
    } else if (period === 'year') {
      dateFilter = "AND s.sale_date >= CURRENT_DATE - INTERVAL '1 year'";
    }

    // Overall statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_sales_count,
        COALESCE(SUM(amount), 0) as total_sales_amount,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END), 0) as completed_sales,
        COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN amount ELSE 0 END), 0) as pending_sales,
        COALESCE(SUM(CASE WHEN payment_status = 'failed' THEN amount ELSE 0 END), 0) as failed_sales,
        COALESCE(SUM(commission), 0) as total_commission,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN commission ELSE 0 END), 0) as earned_commission,
        COALESCE(AVG(amount), 0) as average_sale_amount,
        COUNT(DISTINCT school_id) as unique_schools
      FROM sales s
      WHERE agent_id = $1 ${dateFilter}
    `;

    const statsResult = await pool.query(statsQuery, [id]);
    const stats = statsResult.rows[0];

    // Sales by subscription type
    const typeBreakdownQuery = `
      SELECT 
        subscription_type,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(commission), 0) as total_commission
      FROM sales
      WHERE agent_id = $1 ${dateFilter}
      GROUP BY subscription_type
      ORDER BY total_amount DESC
    `;

    const typeBreakdownResult = await pool.query(typeBreakdownQuery, [id]);

    // Monthly sales trend (last 12 months)
    const trendQuery = `
      SELECT 
        TO_CHAR(sale_date, 'YYYY-MM') as month,
        COUNT(*) as sales_count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(commission), 0) as total_commission
      FROM sales
      WHERE agent_id = $1
        AND sale_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY TO_CHAR(sale_date, 'YYYY-MM')
      ORDER BY month DESC
    `;

    const trendResult = await pool.query(trendQuery, [id]);

    // Top schools by sales
    const topSchoolsQuery = `
      SELECT 
        sch.id,
        sch.name,
        COUNT(s.id) as sales_count,
        COALESCE(SUM(s.amount), 0) as total_sales_amount
      FROM sales s
      JOIN schools sch ON s.school_id = sch.id
      WHERE s.agent_id = $1 ${dateFilter}
      GROUP BY sch.id, sch.name
      ORDER BY total_sales_amount DESC
      LIMIT 10
    `;

    const topSchoolsResult = await pool.query(topSchoolsQuery, [id]);

    res.status(200).json({
      success: true,
      message: 'Agent statistics retrieved successfully',
      data: {
        agent_code: agent.agent_code,
        period: period || 'all',
        overall_statistics: {
          total_sales_count: parseInt(stats.total_sales_count),
          total_sales_amount: parseFloat(stats.total_sales_amount),
          completed_sales: parseFloat(stats.completed_sales),
          pending_sales: parseFloat(stats.pending_sales),
          failed_sales: parseFloat(stats.failed_sales),
          total_commission: parseFloat(stats.total_commission),
          earned_commission: parseFloat(stats.earned_commission),
          average_sale_amount: parseFloat(stats.average_sale_amount),
          unique_schools: parseInt(stats.unique_schools)
        },
        sales_by_type: typeBreakdownResult.rows,
        monthly_trend: trendResult.rows,
        top_schools: topSchoolsResult.rows
      }
    });

  } catch (error) {
    console.error('Get agent stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve agent statistics',
      error: error.message
    });
  }
};

module.exports = {
  getAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  getAgentStats
};
