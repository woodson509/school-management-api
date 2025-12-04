const db = require('../config/database');

const analyticsController = {
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
        ORDER BY rc.student_id, rc.created_at DESC
      `;

            const result = await db.query(query);

            // Save candidates to database if not exists
            for (const candidate of result.rows) {
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
            }

            // Fetch from table to include status
            const finalQuery = `
        SELECT sc.*, u.full_name, u.email, c.name as class_name
        FROM scholarship_candidates sc
        JOIN users u ON sc.student_id = u.id
        JOIN classes c ON u.class_id = c.id
        ORDER BY sc.identified_at DESC
      `;
            const finalRes = await db.query(finalQuery);

            res.json({ success: true, data: finalRes.rows });
        } catch (error) {
            console.error('Error identifying candidates:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
};

module.exports = analyticsController;
