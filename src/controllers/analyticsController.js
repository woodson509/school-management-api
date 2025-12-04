const db = require('../config/database');

const analyticsController = {
    /**
     * Get comprehensive school statistics for analytics dashboard
     */
    getSchoolStats: async (req, res) => {
        try {
            const schoolId = req.user.school_id;

            // Get total students count
            const studentsQuery = schoolId
                ? `SELECT COUNT(*) FROM users WHERE role = 'student' AND school_id = $1`
                : `SELECT COUNT(*) FROM users WHERE role = 'student'`;
            const studentsResult = await db.query(studentsQuery, schoolId ? [schoolId] : []);
            const totalStudents = parseInt(studentsResult.rows[0].count);

            // Get total teachers count
            const teachersQuery = schoolId
                ? `SELECT COUNT(*) FROM users WHERE role = 'teacher' AND school_id = $1`
                : `SELECT COUNT(*) FROM users WHERE role = 'teacher'`;
            const teachersResult = await db.query(teachersQuery, schoolId ? [schoolId] : []);
            const totalTeachers = parseInt(teachersResult.rows[0].count);

            // Get total classes count
            const classesQuery = schoolId
                ? `SELECT COUNT(*) FROM classes WHERE school_id = $1`
                : `SELECT COUNT(*) FROM classes`;
            const classesResult = await db.query(classesQuery, schoolId ? [schoolId] : []);
            const totalClasses = parseInt(classesResult.rows[0].count);

            // Get overall average from report cards
            const avgQuery = `
                SELECT ROUND(AVG(overall_average)::numeric, 2) as school_average
                FROM report_cards rc
                JOIN users u ON rc.student_id = u.id
                ${schoolId ? 'WHERE u.school_id = $1' : ''}
            `;
            const avgResult = await db.query(avgQuery, schoolId ? [schoolId] : []);
            const schoolAverage = avgResult.rows[0]?.school_average || 0;

            // Get grade distribution
            const gradeDistQuery = `
                SELECT 
                    CASE 
                        WHEN overall_average >= 0 AND overall_average < 6 THEN '0-5'
                        WHEN overall_average >= 6 AND overall_average < 10 THEN '6-9'
                        WHEN overall_average >= 10 AND overall_average < 13 THEN '10-12'
                        WHEN overall_average >= 13 AND overall_average < 16 THEN '13-15'
                        WHEN overall_average >= 16 AND overall_average < 19 THEN '16-18'
                        ELSE '19-20'
                    END as range,
                    COUNT(*) as count
                FROM report_cards rc
                JOIN users u ON rc.student_id = u.id
                ${schoolId ? 'WHERE u.school_id = $1' : ''}
                GROUP BY range
                ORDER BY range
            `;
            const gradeDistResult = await db.query(gradeDistQuery, schoolId ? [schoolId] : []);

            const colorMap = {
                '0-5': '#ef4444',
                '6-9': '#f59e0b',
                '10-12': '#fbbf24',
                '13-15': '#10b981',
                '16-18': '#2563eb',
                '19-20': '#8b5cf6'
            };

            const gradeDistribution = gradeDistResult.rows.map(r => ({
                range: r.range,
                count: parseInt(r.count),
                color: colorMap[r.range] || '#9ca3af'
            }));

            // Get class performance averages
            const classPerformanceQuery = `
                SELECT c.name, 
                       ROUND(AVG(rc.overall_average)::numeric, 2) as average,
                       COUNT(DISTINCT rc.student_id) as students
                FROM classes c
                LEFT JOIN report_cards rc ON c.id = rc.class_id
                ${schoolId ? 'WHERE c.school_id = $1' : ''}
                GROUP BY c.id, c.name
                ORDER BY c.name
            `;
            const classPerformanceResult = await db.query(classPerformanceQuery, schoolId ? [schoolId] : []);
            const classPerformance = classPerformanceResult.rows.map(r => ({
                name: r.name,
                average: parseFloat(r.average) || 0,
                students: parseInt(r.students)
            }));

            // Get subject performance
            const subjectPerformanceQuery = `
                SELECT s.name as subject,
                       ROUND(AVG(g.value / g.max_value * 20)::numeric, 2) as average,
                       ROUND((COUNT(CASE WHEN g.value / g.max_value >= 0.5 THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100)::numeric, 0) as pass_rate
                FROM subjects s
                LEFT JOIN grades g ON s.id = g.subject_id
                GROUP BY s.id, s.name
                HAVING COUNT(g.id) > 0
                ORDER BY s.name
            `;
            const subjectPerformanceResult = await db.query(subjectPerformanceQuery);
            const subjectPerformance = subjectPerformanceResult.rows.map(r => ({
                subject: r.subject,
                average: parseFloat(r.average) || 0,
                passRate: parseInt(r.pass_rate) || 0
            }));

            // Get attendance stats (if attendance table exists)
            let attendanceStats = { presentRate: 0, lateRate: 0, absentRate: 0 };
            try {
                const attendanceQuery = `
                    SELECT 
                        ROUND((COUNT(CASE WHEN status = 'present' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100)::numeric, 0) as present_rate,
                        ROUND((COUNT(CASE WHEN status = 'late' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100)::numeric, 0) as late_rate,
                        ROUND((COUNT(CASE WHEN status = 'absent' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100)::numeric, 0) as absent_rate
                    FROM attendance a
                    JOIN users u ON a.student_id = u.id
                    ${schoolId ? 'WHERE u.school_id = $1' : ''}
                `;
                const attendanceResult = await db.query(attendanceQuery, schoolId ? [schoolId] : []);
                if (attendanceResult.rows[0]) {
                    attendanceStats = {
                        presentRate: parseInt(attendanceResult.rows[0].present_rate) || 0,
                        lateRate: parseInt(attendanceResult.rows[0].late_rate) || 0,
                        absentRate: parseInt(attendanceResult.rows[0].absent_rate) || 0
                    };
                }
            } catch (e) {
                // Attendance table might not exist
            }

            // Calculate pass rate (students with average >= 10)
            const passRateQuery = `
                SELECT 
                    ROUND((COUNT(CASE WHEN overall_average >= 10 THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100)::numeric, 0) as pass_rate
                FROM report_cards rc
                JOIN users u ON rc.student_id = u.id
                ${schoolId ? 'WHERE u.school_id = $1' : ''}
            `;
            const passRateResult = await db.query(passRateQuery, schoolId ? [schoolId] : []);
            const passRate = parseInt(passRateResult.rows[0]?.pass_rate) || 0;

            res.json({
                success: true,
                data: {
                    totalStudents,
                    totalTeachers,
                    totalClasses,
                    schoolAverage: parseFloat(schoolAverage) || 0,
                    passRate,
                    gradeDistribution,
                    classPerformance,
                    subjectPerformance,
                    attendanceStats
                }
            });
        } catch (error) {
            console.error('Error fetching school stats:', error);
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    },

    /**
     * Get performance predictions for a student
     * Uses simple linear regression on past grades
     */
    getStudentPredictions: async (req, res) => {
        try {
            const { student_id } = req.params;

            // Get all past grades for this student, ordered by date
            const query = `
        SELECT g.value, g.max_value, g.created_at, s.name as subject_name, s.id as subject_id
        FROM grades g
        JOIN subjects s ON g.subject_id = s.id
        WHERE g.student_id = $1
        ORDER BY g.created_at ASC
      `;
            const result = await db.query(query, [student_id]);
            const grades = result.rows;

            if (grades.length === 0) {
                return res.json({ success: true, data: [] });
            }

            // Group by subject
            const subjectGrades = {};
            grades.forEach(g => {
                if (!subjectGrades[g.subject_id]) {
                    subjectGrades[g.subject_id] = { name: g.subject_name, scores: [] };
                }
                const normalized = (parseFloat(g.value) / parseFloat(g.max_value)) * 20;
                subjectGrades[g.subject_id].scores.push(normalized);
            });

            const predictions = [];

            for (const subId in subjectGrades) {
                const { name, scores } = subjectGrades[subId];

                // Simple prediction: Weighted average of last 5 grades
                // Weights: 1, 2, 3, 4, 5 (most recent has highest weight)
                const recentScores = scores.slice(-5);
                let weightedSum = 0;
                let weightSum = 0;

                recentScores.forEach((score, index) => {
                    const weight = index + 1;
                    weightedSum += score * weight;
                    weightSum += weight;
                });

                const predicted = weightSum > 0 ? weightedSum / weightSum : 0;

                // Confidence based on consistency (standard deviation)
                const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
                const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;
                const stdDev = Math.sqrt(variance);

                // Lower stdDev = Higher confidence
                // Map stdDev 0-5 to Confidence 100-50
                let confidence = 100 - (stdDev * 10);
                if (confidence < 0) confidence = 10;
                if (scores.length < 3) confidence = 30; // Low confidence if few data points

                predictions.push({
                    subject_id: subId,
                    subject_name: name,
                    predicted_grade: parseFloat(predicted.toFixed(2)),
                    confidence_score: parseFloat(confidence.toFixed(2)),
                    trend: predicted > mean ? 'up' : 'down'
                });
            }

            res.json({ success: true, data: predictions });
        } catch (error) {
            console.error('Error calculating predictions:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    /**
     * Identify scholarship candidates
     * Criteria: Overall Average > 16 (Excellence)
     */
    getScholarshipCandidates: async (req, res) => {
        try {
            // Find students with high averages in the latest report period
            const query = `
        SELECT DISTINCT ON (rc.student_id)
          u.id as student_id, u.full_name, u.email,
          rc.overall_average, rc.rank,
          c.name as class_name
        FROM report_cards rc
        JOIN users u ON rc.student_id = u.id
        JOIN classes c ON rc.class_id = c.id
        WHERE rc.overall_average >= 16
        ORDER BY rc.student_id, rc.generated_at DESC
      `;

            const result = await db.query(query);

            // Save candidates to database if not exists
            for (const candidate of result.rows) {
                try {
                    const check = await db.query(
                        'SELECT * FROM scholarship_candidates WHERE student_id = $1',
                        [candidate.student_id]
                    );

                    if (check.rows.length === 0) {
                        await db.query(
                            `INSERT INTO scholarship_candidates (student_id, criteria_met, status)
                             VALUES ($1, $2, 'identified')`,
                            [candidate.student_id, JSON.stringify({ average: candidate.overall_average, rank: candidate.rank })]
                        );
                    }
                } catch (e) {
                    // Table might not exist, continue
                }
            }

            // Fetch from table to include status
            let finalRes = { rows: [] };
            try {
                const finalQuery = `
                    SELECT sc.*, u.full_name, u.email, c.name as class_name
                    FROM scholarship_candidates sc
                    JOIN users u ON sc.student_id = u.id
                    LEFT JOIN classes c ON u.class_id = c.id
                    ORDER BY sc.identified_at DESC
                `;
                finalRes = await db.query(finalQuery);
            } catch (e) {
                // Use direct query result if table doesn't exist
                finalRes.rows = result.rows;
            }

            res.json({ success: true, data: finalRes.rows });
        } catch (error) {
            console.error('Error identifying candidates:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
};

module.exports = analyticsController;

