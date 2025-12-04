const db = require('../config/database');
const { validateUUID } = require('../utils/validation');

const reportCardController = {
    /**
     * Generate report cards for an entire class for a specific period
     * Calculates averages, ranks, and class statistics
     */
    generateClassReportCards: async (req, res) => {
        const client = await db.getClient();
        try {
            const { class_id, report_period_id } = req.body;

            if (!validateUUID(class_id) || !validateUUID(report_period_id)) {
                return res.status(400).json({ message: 'Invalid IDs provided' });
            }

            await client.query('BEGIN');

            // 1. Get all students in the class
            const studentsQuery = `
        SELECT id FROM users 
        WHERE class_id = $1 AND role = 'student' AND is_active = true
      `;
            const studentsRes = await client.query(studentsQuery, [class_id]);
            const students = studentsRes.rows;

            if (students.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'No students found in this class' });
            }

            // 2. Get all subjects and coefficients for the class
            const subjectsQuery = `
        SELECT s.id, s.name, COALESCE(sc.coefficient, 1.0) as coefficient
        FROM subjects s
        LEFT JOIN subject_coefficients sc ON s.id = sc.subject_id AND sc.class_id = $1
        WHERE s.is_active = true
      `;
            const subjectsRes = await client.query(subjectsQuery, [class_id]);
            const subjects = subjectsRes.rows;

            // 3. Get grading scale (assume default /20 for now, or fetch from settings)
            // TODO: Fetch active grading scale from settings

            // 4. Calculate averages for each student
            const studentAverages = [];

            for (const student of students) {
                let totalWeightedScore = 0;
                let totalCoefficients = 0;
                const subjectDetails = [];

                for (const subject of subjects) {
                    // Get grades for this student and subject in the period
                    const gradesQuery = `
            SELECT value, max_value, weight 
            FROM grades 
            WHERE student_id = $1 AND subject_id = $2 AND report_period_id = $3
          `;
                    const gradesRes = await client.query(gradesQuery, [student.id, subject.id, report_period_id]);
                    const grades = gradesRes.rows;

                    let subjectAverage = null;

                    if (grades.length > 0) {
                        const totalScore = grades.reduce((sum, g) => {
                            const normalized = (parseFloat(g.value) / parseFloat(g.max_value)) * 100; // Normalize to 100
                            return sum + (normalized * parseFloat(g.weight));
                        }, 0);
                        const totalWeight = grades.reduce((sum, g) => sum + parseFloat(g.weight), 0);

                        // Average out of 100
                        const avg100 = totalWeight > 0 ? totalScore / totalWeight : 0;

                        // Convert to scale /20 (hardcoded for now, should be dynamic)
                        subjectAverage = (avg100 / 100) * 20;

                        totalWeightedScore += subjectAverage * parseFloat(subject.coefficient);
                        totalCoefficients += parseFloat(subject.coefficient);
                    }

                    subjectDetails.push({
                        subject_id: subject.id,
                        average: subjectAverage,
                        coefficient: parseFloat(subject.coefficient)
                    });
                }

                const overallAverage = totalCoefficients > 0 ? totalWeightedScore / totalCoefficients : 0;

                studentAverages.push({
                    student_id: student.id,
                    overall_average: parseFloat(overallAverage.toFixed(2)),
                    subjects: subjectDetails
                });
            }

            // 5. Calculate Ranks
            studentAverages.sort((a, b) => b.overall_average - a.overall_average);
            studentAverages.forEach((student, index) => {
                student.rank = index + 1;
            });

            // 6. Calculate Class Statistics (Min, Max, Avg)
            const classStats = {
                overall: {
                    min: Math.min(...studentAverages.map(s => s.overall_average)),
                    max: Math.max(...studentAverages.map(s => s.overall_average)),
                    avg: studentAverages.reduce((sum, s) => sum + s.overall_average, 0) / studentAverages.length
                },
                subjects: {}
            };

            // Calculate per-subject stats
            for (const subject of subjects) {
                const scores = studentAverages
                    .map(s => s.subjects.find(sub => sub.subject_id === subject.id)?.average)
                    .filter(val => val !== null);

                if (scores.length > 0) {
                    classStats.subjects[subject.id] = {
                        min: Math.min(...scores),
                        max: Math.max(...scores),
                        avg: scores.reduce((a, b) => a + b, 0) / scores.length
                    };
                }
            }

            // 7. Save to Database
            // Delete existing report cards for this class/period to avoid duplicates (or update)
            await client.query(`
        DELETE FROM report_cards 
        WHERE class_id = $1 AND report_period_id = $2
      `, [class_id, report_period_id]);

            for (const studentData of studentAverages) {
                // Create Report Card
                const insertCardQuery = `
          INSERT INTO report_cards (
            student_id, class_id, report_period_id, 
            overall_average, class_average, min_average, max_average, 
            rank, total_students, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')
          RETURNING id
        `;

                const cardValues = [
                    studentData.student_id,
                    class_id,
                    report_period_id,
                    studentData.overall_average,
                    classStats.overall.avg.toFixed(2),
                    classStats.overall.min.toFixed(2),
                    classStats.overall.max.toFixed(2),
                    studentData.rank,
                    students.length
                ];

                const cardRes = await client.query(insertCardQuery, cardValues);
                const reportCardId = cardRes.rows[0].id;

                // Create Report Card Subjects
                for (const sub of studentData.subjects) {
                    if (sub.average !== null) {
                        const stats = classStats.subjects[sub.subject_id] || { min: 0, max: 0, avg: 0 };

                        await client.query(`
              INSERT INTO report_card_subjects (
                report_card_id, subject_id, subject_average, 
                class_subject_average, min_subject_average, max_subject_average,
                coefficient
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                            reportCardId,
                            sub.subject_id,
                            sub.average.toFixed(2),
                            stats.avg.toFixed(2),
                            stats.min.toFixed(2),
                            stats.max.toFixed(2),
                            sub.coefficient
                        ]);
                    }
                }
            }

            await client.query('COMMIT');
            res.status(201).json({
                success: true,
                message: `Generated ${studentAverages.length} report cards`,
                data: { generated_count: studentAverages.length }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error generating report cards:', error);
            res.status(500).json({ message: 'Server error during generation' });
        } finally {
            client.release();
        }
    },

    /**
     * Get report cards for a class and period
     */
    getClassReportCards: async (req, res) => {
        try {
            const { class_id, report_period_id } = req.query;

            const query = `
        SELECT rc.*, u.full_name as student_name, u.email as student_email
        FROM report_cards rc
        JOIN users u ON rc.student_id = u.id
        WHERE rc.class_id = $1 AND rc.report_period_id = $2
        ORDER BY rc.rank ASC
      `;

            const result = await db.query(query, [class_id, report_period_id]);
            res.json({ success: true, data: result.rows });
        } catch (error) {
            console.error('Error fetching report cards:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    /**
     * Get full details of a single report card
     */
    getReportCardDetails: async (req, res) => {
        try {
            const { id } = req.params;

            // Get card info
            const cardQuery = `
        SELECT rc.*, 
               u.full_name as student_name, u.email as student_email,
               c.name as class_name,
               rp.name as period_name, rp.school_year
        FROM report_cards rc
        JOIN users u ON rc.student_id = u.id
        JOIN classes c ON rc.class_id = c.id
        JOIN report_periods rp ON rc.report_period_id = rp.id
        WHERE rc.id = $1
      `;
            const cardRes = await db.query(cardQuery, [id]);

            if (cardRes.rows.length === 0) {
                return res.status(404).json({ message: 'Report card not found' });
            }

            // Get subjects
            const subjectsQuery = `
        SELECT rcs.*, s.name as subject_name, s.code as subject_code
        FROM report_card_subjects rcs
        JOIN subjects s ON rcs.subject_id = s.id
        WHERE rcs.report_card_id = $1
        ORDER BY s.name ASC
      `;
            const subjectsRes = await db.query(subjectsQuery, [id]);

            res.json({
                success: true,
                data: {
                    ...cardRes.rows[0],
                    subjects: subjectsRes.rows
                }
            });
        } catch (error) {
            console.error('Error fetching report card details:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
};

module.exports = reportCardController;
