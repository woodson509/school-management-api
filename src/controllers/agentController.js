/**
 * Agent Controller
 * Handles agent sales recording and tracking
 */

const db = require('../config/database');

/**
 * Record a new sale
 * POST /api/agents/sales
 * Access: Agent only
 */
const recordSale = async (req, res) => {
  const client = await db.getClient();
  
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
      const agentResult = await db.query(
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

    const result = await db.query(query, params);

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

    const result = await db.query(
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

    const result = await db.query(
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
    const agentResult = await db.query(
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
    const statsResult = await db.query(
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
    const recentSalesResult = await db.query(
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

module.exports = {
  recordSale,
  getSales,
  getSaleById,
  updateSaleStatus,
  getAgentDashboard
};
