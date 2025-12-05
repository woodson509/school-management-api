/**
 * Seed Demo Data for Admin User
 * Creates a complete demo environment for admin@example.com
 * Run: node seed-demo-data.js
 */

require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set!');
    process.exit(1);
}

async function seedDemoData() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected!\n');

        // ========================================
        // 1. Create Admin User
        // ========================================
        console.log('👤 Creating admin user...');
        const adminPassword = await bcrypt.hash('admin123', 10);

        const adminResult = await client.query(`
      INSERT INTO users (email, password, full_name, role, phone, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        password = EXCLUDED.password,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role
      RETURNING id
    `, ['admin@example.com', adminPassword, 'Jean-Pierre Duval', 'admin', '+509 3456 7890']);

        const adminId = adminResult.rows[0].id;
        console.log(`   ✅ Admin ID: ${adminId}`);

        // ========================================
        // 2. Create School
        // ========================================
        console.log('\n🏫 Creating school...');
        const schoolResult = await client.query(`
      INSERT INTO schools (name, address, phone, email, website, principal_name, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [
            'Collège Saint-Louis de Gonzague',
            '18, Rue du Centre, Pétion-Ville, Haïti',
            '+509 2941 1234',
            'info@stlouis.edu.ht',
            'https://stlouis.edu.ht',
            'Fr. Michel Jean',
            adminId
        ]);

        let schoolId;
        if (schoolResult.rows.length > 0) {
            schoolId = schoolResult.rows[0].id;
        } else {
            const existingSchool = await client.query(`SELECT id FROM schools LIMIT 1`);
            schoolId = existingSchool.rows[0]?.id;
        }
        console.log(`   ✅ School ID: ${schoolId}`);

        // Update admin with school_id
        await client.query(`UPDATE users SET school_id = $1 WHERE id = $2`, [schoolId, adminId]);

        // ========================================
        // 3. Create Subjects
        // ========================================
        console.log('\n📚 Creating subjects...');
        const subjects = [
            { name: 'Mathématiques', code: 'MATH', description: 'Algèbre, Géométrie, Analyse', credits: 4 },
            { name: 'Français', code: 'FRAN', description: 'Grammaire, Littérature, Rédaction', credits: 4 },
            { name: 'Sciences Physiques', code: 'PHYS', description: 'Physique et Chimie', credits: 3 },
            { name: 'Histoire-Géographie', code: 'HIST', description: 'Histoire d\'Haïti et du monde', credits: 2 },
            { name: 'Anglais', code: 'ANGL', description: 'English Language and Literature', credits: 3 },
            { name: 'Créole', code: 'KREY', description: 'Lang ak kilti ayisyen', credits: 2 },
            { name: 'Éducation Physique', code: 'EPS', description: 'Sport et activités physiques', credits: 1 },
            { name: 'Informatique', code: 'INFO', description: 'Technologie et programmation', credits: 2 }
        ];

        const subjectIds = {};
        for (const subject of subjects) {
            try {
                const result = await client.query(`
          INSERT INTO subjects (name, code, description, credits, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
          ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `, [subject.name, subject.code, subject.description, subject.credits, adminId]);
                subjectIds[subject.code] = result.rows[0].id;
                console.log(`   ✅ ${subject.name}`);
            } catch (e) {
                console.log(`   ⚠️ ${subject.name} - ${e.message}`);
            }
        }

        // ========================================
        // 4. Create Classes
        // ========================================
        console.log('\n🎓 Creating classes...');
        const classes = [
            { name: '6ème A', grade_level: '6ème', school_year: '2024-2025' },
            { name: '6ème B', grade_level: '6ème', school_year: '2024-2025' },
            { name: '5ème A', grade_level: '5ème', school_year: '2024-2025' },
            { name: '4ème A', grade_level: '4ème', school_year: '2024-2025' },
            { name: '3ème A', grade_level: '3ème', school_year: '2024-2025' },
            { name: 'Seconde', grade_level: 'Seconde', school_year: '2024-2025' }
        ];

        const classIds = [];
        for (const cls of classes) {
            try {
                const result = await client.query(`
          INSERT INTO classes (name, grade_level, school_year, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
          RETURNING id
        `, [cls.name, cls.grade_level, cls.school_year, adminId]);
                classIds.push({ id: result.rows[0].id, name: cls.name });
                console.log(`   ✅ ${cls.name}`);
            } catch (e) {
                console.log(`   ⚠️ ${cls.name} - ${e.message}`);
            }
        }

        // ========================================
        // 5. Create Teachers
        // ========================================
        console.log('\n👨‍🏫 Creating teachers...');
        const teachers = [
            { email: 'prof.math@example.com', name: 'Marc Antoine', subject: 'MATH' },
            { email: 'prof.francais@example.com', name: 'Marie Claire', subject: 'FRAN' },
            { email: 'prof.sciences@example.com', name: 'Pierre Paul', subject: 'PHYS' },
            { email: 'prof.histoire@example.com', name: 'Josette Lafontant', subject: 'HIST' },
            { email: 'prof.anglais@example.com', name: 'James Smith', subject: 'ANGL' }
        ];

        const teacherIds = [];
        const teacherPassword = await bcrypt.hash('teacher123', 10);
        for (const teacher of teachers) {
            try {
                const result = await client.query(`
          INSERT INTO users (email, password, full_name, role, school_id, created_at, updated_at)
          VALUES ($1, $2, $3, 'teacher', $4, NOW(), NOW())
          ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
          RETURNING id
        `, [teacher.email, teacherPassword, teacher.name, schoolId]);
                teacherIds.push({ id: result.rows[0].id, name: teacher.name, subject: teacher.subject });
                console.log(`   ✅ ${teacher.name} (${teacher.email})`);
            } catch (e) {
                console.log(`   ⚠️ ${teacher.name} - ${e.message}`);
            }
        }

        // ========================================
        // 6. Create Students
        // ========================================
        console.log('\n👨‍🎓 Creating students...');
        const studentNames = [
            'Jean-Baptiste Marcel', 'Marie-Louise Pierre', 'Joseph François', 'Anne-Marie Dupont',
            'Paul Jean', 'Claire Saint-Louis', 'Michel Beauvoir', 'Sophie Charles',
            'André Bellefleur', 'Martine Célestin', 'Robert Duval', 'Isabelle Lafontaine',
            'Emmanuel Toussaint', 'Nathalie Mercier', 'Jacques Denis', 'Carole Étienne',
            'Philippe Germain', 'Viviane Louissaint', 'Daniel Hyppolite', 'Régine Jean-Pierre'
        ];

        const studentIds = [];
        const studentPassword = await bcrypt.hash('student123', 10);
        for (let i = 0; i < studentNames.length; i++) {
            const name = studentNames[i];
            const email = `student${i + 1}@example.com`;
            const classIndex = i % classIds.length;

            try {
                const result = await client.query(`
          INSERT INTO users (email, password, full_name, role, school_id, created_at, updated_at)
          VALUES ($1, $2, $3, 'student', $4, NOW(), NOW())
          ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
          RETURNING id
        `, [email, studentPassword, name, schoolId]);
                studentIds.push({ id: result.rows[0].id, name, classId: classIds[classIndex]?.id });
                console.log(`   ✅ ${name} (${classIds[classIndex]?.name || 'Unassigned'})`);
            } catch (e) {
                console.log(`   ⚠️ ${name} - ${e.message}`);
            }
        }

        // ========================================
        // 7. Create Courses
        // ========================================
        console.log('\n📖 Creating courses...');
        const courses = [
            { title: 'Mathématiques 6ème', description: 'Cours de mathématiques pour 6ème', teacher: 0, subject: 'MATH' },
            { title: 'Français 6ème', description: 'Grammaire et littérature', teacher: 1, subject: 'FRAN' },
            { title: 'Sciences 6ème', description: 'Introduction aux sciences', teacher: 2, subject: 'PHYS' },
            { title: 'Histoire 6ème', description: 'Histoire d\'Haïti', teacher: 3, subject: 'HIST' },
            { title: 'Anglais 6ème', description: 'English Basics', teacher: 4, subject: 'ANGL' }
        ];

        const courseIds = [];
        for (const course of courses) {
            const teacherId = teacherIds[course.teacher]?.id;
            try {
                const result = await client.query(`
          INSERT INTO courses (title, description, teacher_id, created_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
          RETURNING id
        `, [course.title, course.description, teacherId]);
                courseIds.push(result.rows[0].id);
                console.log(`   ✅ ${course.title}`);
            } catch (e) {
                console.log(`   ⚠️ ${course.title} - ${e.message}`);
            }
        }

        // ========================================
        // 8. Create Announcements
        // ========================================
        console.log('\n📢 Creating announcements...');
        const announcements = [
            {
                title: 'Rentrée Scolaire 2024-2025',
                content: 'La rentrée des classes est prévue pour le lundi 2 septembre 2024. Tous les élèves doivent se présenter à 7h30 avec leur uniforme complet.',
                priority: 'high',
                is_pinned: true
            },
            {
                title: 'Examens du Premier Trimestre',
                content: 'Les examens du premier trimestre auront lieu du 16 au 20 décembre 2024. Veuillez consulter le calendrier détaillé affiché dans chaque classe.',
                priority: 'high',
                is_pinned: true
            },
            {
                title: 'Réunion Parents-Professeurs',
                content: 'Une réunion parents-professeurs est programmée pour le samedi 14 décembre à 9h00. La présence de tous les parents est vivement souhaitée.',
                priority: 'medium',
                is_pinned: false
            },
            {
                title: 'Activités Sportives',
                content: 'Le championnat inter-classes de football débute ce vendredi. Inscrivez-vous auprès du professeur d\'EPS.',
                priority: 'low',
                is_pinned: false
            },
            {
                title: 'Fête de Noël',
                content: 'La fête de Noël de l\'école aura lieu le 20 décembre. Chaque classe préparera une présentation culturelle.',
                priority: 'medium',
                is_pinned: false
            }
        ];

        for (const announcement of announcements) {
            try {
                await client.query(`
          INSERT INTO announcements (school_id, created_by, title, content, priority, is_pinned, target_audience, is_published, published_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, 'all', true, NOW(), NOW(), NOW())
        `, [schoolId, adminId, announcement.title, announcement.content, announcement.priority, announcement.is_pinned]);
                console.log(`   ✅ ${announcement.title}`);
            } catch (e) {
                console.log(`   ⚠️ ${announcement.title} - ${e.message}`);
            }
        }

        // ========================================
        // 9. Create Calendar Events
        // ========================================
        console.log('\n📅 Creating calendar events...');
        const events = [
            { title: 'Rentrée Scolaire', start_date: '2024-09-02', end_date: '2024-09-02', type: 'academic', color: '#3B82F6' },
            { title: 'Fête du Drapeau', start_date: '2024-05-18', end_date: '2024-05-18', type: 'holiday', color: '#EF4444' },
            { title: 'Examens 1er Trimestre', start_date: '2024-12-16', end_date: '2024-12-20', type: 'exam', color: '#F59E0B' },
            { title: 'Vacances de Noël', start_date: '2024-12-21', end_date: '2025-01-06', type: 'holiday', color: '#10B981' },
            { title: 'Examens 2ème Trimestre', start_date: '2025-03-10', end_date: '2025-03-14', type: 'exam', color: '#F59E0B' },
            { title: 'Vacances de Pâques', start_date: '2025-04-14', end_date: '2025-04-21', type: 'holiday', color: '#10B981' },
            { title: 'Examens Officiels', start_date: '2025-06-16', end_date: '2025-06-27', type: 'exam', color: '#EF4444' }
        ];

        for (const event of events) {
            try {
                await client.query(`
          INSERT INTO calendar_events (school_id, title, start_date, end_date, event_type, color, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        `, [schoolId, event.title, event.start_date, event.end_date, event.type, event.color, adminId]);
                console.log(`   ✅ ${event.title}`);
            } catch (e) {
                console.log(`   ⚠️ ${event.title} - ${e.message}`);
            }
        }

        // ========================================
        // Summary
        // ========================================
        console.log('\n' + '='.repeat(50));
        console.log('🎉 DEMO DATA CREATED SUCCESSFULLY!');
        console.log('='.repeat(50));
        console.log('\n📋 Credentials:');
        console.log('─'.repeat(40));
        console.log('Admin:    admin@example.com / admin123');
        console.log('Teachers: prof.math@example.com / teacher123');
        console.log('          prof.francais@example.com / teacher123');
        console.log('Students: student1@example.com / student123');
        console.log('          (student1 to student20)');
        console.log('─'.repeat(40));
        console.log(`\n🏫 School: Collège Saint-Louis de Gonzague`);
        console.log(`📚 Subjects: ${Object.keys(subjectIds).length}`);
        console.log(`🎓 Classes: ${classIds.length}`);
        console.log(`👨‍🏫 Teachers: ${teacherIds.length}`);
        console.log(`👨‍🎓 Students: ${studentIds.length}`);
        console.log(`📖 Courses: ${courseIds.length}`);
        console.log(`📢 Announcements: ${announcements.length}`);
        console.log(`📅 Calendar Events: ${events.length}`);
        console.log('='.repeat(50));

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await client.end();
        console.log('\n👋 Connection closed.');
    }
}

seedDemoData();
