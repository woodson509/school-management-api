/**
 * Script de diagnostic et correction pour le rôle SuperAdmin
 * Ce script vérifie et corrige la contrainte CHECK, puis crée le superadmin
 */

const bcrypt = require('bcryptjs');
const { pool } = require('./src/config/database');

const SUPERADMIN_CONFIG = {
    email: 'superadmin@school.com',
    password: 'SuperAdmin123!',
    fullName: 'Super Administrator',
    role: 'superadmin'
};

async function fixConstraintAndCreateSuperAdmin() {
    let client;

    try {
        console.log('🔍 DIAGNOSTIC ET CORRECTION\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        client = await pool.connect();

        // Étape 1: Vérifier la contrainte actuelle
        console.log('1️⃣  Vérification de la contrainte actuelle...');
        const checkConstraint = `
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conname = 'users_role_check';
    `;

        const constraintResult = await client.query(checkConstraint);

        if (constraintResult.rows.length > 0) {
            console.log('   ✓ Contrainte trouvée:');
            console.log('   ', constraintResult.rows[0].definition);
            console.log('');
        }

        // Étape 2: Supprimer et recréer la contrainte
        console.log('2️⃣  Mise à jour de la contrainte CHECK...');

        await client.query('BEGIN');

        try {
            // Supprimer l'ancienne contrainte
            await client.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;');
            console.log('   ✓ Ancienne contrainte supprimée');

            // Créer la nouvelle contrainte
            await client.query(`
        ALTER TABLE users ADD CONSTRAINT users_role_check 
        CHECK (role IN ('admin', 'superadmin', 'teacher', 'student', 'agent'));
      `);
            console.log('   ✓ Nouvelle contrainte créée');

            await client.query('COMMIT');
            console.log('   ✓ Transaction validée\n');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }

        // Étape 3: Vérifier à nouveau
        console.log('3️⃣  Vérification de la nouvelle contrainte...');
        const verifyResult = await client.query(checkConstraint);
        console.log('   ', verifyResult.rows[0].definition);
        console.log('');

        // Étape 4: Créer le SuperAdmin
        console.log('4️⃣  Création du SuperAdmin...\n');

        const hashedPassword = await bcrypt.hash(SUPERADMIN_CONFIG.password, 10);

        // Vérifier si l'utilisateur existe
        const checkUser = await client.query(
            'SELECT id, email, role FROM users WHERE email = $1',
            [SUPERADMIN_CONFIG.email]
        );

        let result;

        if (checkUser.rows.length > 0) {
            console.log('   ⚠️  Utilisateur existant trouvé, mise à jour...');
            result = await client.query(`
        UPDATE users 
        SET role = $1, 
            full_name = $2,
            password = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE email = $4
        RETURNING id, email, full_name, role, created_at;
      `, [SUPERADMIN_CONFIG.role, SUPERADMIN_CONFIG.fullName, hashedPassword, SUPERADMIN_CONFIG.email]);
        } else {
            console.log('   ✨ Création d\'un nouvel utilisateur...');
            result = await client.query(`
        INSERT INTO users (email, password, full_name, role, is_active, created_at)
        VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
        RETURNING id, email, full_name, role, created_at;
      `, [SUPERADMIN_CONFIG.email, hashedPassword, SUPERADMIN_CONFIG.fullName, SUPERADMIN_CONFIG.role]);
        }

        const user = result.rows[0];

        console.log('\n✅ SUCCÈS!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 INFORMATIONS DU SUPERADMIN:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`ID:           ${user.id}`);
        console.log(`Email:        ${user.email}`);
        console.log(`Nom complet:  ${user.full_name}`);
        console.log(`Rôle:         ${user.role}`);
        console.log(`Créé le:      ${user.created_at}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('🔑 IDENTIFIANTS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Email:        ${SUPERADMIN_CONFIG.email}`);
        console.log(`Password:     ${SUPERADMIN_CONFIG.password}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('\n❌ ERREUR:\n');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error(`Message: ${error.message}`);
        if (error.code) console.error(`Code:    ${error.code}`);
        if (error.detail) console.error(`Détail:  ${error.detail}`);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

fixConstraintAndCreateSuperAdmin();
