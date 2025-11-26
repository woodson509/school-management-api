# Checklist de Vérification EDIKA

Utilisez cette liste pour valider l'intégration complète des nouvelles fonctionnalités Agents et Dashboard.

## SECTION 1 - Backend ✅

- [ ] **extended-schema.sql exécuté sur Supabase**
  *   *Vérification :* Vérifiez dans l'éditeur SQL de Supabase que les tables/colonnes nécessaires existent (ex: `agents`, `sales`).
- [ ] **agentController.js mis à jour avec toutes les méthodes**
  *   *Vérification :* Le fichier doit contenir `getAgents`, `createAgent`, `updateAgent`, `deleteAgent`, `getAgentStats`.
- [ ] **dashboardController.js créé avec les 4 méthodes**
  *   *Vérification :* Le fichier doit exister dans `src/controllers/` et contenir `getSuperAdminDashboard`, `getAdminDashboard`, etc.
- [ ] **routes/index.js mis à jour avec les nouvelles routes**
  *   *Vérification :* Vérifiez la présence des blocs `// AGENT ROUTES` et `// DASHBOARD ROUTES`.
- [ ] **Server redémarre sans erreur (npm run dev)**
  *   *Vérification :* Regardez le terminal backend, il doit afficher "Server running on port X".
- [ ] **Endpoint /api/agents fonctionne**
  *   *Vérification :* Utilisez `curl` ou Postman avec un token SuperAdmin pour faire un GET.
- [ ] **Endpoint /api/dashboard/superadmin fonctionne**
  *   *Vérification :* Utilisez `curl` ou Postman avec un token SuperAdmin pour faire un GET.

## SECTION 2 - Frontend ✅

- [ ] **services/api.js mis à jour (agentAPI + dashboardAPI)**
  *   *Vérification :* Vérifiez que `agentAPI` a `getAll`, `create`, etc. et que `dashboardAPI` est exporté.
- [ ] **AgentsPage.jsx remplacé et connecté à l'API**
  *   *Vérification :* Le code doit utiliser `fetch` et `useEffect` au lieu du tableau `sampleAgents` hardcodé.
- [ ] **SuperAdmin DashboardPage.jsx mis à jour**
  *   *Vérification :* Le code doit faire un fetch vers `/api/dashboard/superadmin`.
- [ ] **App compile sans erreur (npm run dev)**
  *   *Vérification :* Regardez le terminal frontend, pas d'erreurs rouges.
- [ ] **Aucune erreur dans la console browser**
  *   *Vérification :* Ouvrez les DevTools (F12) > Console et naviguez sur les pages.
- [ ] **Les données s'affichent correctement**
  *   *Vérification :* Les tableaux ne doivent pas être vides (sauf si la BDD est vide) et les stats doivent être cohérentes.

## SECTION 3 - Tests Fonctionnels ✅

- [ ] **Login avec superadmin@school.com fonctionne**
  *   *Vérification :* Connectez-vous et vérifiez la redirection vers le dashboard.
- [ ] **Page Agents charge les données réelles**
  *   *Vérification :* Vérifiez que les noms affichés correspondent à votre base de données.
- [ ] **Création d'un agent fonctionne**
  *   *Vérification :* Cliquez sur "Nouvel agent", remplissez le formulaire, validez. L'agent doit apparaître dans la liste.
- [ ] **Édition d'un agent fonctionne**
  *   *Vérification :* Modifiez le taux de commission d'un agent, sauvegardez. La valeur doit changer dans le tableau.
- [ ] **Suppression d'un agent fonctionne**
  *   *Vérification :* Supprimez un agent test. Il doit disparaître de la liste (et passer en `is_active: false` en BDD).
- [ ] **Dashboard affiche les vraies stats**
  *   *Vérification :* Comparez le nombre d'agents affiché sur le dashboard avec le nombre réel.
- [ ] **Après rafraîchissement, les données persistent**
  *   *Vérification :* Rechargez la page (F5), vous devez rester connecté et voir les mêmes données.

## SECTION 4 - Déploiement ✅

- [ ] **Backend pusher sur GitHub**
  *   *Action :* `git add .`, `git commit -m "feat: agents and dashboard"`, `git push origin main`.
- [ ] **Backend redéployé sur Render**
  *   *Vérification :* Allez sur le dashboard Render, vérifiez que le dernier commit est "Deployed".
- [ ] **Frontend pusher sur GitHub**
  *   *Action :* `git add .`, `git commit -m "feat: agents and dashboard pages"`, `git push origin main`.
- [ ] **Frontend redéployé sur Vercel**
  *   *Vérification :* Allez sur le dashboard Vercel, vérifiez que le déploiement est "Ready".
- [ ] **Variables d'environnement vérifiées**
  *   *Vérification :* Assurez-vous que `VITE_API_BASE_URL` (Vercel) et `DATABASE_URL` (Render) sont corrects.
- [ ] **Tests en production réussis**
  *   *Vérification :* Connectez-vous sur l'URL de production (`https://votre-app.vercel.app`) et refaites les tests de la Section 3.
