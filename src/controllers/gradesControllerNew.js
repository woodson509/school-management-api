/**
 * Grades Controller
 * Manages student grades and average calculations
 */

const db = require('../config/database');

/**
 * Get grades with filtering
 * @access Private
 */
exports.getGrades = async (req, res) => {
    try {
        const { student_id, subject_id, class_id, report_period_id, exam_id } = req.query;

        let query = `
            SELECT 
                g.*,
                u.full_name as student_name,
                s.name as subject_name,
                c.name as class_name,
                rp.name as period_name,
                recorder.full_name as recorded_by_name
            FROM grades g
            JOIN users u ON g.student_id = u.id
            JOIN users u ON g.student_id = u.id
            LEFT JOIN subjects s ON g.subject_id = s.id
            LEFT JOIN classes c ON g.class_id = c.id
            LEFT JOIN report_periods rp ON g.report_period_id = rp.id
            LEFT JOIN users recorder ON g.recorded_by = recorder.id
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 1;

        if (student_id) {
            query += ` AND g.student_id = $${paramCount}`;
            params.push(student_id);
            paramCount++;
        }

        if (subject_id) {
            query += ` AND g.subject_id = $${paramCount}`;
            params.push(subject_id);
            paramCount++;
        }

        if (class_id) {
            query += ` AND g.class_id = $${paramCount}`;
            params.push(class_id);
            paramCount++;
        }

        if (report_period_id) {
            query += ` AND g.report_period_id = $${paramCount}`;
            params.push(report_period_id);
            paramCount++;
        }

        if (exam_id) {
            query += ` AND g.exam_id = $${paramCount}`;
            params.push(exam_id);
            paramCount++;
        }

        query += ' ORDER BY g.created_at DESC';

        console.log(`[DEBUG] getGrades Query: ${query}`);
        console.log(`[DEBUG] getGrades Params:`, params);

        const result = await db.query(query, params);

        console.log(`[DEBUG] getGrades Rows Found: ${result.rows.length}`);
        if (result.rows.length > 0) {
            console.log(`[DEBUG] First Grade:`, result.rows[0]);
        }

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching grades:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching grades',
            error: error.message
        });
    }
};

/**
 * Create a new grade
 * @access Private (Teacher, Admin)
 */
exports.createGrade = async (req, res) => {
    try {
        const {
            student_id,
            subject_id,
            class_id,
            report_period_id,
            grade_type,
            value,
            max_value,
            weight = 1.0,
            notes,
            exam_id
        } = req.body;

        const recorded_by = req.user.id;

        // Validate value against max_value
        if (parseFloat(value) > parseFloat(max_value)) {
            return res.status(400).json({
                success: false,
                message: 'Grade value cannot exceed max value'
            });
        }

        const query = `
            INSERT INTO grades (
                student_id, subject_id, class_id, report_period_id,
                grade_type, value, max_value, weight, notes, recorded_by, exam_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `;

        const result = await db.query(query, [
            student_id, subject_id, class_id, report_period_id,
            grade_type, value, max_value, weight, notes, recorded_by, exam_id
        ]);

        res.status(201).json({
            success: true,
            message: 'Grade created successfully',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating grade:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating grade',
            error: error.message
        });
    }
};

/**
 * Update a grade
 * @access Private (Teacher, Admin)
 */
exports.updateGrade = async (req, res) => {
    try {
        const { id } = req.params;
        const { value, max_value, weight, notes, grade_type } = req.body;

        // Validate value against max_value if both provided
        if (value && max_value && parseFloat(value) > parseFloat(max_value)) {
            return res.status(400).json({
                success: false,
                message: 'Grade value cannot exceed max value'
            });
        }

        const query = `
            UPDATE grades
            SET value = COALESCE($1, value),
                max_value = COALESCE($2, max_value),
                weight = COALESCE($3, weight),
                notes = COALESCE($4, notes),
                grade_type = COALESCE($5, grade_type),
                updated_at = NOW()
            WHERE id = $6
            RETURNING *
        `;

        const result = await db.query(query, [value, max_value, weight, notes, grade_type, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Grade not found'
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating grade:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating grade',
            error: error.message
        });
    }
};

/**
 * Delete a grade
 * @access Private (Teacher, Admin)
 */
exports.deleteGrade = async (req, res) => {
    try {
        const { id } = req.params;

        await db.query('DELETE FROM grades WHERE id = $1', [id]);

        res.status(200).json({
            success: true,
            message: 'Grade deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting grade:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting grade',
            error: error.message
        });
    }
};

/**
 * Calculate average for a student in a subject for a period
 * @access Private
 */
exports.calculateAverage = async (req, res) => {
    try {
        const { student_id, subject_id, report_period_id } = req.query;

        if (!student_id || !subject_id || !report_period_id) {
            return res.status(400).json({
                success: false,
                message: 'student_id, subject_id, and report_period_id are required'
            });
        }

        // Get all grades for this student/subject/period
        const gradesQuery = `
            SELECT value, max_value, weight
            FROM grades
            WHERE student_id = $1
              AND subject_id = $2
              AND report_period_id = $3
        `;

        const gradesResult = await db.query(gradesQuery, [student_id, subject_id, report_period_id]);

        if (gradesResult.rows.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    average: null,
                    percentage: null,
                    grades_count: 0
                }
            });
        }

        // Calculate weighted average
        let totalWeightedScore = 0;
        let totalWeight = 0;

        gradesResult.rows.forEach(grade => {
            const percentage = (parseFloat(grade.value) / parseFloat(grade.max_value)) * 100;
            const weight = parseFloat(grade.weight);
            totalWeightedScore += percentage * weight;
            totalWeight += weight;
        });

        const averagePercentage = totalWeightedScore / totalWeight;

        // Get grading scale to get max value
        const scaleQuery = `
            SELECT gs.max_value
            FROM school_settings ss
            JOIN grading_scales gs ON gs.id::text = ss.setting_value
            WHERE ss.setting_key = 'grading_scale_id'
        `;

        const scaleResult = await db.query(scaleQuery);
        const maxValue = scaleResult.rows.length > 0 ? parseFloat(scaleResult.rows[0].max_value) : 20;

        const average = (averagePercentage / 100) * maxValue;

        res.status(200).json({
            success: true,
            data: {
                average: average.toFixed(2),
                percentage: averagePercentage.toFixed(2),
                grades_count: gradesResult.rows.length
            }
        });
    } catch (error) {
        console.error('Error calculating average:', error);
        res.status(500).json({
            success: false,
            message: 'Error calculating average',
            error: error.message
        });
    }
};

/**
 * Calculate overall average for a student for a period (all subjects with coefficients)
 * @access Private
 */
exports.calculateOverallAverage = async (req, res) => {
    try {
        const { student_id, report_period_id } = req.query;

        if (!student_id || !report_period_id) {
            return res.status(400).json({
                success: false,
                message: 'student_id and report_period_id are required'
            });
        }

        // Get student's class
        const studentQuery = 'SELECT class_id FROM users WHERE id = $1';
        const studentResult = await db.query(studentQuery, [student_id]);

        if (studentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        const class_id = studentResult.rows[0].class_id;

        // Get all subjects with their coefficients for this class
        const subjectsQuery = `
            SELECT 
                s.id as subject_id,
                s.name as subject_name,
                COALESCE(sc.coefficient, 1.0) as coefficient
            FROM subjects s
            LEFT JOIN subject_coefficients sc ON s.id = sc.subject_id AND sc.class_id = $1
        `;

        const subjectsResult = await db.query(subjectsQuery, [class_id]);

        let totalWeightedScore = 0;
        let totalCoefficient = 0;
        const subjectAverages = [];

        for (const subject of subjectsResult.rows) {
            // Calculate average for each subject
            const avgQuery = req.query;
            avgQuery.subject_id = subject.subject_id;

            const gradesQuery = `
                SELECT value, max_value, weight
                FROM grades
                WHERE student_id = $1
                  AND subject_id = $2
                  AND report_period_id = $3
            `;

            const gradesResult = await db.query(gradesQuery, [
                student_id, subject.subject_id, report_period_id
            ]);

            if (gradesResult.rows.length > 0) {
                let subjectWeightedScore = 0;
                let subjectTotalWeight = 0;

                gradesResult.rows.forEach(grade => {
                    const percentage = (parseFloat(grade.value) / parseFloat(grade.max_value)) * 100;
                    const weight = parseFloat(grade.weight);
                    subjectWeightedScore += percentage * weight;
                    subjectTotalWeight += weight;
                });

                const subjectPercentage = subjectWeightedScore / subjectTotalWeight;
                const coefficient = parseFloat(subject.coefficient);

                totalWeightedScore += subjectPercentage * coefficient;
                totalCoefficient += coefficient;

                subjectAverages.push({
                    subject_id: subject.subject_id,
                    subject_name: subject.subject_name,
                    average: subjectPercentage.toFixed(2),
                    coefficient: coefficient
                });
            }
        }

        const overallPercentage = totalCoefficient > 0 ? totalWeightedScore / totalCoefficient : 0;

        // Get grading scale
        const scaleQuery = `
            SELECT gs.max_value
            FROM school_settings ss
            JOIN grading_scales gs ON gs.id::text = ss.setting_value
            WHERE ss.setting_key = 'grading_scale_id'
        `;

        const scaleResult = await db.query(scaleQuery);
        const maxValue = scaleResult.rows.length > 0 ? parseFloat(scaleResult.rows[0].max_value) : 20;

        const overallAverage = (overallPercentage / 100) * maxValue;

        res.status(200).json({
            success: true,
            data: {
                overall_average: overallAverage.toFixed(2),
                overall_percentage: overallPercentage.toFixed(2),
                subject_averages: subjectAverages
            }
        });
    } catch (error) {
        console.error('Error calculating overall average:', error);
        res.status(500).json({
            success: false,
            message: 'Error calculating overall average',
            error: error.message
        });
    }
};

/**
 * Bulk create or update grades
 * @access Private (Teacher, Admin)
 */
exports.saveGradesBulk = async (req, res) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        const { grades } = req.body; // Array of grade objects
        const recorded_by = req.user.id;

        if (!Array.isArray(grades) || grades.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No grades provided'
            });
        }

        const results = [];

        for (const grade of grades) {
            const {
                student_id, subject_id, class_id, report_period_id,
                grade_type, value, max_value, weight = 1.0, notes, exam_id,
                id // If id exists, it's an update
            } = grade;

            // Validate
            if (parseFloat(value) > parseFloat(max_value)) {
                throw new Error(`Grade value ${value} cannot exceed max value ${max_value} for student ${student_id}`);
            }

            let query;
            let params;

            if (id) {
                // Update existing grade
                query = `
                    UPDATE grades
                    SET value = $1, max_value = $2, weight = $3, notes = $4, updated_at = NOW()
                    WHERE id = $5
                    RETURNING *
                `;
                params = [value, max_value, weight, notes, id];
            } else {
                // Create new grade
                // Check if grade already exists for this exam/student to avoid duplicates if ID missing
                if (exam_id) {
                    const existingCheck = await client.query(
                        `SELECT id FROM grades WHERE student_id = $1 AND exam_id = $2`,
                        [student_id, exam_id]
                    );

                    if (existingCheck.rows.length > 0) {
                        query = `
                            UPDATE grades
                            SET value = $1, max_value = $2, weight = $3, notes = $4, updated_at = NOW()
                            WHERE id = $5
                            RETURNING *
                        `;
                        params = [value, max_value, weight, notes, existingCheck.rows[0].id];
                    } else {
                        query = `
                            INSERT INTO grades (
                                student_id, subject_id, class_id, report_period_id,
                                grade_type, value, max_value, weight, notes, recorded_by, exam_id
                            )
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                            RETURNING *
                        `;
                        params = [
                            student_id, subject_id, class_id, report_period_id,
                            grade_type, value, max_value, weight, notes, recorded_by, exam_id
                        ];
                    }
                } else {
                    // Fallback for non-exam grades (simple insert)
                    query = `
                        INSERT INTO grades (
                            student_id, subject_id, class_id, report_period_id,
                            grade_type, value, max_value, weight, notes, recorded_by
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        RETURNING *
                    `;
                    params = [
                        student_id, subject_id, class_id, report_period_id,
                        grade_type, value, max_value, weight, notes, recorded_by
                    ];
                }
            }

            const result = await client.query(query, params);
            results.push(result.rows[0]);
        }



        await client.query('COMMIT');

        console.log(`[DEBUG] Bulk save successful. Saved ${results.length} grades.`);

        res.status(200).json({
            success: true,
            message: 'Grades saved successfully',
            data: results
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error batch saving grades:', error);
        console.error('First grade payload sample:', req.body.grades?.[0]);
        console.error('User ID:', req.user?.id);

        res.status(500).json({
            success: false,
            message: 'Error saving grades',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        client.release();
    }
};
