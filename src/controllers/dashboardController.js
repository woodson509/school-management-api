/**
 * Dashboard Controller
 * Provides role-specific dashboard statistics from PostgreSQL
 */

const pool = require('../config/database');

/**
 * Get SuperAdmin Dashboard
 * GET /api/dashboard/superadmin
 * Access: SuperAdmin only
 */
const getSuperAdminDashboard = async (req, res) => {
    try {
        // Total schools by status
        const schoolsStatsQuery = `
      SELECT 
        COUNT(*) as total_schools,
        COUNT(CASE WHEN subscription_status = 'active' THEN 1 END) as active_schools,
        COUNT(CASE WHEN subscription_status = 'trial' THEN 1 END) as trial_schools,
        COUNT(CASE WHEN subscription_status = 'inactive' THEN 1 END) as inactive_schools
      FROM schools
    `;
        const schoolsStatsResult = await pool.query(schoolsStatsQuery);
        const schoolsStats = schoolsStatsResult.rows[0];

        // Total users by role
        const usersStatsQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'superadmin' THEN 1 END) as superadmins,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
        COUNT(CASE WHEN role = 'teacher' THEN 1 END) as teachers,
        COUNT(CASE WHEN role = 'student' THEN 1 END) as students,
        COUNT(CASE WHEN role = 'agent' THEN 1 END) as agents
      FROM users
    `;
        const usersStatsResult = await pool.query(usersStatsQuery);
        const usersStats = usersStatsResult.rows[0];

        // Sales statistics (last 30 days)
        const salesStatsQuery = `
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END), 0) as completed_revenue,
        COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN amount ELSE 0 END), 0) as pending_revenue,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN commission ELSE 0 END), 0) as total_commissions
      FROM sales
      WHERE sale_date >= CURRENT_DATE - INTERVAL '30 days'
    `;
        const salesStatsResult = await pool.query(salesStatsQuery);
        const salesStats = salesStatsResult.rows[0];

        // Revenue trend (last 12 months)
        const revenueTrendQuery = `
      SELECT 
        TO_CHAR(sale_date, 'YYYY-MM') as month,
        COUNT(*) as sales_count,
        COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END), 0) as revenue
      FROM sales
      WHERE sale_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY TO_CHAR(sale_date, 'YYYY-MM')
      ORDER BY month DESC
    `;
        const revenueTrendResult = await pool.query(revenueTrendQuery);

        // Active agents count
        const activeAgentsQuery = `
      SELECT COUNT(*) as active_agents
      FROM agents
      WHERE is_active = true
    `;
        const activeAgentsResult = await pool.query(activeAgentsQuery);
        const activeAgents = activeAgentsResult.rows[0].active_agents;

        // Recent sales (last 10)
        const recentSalesQuery = `
      SELECT 
        s.id,
        s.amount,
        s.commission,
        s.payment_status,
        s.subscription_type,
        s.sale_date,
        a.agent_code,
        u.full_name as agent_name,
        sch.name as school_name
      FROM sales s
      JOIN agents ag ON s.agent_id = ag.id
      JOIN users u ON ag.user_id = u.id
      LEFT JOIN schools sch ON s.school_id = sch.id
      JOIN agents a ON s.agent_id = a.id
      ORDER BY s.sale_date DESC
      LIMIT 10
    `;
        const recentSalesResult = await pool.query(recentSalesQuery);

        res.status(200).json({
            success: true,
            data: {
                schools: {
                    total: parseInt(schoolsStats.total_schools),
                    active: parseInt(schoolsStats.active_schools),
                    trial: parseInt(schoolsStats.trial_schools),
                    inactive: parseInt(schoolsStats.inactive_schools)
                },
                users: {
                    total: parseInt(usersStats.total_users),
                    superadmins: parseInt(usersStats.superadmins),
                    admins: parseInt(usersStats.admins),
                    teachers: parseInt(usersStats.teachers),
                    students: parseInt(usersStats.students),
                    agents: parseInt(usersStats.agents)
                },
                sales_last_30_days: {
                    total_sales: parseInt(salesStats.total_sales),
                    completed_revenue: parseFloat(salesStats.completed_revenue),
                    pending_revenue: parseFloat(salesStats.pending_revenue),
                    total_commissions: parseFloat(salesStats.total_commissions)
                },
                revenue_trend: revenueTrendResult.rows,
                active_agents: parseInt(activeAgents),
                recent_sales: recentSalesResult.rows
            }
        });

    } catch (error) {
        console.error('SuperAdmin dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch superadmin dashboard',
            error: error.message
        });
    }
};

/**
 * Get Admin Dashboard (School Admin)
 * GET /api/dashboard/admin
 * Access: Admin only
 */
const getAdminDashboard = async (req, res) => {
    try {
        const schoolId = req.user.school_id;

        if (!schoolId) {
            return res.status(400).json({
                success: false,
                message: 'School ID not found for this admin'
            });
        }

        // School information
        const schoolInfoQuery = `
      SELECT 
        id,
        name,
        email,
        phone,
        address,
        subscription_status,
        subscription_end_date,
        max_students,
        max_teachers,
        created_at
      FROM schools
      WHERE id = $1
    `;
        const schoolInfoResult = await pool.query(schoolInfoQuery, [schoolId]);
        const schoolInfo = schoolInfoResult.rows[0];

        if (!schoolInfo) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        // Users count by role in this school
        const usersCountQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
        COUNT(CASE WHEN role = 'teacher' THEN 1 END) as teachers,
        COUNT(CASE WHEN role = 'student' THEN 1 END) as students
      FROM users
      WHERE school_id = $1
    `;
        const usersCountResult = await pool.query(usersCountQuery, [schoolId]);
        const usersCount = usersCountResult.rows[0];

        // Courses statistics
        const coursesStatsQuery = `
      SELECT 
        COUNT(*) as total_courses,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_courses,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_courses,
        COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived_courses
      FROM courses
      WHERE school_id = $1
    `;
        const coursesStatsResult = await pool.query(coursesStatsQuery, [schoolId]);
        const coursesStats = coursesStatsResult.rows[0];

        // Exams statistics (last 30 days)
        const examsStatsQuery = `
      SELECT 
        COUNT(DISTINCT e.id) as total_exams,
        COUNT(DISTINCT ea.id) as total_attempts,
        COALESCE(AVG(ea.score), 0) as average_score
      FROM exams e
      LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
      WHERE e.school_id = $1
        AND e.created_at >= CURRENT_DATE - INTERVAL '30 days'
    `;
        const examsStatsResult = await pool.query(examsStatsQuery, [schoolId]);
        const examsStats = examsStatsResult.rows[0];

        // Recent announcements (last 5)
        let recentAnnouncements = [];
        try {
            const announcementsQuery = `
        SELECT 
          id,
          title,
          content,
          created_by,
          created_at
        FROM announcements
        WHERE school_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `;
            const announcementsResult = await pool.query(announcementsQuery, [schoolId]);
            recentAnnouncements = announcementsResult.rows;
        } catch (err) {
            // Table might not exist, continue without it
            console.log('Announcements table not available');
        }

        // Attendance rate (if table exists)
        let attendanceRate = null;
        try {
            const attendanceQuery = `
        SELECT 
          COUNT(*) as total_records,
          COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count
        FROM attendance
        WHERE school_id = $1
          AND date >= CURRENT_DATE - INTERVAL '30 days'
      `;
            const attendanceResult = await pool.query(attendanceQuery, [schoolId]);
            const attendance = attendanceResult.rows[0];
            if (parseInt(attendance.total_records) > 0) {
                attendanceRate = (parseInt(attendance.present_count) / parseInt(attendance.total_records) * 100).toFixed(2);
            }
        } catch (err) {
            // Table might not exist, continue without it
            console.log('Attendance table not available');
        }

        res.status(200).json({
            success: true,
            data: {
                school: {
                    id: schoolInfo.id,
                    name: schoolInfo.name,
                    email: schoolInfo.email,
                    phone: schoolInfo.phone,
                    address: schoolInfo.address,
                    subscription_status: schoolInfo.subscription_status,
                    subscription_end_date: schoolInfo.subscription_end_date,
                    max_students: schoolInfo.max_students,
                    max_teachers: schoolInfo.max_teachers,
                    created_at: schoolInfo.created_at
                },
                users: {
                    total: parseInt(usersCount.total_users),
                    admins: parseInt(usersCount.admins),
                    teachers: parseInt(usersCount.teachers),
                    students: parseInt(usersCount.students)
                },
                courses: {
                    total: parseInt(coursesStats.total_courses),
                    active: parseInt(coursesStats.active_courses),
                    draft: parseInt(coursesStats.draft_courses),
                    archived: parseInt(coursesStats.archived_courses)
                },
                exams_last_30_days: {
                    total_exams: parseInt(examsStats.total_exams),
                    total_attempts: parseInt(examsStats.total_attempts),
                    average_score: parseFloat(examsStats.average_score).toFixed(2)
                },
                recent_announcements: recentAnnouncements,
                attendance_rate_last_30_days: attendanceRate
            }
        });

    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch admin dashboard',
            error: error.message
        });
    }
};

/**
 * Get Teacher Dashboard
 * GET /api/dashboard/teacher
 * Access: Teacher only
 */
const getTeacherDashboard = async (req, res) => {
    try {
        const userId = req.user.id;
        const schoolId = req.user.school_id;

        // My courses statistics
        const coursesStatsQuery = `
      SELECT 
        COUNT(*) as total_courses,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_courses,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_courses
      FROM courses
      WHERE teacher_id = $1
    `;
        const coursesStatsResult = await pool.query(coursesStatsQuery, [userId]);
        const coursesStats = coursesStatsResult.rows[0];

        // My exams statistics (last 30 days)
        const examsStatsQuery = `
      SELECT 
        COUNT(DISTINCT e.id) as total_exams,
        COUNT(DISTINCT ea.id) as total_attempts,
        COALESCE(AVG(ea.score), 0) as average_score,
        COUNT(CASE WHEN ea.status = 'completed' AND ea.graded = false THEN 1 END) as pending_grading
      FROM exams e
      LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
      WHERE e.teacher_id = $1
        AND e.created_at >= CURRENT_DATE - INTERVAL '30 days'
    `;
        const examsStatsResult = await pool.query(examsStatsQuery, [userId]);
        const examsStats = examsStatsResult.rows[0];

        // My students (enrolled in my courses)
        const studentsCountQuery = `
      SELECT COUNT(DISTINCT e.student_id) as total_students
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE c.teacher_id = $1
    `;
        const studentsCountResult = await pool.query(studentsCountQuery, [userId]);
        const studentsCount = studentsCountResult.rows[0].total_students;

        // Upcoming exams (next 5)
        const upcomingExamsQuery = `
      SELECT 
        e.id,
        e.title,
        e.description,
        e.start_date,
        e.end_date,
        e.duration_minutes,
        e.total_points,
        c.title as course_title,
        COUNT(ea.id) as attempts_count
      FROM exams e
      JOIN courses c ON e.course_id = c.id
      LEFT JOIN exam_attempts ea ON e.id = ea.exam_id
      WHERE e.teacher_id = $1
        AND e.start_date >= CURRENT_TIMESTAMP
      GROUP BY e.id, c.id
      ORDER BY e.start_date ASC
      LIMIT 5
    `;
        const upcomingExamsResult = await pool.query(upcomingExamsQuery, [userId]);

        // Recent grading needed (last 10 to grade)
        const gradingNeededQuery = `
      SELECT 
        ea.id,
        ea.score,
        ea.status,
        ea.submitted_at,
        e.title as exam_title,
        e.total_points,
        u.full_name as student_name,
        c.title as course_title
      FROM exam_attempts ea
      JOIN exams e ON ea.exam_id = e.id
      JOIN users u ON ea.student_id = u.id
      JOIN courses c ON e.course_id = c.id
      WHERE e.teacher_id = $1
        AND ea.status = 'completed'
        AND ea.graded = false
      ORDER BY ea.submitted_at ASC
      LIMIT 10
    `;
        const gradingNeededResult = await pool.query(gradingNeededQuery, [userId]);

        res.status(200).json({
            success: true,
            data: {
                courses: {
                    total: parseInt(coursesStats.total_courses),
                    active: parseInt(coursesStats.active_courses),
                    draft: parseInt(coursesStats.draft_courses)
                },
                exams_last_30_days: {
                    total_exams: parseInt(examsStats.total_exams),
                    total_attempts: parseInt(examsStats.total_attempts),
                    average_score: parseFloat(examsStats.average_score).toFixed(2),
                    pending_grading: parseInt(examsStats.pending_grading)
                },
                students: {
                    total: parseInt(studentsCount)
                },
                upcoming_exams: upcomingExamsResult.rows,
                grading_needed: gradingNeededResult.rows
            }
        });

    } catch (error) {
        console.error('Teacher dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch teacher dashboard',
            error: error.message
        });
    }
};

/**
 * Get Student Dashboard
 * GET /api/dashboard/student
 * Access: Student only
 */
const getStudentDashboard = async (req, res) => {
    try {
        const userId = req.user.id;
        const schoolId = req.user.school_id;

        // My courses statistics
        const coursesStatsQuery = `
      SELECT 
        COUNT(*) as total_enrolled,
        COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_courses,
        COUNT(CASE WHEN e.status = 'completed' THEN 1 END) as completed_courses
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.student_id = $1
    `;
        const coursesStatsResult = await pool.query(coursesStatsQuery, [userId]);
        const coursesStats = coursesStatsResult.rows[0];

        // My exam statistics
        const examsStatsQuery = `
      SELECT 
        COUNT(DISTINCT ea.exam_id) as total_exams_taken,
        COUNT(*) as total_attempts,
        COALESCE(AVG(ea.score), 0) as average_score,
        COUNT(CASE WHEN ea.status = 'completed' THEN 1 END) as completed_attempts,
        COUNT(CASE WHEN ea.status = 'in_progress' THEN 1 END) as in_progress_attempts
      FROM exam_attempts ea
      WHERE ea.student_id = $1
    `;
        const examsStatsResult = await pool.query(examsStatsQuery, [userId]);
        const examsStats = examsStatsResult.rows[0];

        // Upcoming exams (next 5)
        const upcomingExamsQuery = `
      SELECT DISTINCT
        e.id,
        e.title,
        e.description,
        e.start_date,
        e.end_date,
        e.duration_minutes,
        e.total_points,
        c.title as course_title,
        u.full_name as teacher_name,
        (SELECT COUNT(*) FROM exam_attempts WHERE exam_id = e.id AND student_id = $1) as my_attempts
      FROM exams e
      JOIN courses c ON e.course_id = c.id
      JOIN users u ON c.teacher_id = u.id
      JOIN enrollments en ON c.id = en.course_id
      WHERE en.student_id = $1
        AND e.start_date >= CURRENT_TIMESTAMP
        AND e.end_date >= CURRENT_TIMESTAMP
      ORDER BY e.start_date ASC
      LIMIT 5
    `;
        const upcomingExamsResult = await pool.query(upcomingExamsQuery, [userId]);

        // Recent grades (last 10)
        let recentGrades = [];
        try {
            const gradesQuery = `
        SELECT 
          g.id,
          g.grade,
          g.points_earned,
          g.points_possible,
          g.feedback,
          g.graded_at,
          c.title as course_title,
          e.title as exam_title,
          u.full_name as teacher_name
        FROM grades g
        JOIN courses c ON g.course_id = c.id
        JOIN exams e ON g.exam_id = e.id
        JOIN users u ON c.teacher_id = u.id
        WHERE g.student_id = $1
        ORDER BY g.graded_at DESC
        LIMIT 10
      `;
            const gradesResult = await pool.query(gradesQuery, [userId]);
            recentGrades = gradesResult.rows;
        } catch (err) {
            // Table might not exist, try with exam_attempts
            const attemptsQuery = `
        SELECT 
          ea.id,
          ea.score as grade,
          ea.score as points_earned,
          e.total_points as points_possible,
          ea.submitted_at as graded_at,
          c.title as course_title,
          e.title as exam_title,
          u.full_name as teacher_name
        FROM exam_attempts ea
        JOIN exams e ON ea.exam_id = e.id
        JOIN courses c ON e.course_id = c.id
        JOIN users u ON c.teacher_id = u.id
        WHERE ea.student_id = $1
          AND ea.graded = true
        ORDER BY ea.submitted_at DESC
        LIMIT 10
      `;
            const attemptsResult = await pool.query(attemptsQuery, [userId]);
            recentGrades = attemptsResult.rows;
        }

        // Attendance rate (last 30 days)
        let attendanceRate = null;
        try {
            const attendanceQuery = `
        SELECT 
          COUNT(*) as total_records,
          COUNT(CASE WHEN status = 'present' THEN 1 END) as present_count
        FROM attendance
        WHERE student_id = $1
          AND date >= CURRENT_DATE - INTERVAL '30 days'
      `;
            const attendanceResult = await pool.query(attendanceQuery, [userId]);
            const attendance = attendanceResult.rows[0];
            if (parseInt(attendance.total_records) > 0) {
                attendanceRate = (parseInt(attendance.present_count) / parseInt(attendance.total_records) * 100).toFixed(2);
            }
        } catch (err) {
            // Table might not exist
            console.log('Attendance table not available');
        }

        res.status(200).json({
            success: true,
            data: {
                courses: {
                    total_enrolled: parseInt(coursesStats.total_enrolled),
                    active: parseInt(coursesStats.active_courses),
                    completed: parseInt(coursesStats.completed_courses)
                },
                exams: {
                    total_exams_taken: parseInt(examsStats.total_exams_taken),
                    total_attempts: parseInt(examsStats.total_attempts),
                    average_score: parseFloat(examsStats.average_score).toFixed(2),
                    completed_attempts: parseInt(examsStats.completed_attempts),
                    in_progress_attempts: parseInt(examsStats.in_progress_attempts)
                },
                upcoming_exams: upcomingExamsResult.rows,
                recent_grades: recentGrades,
                attendance_rate_last_30_days: attendanceRate
            }
        });

    } catch (error) {
        console.error('Student dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch student dashboard',
            error: error.message
        });
    }
};

module.exports = {
    getSuperAdminDashboard,
    getAdminDashboard,
    getTeacherDashboard,
    getStudentDashboard
};
