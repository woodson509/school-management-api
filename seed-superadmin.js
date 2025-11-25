/**
 * Script de Seed pour créer un utilisateur SuperAdmin
 * Usage: node seed-superadmin.js
 * 
 * Ce script crée un utilisateur avec le rôle 'superadmin'.
 * Si l'email existe déjà, il met à jour le rôle en 'superadmin'.
 */

const bcrypt = require('bcryptjs');
const { pool } = require('./src/config/database');

// Configuration du SuperAdmin
const SUPERADMIN_CONFIG = {
    email: 'superadmin@school.com',
    password: 'SuperAdmin123!', // À changer après la première connexion
    fullName: 'Super Administrator',
    role: 'superadmin'
};

/**
 * Crée ou met à jour le SuperAdmin
 */
async function createSuperAdmin() {
    let client;

    try {
        console.log('🚀 Démarrage du script de seed SuperAdmin...\n');

        // Hasher le mot de passe
        console.log('🔐 Hachage du mot de passe...');
        const hashedPassword = await bcrypt.hash(SUPERADMIN_CONFIG.password, 10);

        // Obtenir un client de la pool
        client = await pool.connect();

        // Vérifier si l'utilisateur existe déjà
        const checkQuery = 'SELECT id, email, role FROM users WHERE email = $1';
        const checkResult = await client.query(checkQuery, [SUPERADMIN_CONFIG.email]);

        let result;

        if (checkResult.rows.length > 0) {
            // L'utilisateur existe déjà, mettre à jour le rôle
            console.log(`⚠️  L'utilisateur ${SUPERADMIN_CONFIG.email} existe déjà.`);
            console.log('📝 Mise à jour du rôle vers "superadmin"...\n');

            const updateQuery = `
        UPDATE users 
        SET role = $1, 
            full_name = $2,
            password = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE email = $4
        RETURNING id, email, full_name, role, created_at;
      `;

            result = await client.query(updateQuery, [
                SUPERADMIN_CONFIG.role,
                SUPERADMIN_CONFIG.fullName,
                hashedPassword,
                SUPERADMIN_CONFIG.email
            ]);
        } else {
            // Créer un nouvel utilisateur
            console.log('✨ Création du nouvel utilisateur SuperAdmin...\n');

            const insertQuery = `
        INSERT INTO users (email, password, full_name, role, is_active, created_at)
        VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
        RETURNING id, email, full_name, role, created_at;
      `;

            result = await client.query(insertQuery, [
                SUPERADMIN_CONFIG.email,
                hashedPassword,
                SUPERADMIN_CONFIG.fullName,
                SUPERADMIN_CONFIG.role
            ]);
        }

        // Afficher les informations de l'utilisateur créé
        const user = result.rows[0];
        console.log('✅ SuperAdmin créé/mis à jour avec succès!\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 INFORMATIONS DU SUPERADMIN:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`ID:           ${user.id}`);
        console.log(`Email:        ${user.email}`);
        console.log(`Nom complet:  ${user.full_name}`);
        console.log(`Rôle:         ${user.role}`);
        console.log(`Créé le:      ${user.created_at}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('🔑 IDENTIFIANTS DE CONNEXION:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Email:        ${SUPERADMIN_CONFIG.email}`);
        console.log(`Password:     ${SUPERADMIN_CONFIG.password}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('⚠️  IMPORTANT: Changez le mot de passe après la première connexion!\n');

    } catch (error) {
        console.error('❌ ERREUR lors de la création du SuperAdmin:');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error(`Message: ${error.message}`);

        if (error.code) {
            console.error(`Code:    ${error.code}`);
        }

        if (error.detail) {
            console.error(`Détail:  ${error.detail}`);
        }

        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Vérifier si c'est une erreur de contrainte CHECK
        if (error.message.includes('users_role_check')) {
            console.error('💡 SOLUTION:');
            console.error('   Le rôle "superadmin" n\'est pas encore dans la contrainte CHECK.');
            console.error('   Exécutez d\'abord le script de migration:');
            console.error('   psql -d school_management -U postgres -f update-schema.sql\n');
        }

        process.exit(1);
    } finally {
        // Libérer le client
        if (client) {
            client.release();
        }

        // Fermer la pool de connexions
        await pool.end();
    }
}

// Exécuter le script
createSuperAdmin();
