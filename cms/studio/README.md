# Nathalie Studio

Interface éditoriale dédiée, hébergée dans le service Railway `studio`, environnement `dev` du projet `nathalie-cms`. Directus conserve les contenus et médias. URL : https://studio-dev-4236.up.railway.app. La production du site n'est pas raccordée.

## Utilisation

Utiliser les identifiants Directus existants pour le mode « Studio ». Les pages photographies, vidéos YouTube, agenda, discographie, textes et images des sections lisent les contenus réels. Les modifications sont enregistrées dans Directus. Les nouveaux éléments sont des brouillons par défaut. L'archivage remplace la suppression définitive.

Les photos JPG, PNG, WebP et AVIF sont acceptées jusqu'à 25 Mo par fichier. Les vidéos sont pour l'instant des liens YouTube, avec miniature éditable. Aucun service d'encodage ou d'upload vidéo long n'est inclus.

Après les modifications, choisir « Actualizar vista previa » : le hook lance exclusivement la branche Vercel `dev`. Le message confirme la demande, pas la réussite du build. Attendre la fin du déploiement avant de vérifier le site. Garder `dev` sur un commit vérifié GitHub pour permettre ce déploiement.

## Accès ARM

Le connecteur parle aux API réelles de https://api.crm.o7digitalgroup.com/api : contacts (`clients`), propositions (`deals`), tâches et pipelines. Les formulaires proposent la création de contacts, propositions et tâches ; les listes reprennent les données du CRM. Les propositions changent d’étape et les tâches de statut directement depuis le Studio. La gestion complète reste accessible dans O7 Pulse. Aucun compte ni abonnement CRM n'est créé par le déploiement Studio.

Pour activer Nathalie :

1. Créer ou retrouver son tenant via le parcours administrateur O7 Pulse. Confirmer l'e-mail du client et le plan choisi. La création de souscription, l'invitation et le paiement sont des actions distinctes.
2. Configurer dans le service `studio` la variable `ARM_TENANT_ID` avec l'identifiant exact de ce tenant, puis redéployer ce service.
3. Vérifier la connexion avec un compte de ce tenant. Un compte d'un autre tenant est refusé. Le mode ARM de l'écran de connexion permet alors d'utiliser les identifiants Pulse pour les contenus et la gestion artistique.

Le backend revérifie `/auth/me` et l'appartenance au tenant à chaque requête ARM, et à chaque requête de contenu provenant d'une session ARM. Il n'existe pas de création automatique ni de facturation implicite. L'essai de 30 jours/1 utilisateur doit être explicitement choisi par le propriétaire avant provisionnement.

## Configuration et sécurité

Variables serveur : `DIRECTUS_URL`, `STUDIO_SESSION_SECRET` (minimum 32 caractères aléatoires), `STUDIO_ORIGIN`, `STUDIO_CONTENT_TOKEN`, `VERCEL_PREVIEW_DEPLOY_HOOK`, `STUDIO_PREVIEW_URL`, `ARM_API_URL`, et éventuellement `ARM_TENANT_ID`. Aucun secret ne doit être ajouté à Git ni aux variables publiques du site.

Les sessions sont chiffrées et authentifiées dans un cookie HttpOnly, Secure en déploiement, SameSite Strict. Les jetons Directus/Pulse restent côté serveur. Les écritures exigent l'origine configurée ; seuls les chemins et champs autorisés sont transmis. Les médias nécessitent une session et sont servis avec un cache privé. Le Studio ne sert aucun fichier serveur ni accès arbitraire aux API d'administration.

En mode Studio, Directus applique les permissions du compte connecté. En mode ARM, le connecteur utilise une identité Directus technique avec lecture/création/modification sur les six collections et lecture/création sur les fichiers ; aucun accès au panneau Directus, ni aux comptes, ni à la suppression. Le tenant ARM est lié à ce CMS Nathalie unique. Pour un autre client, créer un déploiement et des identités séparés.

`provision.mjs` configure uniquement les permissions techniques Directus et les variables du service Railway existant, sans créer d'utilisateur humain CRM. Exécuter avec les variables du Directus Nathalie dev :

```sh
railway run --no-local --service directus --environment dev -- node cms/studio/provision.mjs
```

Le service utilise `cms/studio/Dockerfile` avec le dépôt comme contexte. Le démarrage ne nécessite aucune installation de dépendances Node. Déploiement :

```sh
railway up --service studio --environment dev --detach
```

Les sessions sont sans stockage local. Tous les contenus restent dans les volumes Directus/PostgreSQL déjà sauvegardés. Préserver `STUDIO_SESSION_SECRET` entre déploiements ; une rotation déconnecte les sessions existantes.

## Vérification

```sh
npm --prefix cms/studio run check
npm --prefix cms/studio test
node cms/studio/arm-browser-check.mjs
railway run --no-local --service directus --environment dev -- node cms/studio/browser-check.mjs
```

Le dernier test attend un Studio local sur le port 4380 ; définir `STUDIO_TEST_URL` pour viser le service déployé. Il vérifie une connexion réelle, les images privées, la création/modification d'un brouillon d'agenda, l'état du connecteur ARM, le mobile et la déconnexion. Son brouillon de test est supprimé en fin de parcours avec le compte administrateur. Les tests unitaires isolent les services et vérifient les frontières de permissions et de tenant.

`arm-browser-check.mjs` utilise uniquement des données de test isolées pour vérifier les formulaires, les étapes des propositions et les statuts des tâches. Il ne se connecte à aucun compte CRM réel.
