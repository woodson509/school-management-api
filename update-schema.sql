-- Script pour mettre à jour une base de données existante avec le rôle superadmin
-- À exécuter sur une base de données déjà créée

-- Étape 1: Supprimer l'ancienne contrainte CHECK sur le rôle
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Étape 2: Ajouter la nouvelle contrainte CHECK incluant 'superadmin'
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('admin', 'superadmin', 'teacher', 'student', 'agent'));

-- Confirmation
SELECT 'Schema updated successfully! Role constraint now includes: admin, superadmin, teacher, student, agent' AS status;
