/**
 * Agent Controller
 * Complete CRUD operations for managing sales agents
 */

const pool = require('../config/database');
const bcrypt = require('bcryptjs');

// ============================================
// SALES MANAGEMENT METHODS
// ============================================

/**
 * Record a new sale
 * POST /api/agents/sales
 * Access: Agent only
 */
const recordSale = async (req, res) => {
  const client = await pool.getClient();

  try {
    const {
      school_id,
      amount,
      subscription_type,
      subscription_months,
      notes
    } = req.body;

    // Begin transaction
    await client.query('BEGIN');

    // Get agent record
    const agentCheck = await client.query(
      'SELECT * FROM agents WHERE user_id = $1',
      [req.user.id]
    );

    if (agentCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Agent record not found'
      });
    }

    const agent = agentCheck.rows[0];

    // Check if agent is active
    if (!agent.is_active) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Agent account is inactive'
      });
    }

    // Verify school exists
    const schoolCheck = await client.query(
      'SELECT id FROM schools WHERE id = $1',
      [school_id]
    );

    if (schoolCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }

    // Calculate commission
    const commission = (amount * agent.commission_rate) / 100;

    // Insert sale record
    const saleResult = await client.query(
      `INSERT INTO sales (
        agent_id, school_id, amount, commission,
        subscription_type, subscription_months, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        agent.id,
        school_id,
        amount,
        commission,
        subscription_type,
        subscription_months,
        notes || null
      ]
    );

    const sale = saleResult.rows[0];

    // Update agent's total sales
    await client.query(
      'UPDATE agents SET total_sales = total_sales + $1 WHERE id = $2',
      [amount, agent.id]
    );

    // Commit transaction
    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Sale recorded successfully',
      data: {
        sale_id: sale.id,
        amount: sale.amount,
        commission: sale.commission,
        subscription_type: sale.subscription_type,
        subscription_months: sale.subscription_months,
        sale_date: sale.sale_date,
        payment_status: sale.payment_status
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Record sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record sale',
      error: error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Get all sales (for agents: own sales, for admins: all sales)
 * GET /api/agents/sales
 */
const getSales = async (req, res) => {
  try {
    const { agent_id, school_id, payment_status } = req.query;

    let query = `
      SELECT s.*, a.agent_code, u.full_name as agent_name,
             sch.name as school_name
      FROM sales s
      JOIN agents a ON s.agent_id = a.id
      JOIN users u ON a.user_id = u.id
      JOIN schools sch ON s.school_id = sch.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // If user is an agent, only show their own sales
    if (req.user.role === 'agent') {
      const agentResult = await pool.query(
        'SELECT id FROM agents WHERE user_id = $1',
        [req.user.id]
      );

      if (agentResult.rows.length > 0) {
        query += ` AND s.agent_id = $${paramCount}`;
        params.push(agentResult.rows[0].id);
        paramCount++;
      }
    }

    // Apply additional filters (for admins)
    if (agent_id && req.user.role === 'admin') {
      query += ` AND s.agent_id = $${paramCount}`;
      params.push(agent_id);
      paramCount++;
    }

    if (school_id) {
      query += ` AND s.school_id = $${paramCount}`;
      params.push(school_id);
      paramCount++;
    }

    if (payment_status) {
      query += ` AND s.payment_status = $${paramCount}`;
      params.push(payment_status);
      paramCount++;
    }

    query += ' ORDER BY s.sale_date DESC';

    const result = await pool.query(query, params);

    res.status(200).json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales',
      error: error.message
    });
  }
};

/**
 * Get sale by ID
 * GET /api/agents/sales/:id
 */
const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT s.*, a.agent_code, a.user_id, u.full_name as agent_name,
              sch.name as school_name, sch.email as school_email
       FROM sales s
       JOIN agents a ON s.agent_id = a.id
       JOIN users u ON a.user_id = u.id
       JOIN schools sch ON s.school_id = sch.id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    const sale = result.rows[0];

    // Authorization check - agents can only view their own sales
    if (req.user.role === 'agent' && sale.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: sale
    });

  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sale',
      error: error.message
    });
  }
};

/**
 * Update sale payment status
 * PUT /api/agents/sales/:id
 * Access: Admin only
 */
const updateSaleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status } = req.body;

    if (!['pending', 'completed', 'failed'].includes(payment_status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status'
      });
    }

    const result = await pool.query(
      `UPDATE sales
       SET payment_status = $1
       WHERE id = $2
       RETURNING *`,
      [payment_status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Sale status updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update sale status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update sale status',
      error: error.message
    });
  }
};

/**
 * Get agent dashboard stats
 * GET /api/agents/dashboard
 * Access: Agent only
 */
const getAgentDashboard = async (req, res) => {
  try {
    // Get agent record
    const agentResult = await pool.query(
      `SELECT a.*, u.full_name, u.email
       FROM agents a
       JOIN users u ON a.user_id = u.id
       WHERE a.user_id = $1`,
      [req.user.id]
    );

    if (agentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent record not found'
      });
    }

    const agent = agentResult.rows[0];

    // Get sales statistics
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as total_sales_count,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END), 0) as completed_sales,
        COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN amount ELSE 0 END), 0) as pending_sales,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN commission ELSE 0 END), 0) as total_commission_earned
       FROM sales
       WHERE agent_id = $1`,
      [agent.id]
    );

    const stats = statsResult.rows[0];

    // Get recent sales
    const recentSalesResult = await pool.query(
      `SELECT s.*, sch.name as school_name
       FROM sales s
       JOIN schools sch ON s.school_id = sch.id
       WHERE s.agent_id = $1
       ORDER BY s.sale_date DESC
       LIMIT 10`,
      [agent.id]
    );

    res.status(200).json({
      success: true,
      data: {
        agent: {
          id: agent.id,
          full_name: agent.full_name,
          email: agent.email,
          agent_code: agent.agent_code,
          commission_rate: agent.commission_rate,
          total_sales: agent.total_sales,
          is_active: agent.is_active
        },
        statistics: {
          total_sales_count: parseInt(stats.total_sales_count),
          completed_sales: parseFloat(stats.completed_sales),
          pending_sales: parseFloat(stats.pending_sales),
          total_commission_earned: parseFloat(stats.total_commission_earned)
        },
        recent_sales: recentSalesResult.rows
      }
    });

  } catch (error) {
    console.error('Get agent dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
};

// ============================================
// AGENT CRUD METHODS
// ============================================

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
        a.phone,
        a.total_sales,
        a.is_active,
        a.created_at,
        u.id as user_id,
        u.full_name,
        u.email,
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
  const client = await pool.getClient();

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
      `INSERT INTO users (full_name, email, password, role)
       VALUES ($1, $2, $3, 'agent')
       RETURNING id, full_name, email, role, created_at`,
      [full_name, email, hashedPassword]
    );

    const user = userResult.rows[0];

    // Generate unique agent code (AG + user_id padded)
    const agentCode = `AG${String(user.id).padStart(6, '0')}`;

    // Create agent record
    const agentResult = await client.query(
      `INSERT INTO agents (user_id, agent_code, commission_rate, total_sales, is_active, phone)
       VALUES ($1, $2, $3, 0, true, $4)
       RETURNING *`,
      [user.id, agentCode, commission_rate || 10.0, phone || null]
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
  const client = await pool.getClient();

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
        RETURNING id, full_name, email, role
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

    if (phone !== undefined) {
      agentUpdates.push(`phone = $${agentParamCount}`);
      agentParams.push(phone);
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
  // Sales Management
  recordSale,
  getSales,
  getSaleById,
  updateSaleStatus,
  getAgentDashboard,
  // Agent CRUD
  getAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  getAgentStats
};
