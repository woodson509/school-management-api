/**
 * Payment Controller
 * Handles fees, invoices (student_fees), and payment transactions
 */

const db = require('../config/database');

/**
 * Get all student fees (invoices) with details
 * @access Private (Admin/Accountant)
 */
exports.getStudentFees = async (req, res) => {
    try {
        const { status, search } = req.query;

        let query = `
            SELECT 
                sf.id,
                sf.student_id,
                u.full_name as student_name,
                c.name as class_name,
                sf.amount,
                sf.paid_amount,
                sf.status,
                sf.due_date,
                f.name as fee_type,
                sf.created_at
            FROM student_fees sf
            JOIN users u ON sf.student_id = u.id
            LEFT JOIN classes c ON u.class_id = c.id
            LEFT JOIN fees f ON sf.fee_id = f.id
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 1;

        if (status && status !== 'all') {
            query += ` AND sf.status = $${paramCount}`;
            params.push(status);
            paramCount++;
        }

        if (search) {
            query += ` AND (u.full_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
            params.push(`%${search}%`);
            paramCount++;
        }

        query += ' ORDER BY sf.created_at DESC';

        const result = await db.query(query, params);

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching student fees:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching student fees',
            error: error.message
        });
    }
};

/**
 * Create a new fee assignment (Invoice) for a student
 * @access Private (Admin)
 */
exports.createStudentFee = async (req, res) => {
    try {
        const { student_id, fee_id, amount, due_date } = req.body;

        // If fee_id is provided, get default amount if not specified
        let finalAmount = amount;
        if (fee_id && !amount) {
            const feeResult = await db.query('SELECT amount FROM fees WHERE id = $1', [fee_id]);
            if (feeResult.rows.length > 0) {
                finalAmount = feeResult.rows[0].amount;
            }
        }

        const query = `
            INSERT INTO student_fees (student_id, fee_id, amount, due_date, status)
            VALUES ($1, $2, $3, $4, 'pending')
            RETURNING *
        `;

        const result = await db.query(query, [
            student_id,
            fee_id || null,
            finalAmount,
            due_date || null
        ]);

        res.status(201).json({
            success: true,
            message: 'Fee assigned successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error assigning fee:', error);
        res.status(500).json({
            success: false,
            message: 'Error assigning fee',
            error: error.message
        });
    }
};

/**
 * Record a payment
 * @access Private (Admin)
 */
exports.recordPayment = async (req, res) => {
    try {
        const { student_fee_id, amount, payment_method, reference, notes } = req.body;
        const recorded_by = req.user.id;

        // Start transaction
        await db.query('BEGIN');

        // 1. Create payment record
        const paymentQuery = `
            INSERT INTO payments (student_fee_id, amount, payment_method, reference, notes, recorded_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;

        const paymentResult = await db.query(paymentQuery, [
            student_fee_id, amount, payment_method, reference, notes, recorded_by
        ]);

        // 2. Update student_fee paid_amount and status
        const updateFeeQuery = `
            UPDATE student_fees
            SET 
                paid_amount = paid_amount + $1,
                status = CASE 
                    WHEN paid_amount + $1 >= amount THEN 'paid'
                    ELSE 'partial'
                END,
                updated_at = NOW()
            WHERE id = $2
            RETURNING *
        `;

        const feeResult = await db.query(updateFeeQuery, [amount, student_fee_id]);

        await db.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Payment recorded successfully',
            data: {
                payment: paymentResult.rows[0],
                fee: feeResult.rows[0]
            }
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error recording payment:', error);
        res.status(500).json({
            success: false,
            message: 'Error recording payment',
            error: error.message
        });
    }
};

/**
 * Get payment statistics
 * @access Private (Admin)
 */
exports.getStats = async (req, res) => {
    try {
        const query = `
            SELECT 
                COALESCE(SUM(amount), 0) as total_expected,
                COALESCE(SUM(paid_amount), 0) as total_received,
                COUNT(CASE WHEN status = 'pending' OR status = 'partial' THEN 1 END) as pending_count,
                COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count
            FROM student_fees
        `;

        const result = await db.query(query);

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching payment stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching stats',
            error: error.message
        });
    }
};

/**
 * Get standard fees list
 * @access Private
 */
exports.getFees = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM fees ORDER BY name');
        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching fees:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching fees',
            error: error.message
        });
    }
};

/**
 * Create a new fee type
 * @access Private (Admin)
 */
exports.createFee = async (req, res) => {
    try {
        const { name, type, amount, description } = req.body;

        const query = `
            INSERT INTO fees (name, type, amount, description)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;

        const result = await db.query(query, [name, type, amount, description]);

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating fee:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating fee',
            error: error.message
        });
    }
};

/**
 * Update a fee type
 * @access Private (Admin)
 */
exports.updateFee = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, amount, description } = req.body;

        const query = `
            UPDATE fees 
            SET name = $1, type = $2, amount = $3, description = $4, updated_at = NOW()
            WHERE id = $5
            RETURNING *
        `;

        const result = await db.query(query, [name, type, amount, description, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Fee not found'
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating fee:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating fee',
            error: error.message
        });
    }
};

/**
 * Delete a fee type
 * @access Private (Admin)
 */
exports.deleteFee = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if fee is used
        const checkQuery = 'SELECT COUNT(*) FROM student_fees WHERE fee_id = $1';
        const checkResult = await db.query(checkQuery, [id]);

        if (parseInt(checkResult.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete fee type because it is assigned to students'
            });
        }

        await db.query('DELETE FROM fees WHERE id = $1', [id]);

        res.status(200).json({
            success: true,
            message: 'Fee deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting fee:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting fee',
            error: error.message
        });
    }
};

/**
 * Get all teacher payments
 * @access Private (Admin)
 */
exports.getTeacherPayments = async (req, res) => {
    try {
        const { teacher_id, month, year } = req.query;

        let query = `
            SELECT 
                tp.*,
                u.full_name as teacher_name,
                u.email as teacher_email
            FROM teacher_payments tp
            JOIN users u ON tp.teacher_id = u.id
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 1;

        if (teacher_id) {
            query += ` AND tp.teacher_id = $${paramCount}`;
            params.push(teacher_id);
            paramCount++;
        }

        if (month) {
            query += ` AND tp.period_month = $${paramCount}`;
            params.push(month);
            paramCount++;
        }

        if (year) {
            query += ` AND tp.period_year = $${paramCount}`;
            params.push(year);
            paramCount++;
        }

        query += ' ORDER BY tp.payment_date DESC';

        const result = await db.query(query, params);

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching teacher payments:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching teacher payments',
            error: error.message
        });
    }
};

/**
 * Record a teacher payment
 * @access Private (Admin)
 */
exports.createTeacherPayment = async (req, res) => {
    try {
        const { teacher_id, amount, payment_method, period_month, period_year, notes } = req.body;
        const recorded_by = req.user.id;

        const query = `
            INSERT INTO teacher_payments (
                teacher_id, amount, payment_method, period_month, period_year, notes, recorded_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;

        const result = await db.query(query, [
            teacher_id, amount, payment_method, period_month, period_year, notes, recorded_by
        ]);

        res.status(201).json({
            success: true,
            message: 'Teacher payment recorded successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error recording teacher payment:', error);
        res.status(500).json({
            success: false,
            message: 'Error recording teacher payment',
            error: error.message
        });
    }
};
