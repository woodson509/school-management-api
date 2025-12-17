
/**
 * Bulk create or update grades
 * @access Private (Teacher, Admin)
 */
exports.saveGradesBulk = async (req, res) => {
    const client = await db.pool.connect();
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

        res.status(200).json({
            success: true,
            message: 'Grades saved successfully',
            data: results
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error batch saving grades:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving grades',
            error: error.message
        });
    } finally {
        client.release();
    }
};
