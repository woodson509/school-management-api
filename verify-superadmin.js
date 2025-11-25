/**
 * Script rapide pour vérifier le superadmin
 */

const { pool } = require('./src/config/database');

async function verifySuperAdmin() {
    try {
        const result = await pool.query(
            'SELECT id, email, full_name, role, is_active, created_at FROM users WHERE role = $1',
            ['superadmin']
        );

        if (result.rows.length === 0) {
            console.log('❌ Aucun superadmin trouvé');
        } else {
            console.log('✅ SuperAdmin(s) trouvé(s):\n');
            result.rows.forEach(user => {
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log(`ID:          ${user.id}`);
                console.log(`Email:       ${user.email}`);
                console.log(`Nom:         ${user.full_name}`);
                console.log(`Rôle:        ${user.role}`);
                console.log(`Actif:       ${user.is_active ? 'Oui' : 'Non'}`);
                console.log(`Créé le:     ${user.created_at}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            });
        }
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    } finally {
        await pool.end();
    }
}

verifySuperAdmin();
