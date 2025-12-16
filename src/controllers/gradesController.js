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
            JOIN subjects s ON g.subject_id = s.id
            JOIN classes c ON g.class_id = c.id
            JOIN report_periods rp ON g.report_period_id = rp.id
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

        const result = await db.query(query, params);

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
/ * *  
   *   B u l k   c r e a t e   o r   u p d a t e   g r a d e s  
   *   @ a c c e s s   P r i v a t e   ( T e a c h e r ,   A d m i n )  
   * /  
 e x p o r t s . s a v e G r a d e s B u l k   =   a s y n c   ( r e q ,   r e s )   = >   {  
         c o n s t   c l i e n t   =   a w a i t   d b . p o o l . c o n n e c t ( ) ;  
         t r y   {  
                 a w a i t   c l i e n t . q u e r y ( ' B E G I N ' ) ;  
  
                 c o n s t   {   g r a d e s   }   =   r e q . b o d y ;   / /   A r r a y   o f   g r a d e   o b j e c t s  
                 c o n s t   r e c o r d e d _ b y   =   r e q . u s e r . i d ;  
  
                 i f   ( ! A r r a y . i s A r r a y ( g r a d e s )   | |   g r a d e s . l e n g t h   = = =   0 )   {  
                         r e t u r n   r e s . s t a t u s ( 4 0 0 ) . j s o n ( {  
                                 s u c c e s s :   f a l s e ,  
                                 m e s s a g e :   ' N o   g r a d e s   p r o v i d e d '  
                         } ) ;  
                 }  
  
                 c o n s t   r e s u l t s   =   [ ] ;  
  
                 f o r   ( c o n s t   g r a d e   o f   g r a d e s )   {  
                         c o n s t   {  
                                 s t u d e n t _ i d ,   s u b j e c t _ i d ,   c l a s s _ i d ,   r e p o r t _ p e r i o d _ i d ,  
                                 g r a d e _ t y p e ,   v a l u e ,   m a x _ v a l u e ,   w e i g h t   =   1 . 0 ,   n o t e s ,   e x a m _ i d ,  
                                 i d   / /   I f   i d   e x i s t s ,   i t ' s   a n   u p d a t e  
                         }   =   g r a d e ;  
  
                         / /   V a l i d a t e  
                         i f   ( p a r s e F l o a t ( v a l u e )   >   p a r s e F l o a t ( m a x _ v a l u e ) )   {  
                                 t h r o w   n e w   E r r o r ( ` G r a d e   v a l u e   $ { v a l u e }   c a n n o t   e x c e e d   m a x   v a l u e   $ { m a x _ v a l u e }   f o r   s t u d e n t   $ { s t u d e n t _ i d } ` ) ;  
                         }  
  
                         l e t   q u e r y ;  
                         l e t   p a r a m s ;  
  
                         i f   ( i d )   {  
                                 / /   U p d a t e   e x i s t i n g   g r a d e  
                                 q u e r y   =   `  
                                         U P D A T E   g r a d e s  
                                         S E T   v a l u e   =   $ 1 ,   m a x _ v a l u e   =   $ 2 ,   w e i g h t   =   $ 3 ,   n o t e s   =   $ 4 ,   u p d a t e d _ a t   =   N O W ( )  
                                         W H E R E   i d   =   $ 5  
                                         R E T U R N I N G   *  
                                 ` ;  
                                 p a r a m s   =   [ v a l u e ,   m a x _ v a l u e ,   w e i g h t ,   n o t e s ,   i d ] ;  
                         }   e l s e   {  
                                 / /   C r e a t e   n e w   g r a d e  
                                 / /   C h e c k   i f   g r a d e   a l r e a d y   e x i s t s   f o r   t h i s   e x a m / s t u d e n t   t o   a v o i d   d u p l i c a t e s   i f   I D   m i s s i n g  
                                 i f   ( e x a m _ i d )   {  
                                         c o n s t   e x i s t i n g C h e c k   =   a w a i t   c l i e n t . q u e r y (  
                                                 ` S E L E C T   i d   F R O M   g r a d e s   W H E R E   s t u d e n t _ i d   =   $ 1   A N D   e x a m _ i d   =   $ 2 ` ,  
                                                 [ s t u d e n t _ i d ,   e x a m _ i d ]  
                                         ) ;  
  
                                         i f   ( e x i s t i n g C h e c k . r o w s . l e n g t h   >   0 )   {  
                                                 q u e r y   =   `  
                                                         U P D A T E   g r a d e s  
                                                         S E T   v a l u e   =   $ 1 ,   m a x _ v a l u e   =   $ 2 ,   w e i g h t   =   $ 3 ,   n o t e s   =   $ 4 ,   u p d a t e d _ a t   =   N O W ( )  
                                                         W H E R E   i d   =   $ 5  
                                                         R E T U R N I N G   *  
                                                 ` ;  
                                                 p a r a m s   =   [ v a l u e ,   m a x _ v a l u e ,   w e i g h t ,   n o t e s ,   e x i s t i n g C h e c k . r o w s [ 0 ] . i d ] ;  
                                         }   e l s e   {  
                                                 q u e r y   =   `  
                                                         I N S E R T   I N T O   g r a d e s   (  
                                                                 s t u d e n t _ i d ,   s u b j e c t _ i d ,   c l a s s _ i d ,   r e p o r t _ p e r i o d _ i d ,  
                                                                 g r a d e _ t y p e ,   v a l u e ,   m a x _ v a l u e ,   w e i g h t ,   n o t e s ,   r e c o r d e d _ b y ,   e x a m _ i d  
                                                         )  
                                                         V A L U E S   ( $ 1 ,   $ 2 ,   $ 3 ,   $ 4 ,   $ 5 ,   $ 6 ,   $ 7 ,   $ 8 ,   $ 9 ,   $ 1 0 ,   $ 1 1 )  
                                                         R E T U R N I N G   *  
                                                 ` ;  
                                                 p a r a m s   =   [  
                                                         s t u d e n t _ i d ,   s u b j e c t _ i d ,   c l a s s _ i d ,   r e p o r t _ p e r i o d _ i d ,  
                                                         g r a d e _ t y p e ,   v a l u e ,   m a x _ v a l u e ,   w e i g h t ,   n o t e s ,   r e c o r d e d _ b y ,   e x a m _ i d  
                                                 ] ;  
                                         }  
                                 }   e l s e   {  
                                         / /   F a l l b a c k   f o r   n o n - e x a m   g r a d e s   ( s i m p l e   i n s e r t )  
                                         q u e r y   =   `  
                                                 I N S E R T   I N T O   g r a d e s   (  
                                                         s t u d e n t _ i d ,   s u b j e c t _ i d ,   c l a s s _ i d ,   r e p o r t _ p e r i o d _ i d ,  
                                                         g r a d e _ t y p e ,   v a l u e ,   m a x _ v a l u e ,   w e i g h t ,   n o t e s ,   r e c o r d e d _ b y  
                                                 )  
                                                 V A L U E S   ( $ 1 ,   $ 2 ,   $ 3 ,   $ 4 ,   $ 5 ,   $ 6 ,   $ 7 ,   $ 8 ,   $ 9 ,   $ 1 0 )  
                                                 R E T U R N I N G   *  
                                         ` ;  
                                         p a r a m s   =   [  
                                                 s t u d e n t _ i d ,   s u b j e c t _ i d ,   c l a s s _ i d ,   r e p o r t _ p e r i o d _ i d ,  
                                                 g r a d e _ t y p e ,   v a l u e ,   m a x _ v a l u e ,   w e i g h t ,   n o t e s ,   r e c o r d e d _ b y  
                                         ] ;  
                                 }  
                         }  
  
                         c o n s t   r e s u l t   =   a w a i t   c l i e n t . q u e r y ( q u e r y ,   p a r a m s ) ;  
                         r e s u l t s . p u s h ( r e s u l t . r o w s [ 0 ] ) ;  
                 }  
  
                 a w a i t   c l i e n t . q u e r y ( ' C O M M I T ' ) ;  
  
                 r e s . s t a t u s ( 2 0 0 ) . j s o n ( {  
                         s u c c e s s :   t r u e ,  
                         m e s s a g e :   ' G r a d e s   s a v e d   s u c c e s s f u l l y ' ,  
                         d a t a :   r e s u l t s  
                 } ) ;  
  
         }   c a t c h   ( e r r o r )   {  
                 a w a i t   c l i e n t . q u e r y ( ' R O L L B A C K ' ) ;  
                 c o n s o l e . e r r o r ( ' E r r o r   b a t c h   s a v i n g   g r a d e s : ' ,   e r r o r ) ;  
                 r e s . s t a t u s ( 5 0 0 ) . j s o n ( {  
                         s u c c e s s :   f a l s e ,  
                         m e s s a g e :   ' E r r o r   s a v i n g   g r a d e s ' ,  
                         e r r o r :   e r r o r . m e s s a g e  
                 } ) ;  
         }   f i n a l l y   {  
                 c l i e n t . r e l e a s e ( ) ;  
         }  
 } ;  
 