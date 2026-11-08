# Nathalie Studio

Interface éditoriale dédiée, hébergée dans le service Railway `studio`, environnement `dev` du projet `nathalie-cms`. Directus conserve les contenus et médias. URL : https://studio-dev-4236.up.railway.app. La production du site n'est pas raccordée.

## Utilisation

Utiliser les identifiants Directus existants pour le mode « Studio ». Les pages photographies, vidéos YouTube, agenda, discographie, textes et images des sections lisent les contenus réels. Les modifications sont enregistrées dans Directus. Les nouveaux éléments sont des brouillons par défaut. L'archivage remplace la suppression définitive.

Les photos JPG, PNG, WebP et AVIF sont acceptées jusqu'à 25 Mo par fichier. Les vidéos sont pour l'instant des liens YouTube, avec miniature éditable. Aucun service d'encodage ou d'upload vidéo long n'est inclus.

Après les modifications, choisir « Actualizar vista previa » : le hook lance exclusivement la branche Vercel `dev`. Le message confirme la demande, pas la réussite du build. Attendre la fin du déploiement avant de vérifier le site. Garder `dev` sur un commit vérifié GitHub pour permettre ce déploiement.

## Accès ARM

Le connecteur parle aux API réelles de https://api.crm.o7digitalgroup.com/api : contacts (`clients`), propositions (`deals`), tâches et pipelines. Les formulaires proposent la création de contacts, propositions et tâches ; les listes reprennent les données du CRM. Les propositions changent d’étape et les tâches de statut directement depuis le Studio. La gestion complète reste accessible dans O7 Pulse. Aucun compte ni abonnement CRM n'est créé par le déploiement Studio.

L'espace Nathalie est activé. Les identifiants non sensibles de la souscription et du tenant sont dans `../deployment.json`. Le compte Directus désigné par `ARM_ADMIN_EMAIL` dispose d'un accès ARM délégué depuis le mode « Studio », avec son e-mail et son mot de passe Directus habituels. Son compte CRM personnel et ses autres espaces restent inchangés.

La souscription utilise l'offre existante `PULSE_TEAM`, avec 12 mois inclus à partir de sa création. Elle appartient à l'espace CRM existant de l'administrateur provisoire ; aucun compte personnel n'a été déplacé. `currentPeriodEnd` enregistre l'échéance et `STUDIO_INCLUDED_UNTIL` l'affiche dans le Studio. Le renouvellement reste manuel et à configurer : aucun checkout, mandat Stripe, invitation e-mail ni suspension automatique à l'échéance n'a été créé. Aucun quota de contacts, propositions ou contenus n'est ajouté. Le CRM actuel impose encore un plafond technique de **30 utilisateurs par souscription**, distinct des limites techniques d'upload photo.

Le contact client est conservé dans la souscription et dans `STUDIO_CUSTOMER_EMAIL`. Son compte humain sera créé lorsque le propriétaire décidera de lui donner accès. Pour connecter ultérieurement ce compte directement, utiliser le mode « ARM » ou le formulaire de connexion de l'espace ARM. Le tenant doit correspondre exactement à `ARM_TENANT_ID`.

Le connecteur d'administration utilise une identité technique `ADMIN` appartenant uniquement au tenant Nathalie. Ses identifiants sont dans `ARM_SERVICE_EMAIL` et `ARM_SERVICE_PASSWORD`, uniquement côté serveur. La délégation est réservée à l'e-mail administrateur explicitement configuré ; le backend revérifie l'identité Directus actuelle puis `/auth/me` côté CRM pour chaque requête ARM. Les jetons sont mis en cache côté serveur cinq minutes et l'appartenance au tenant reste vérifiée à chaque accès. Un autre éditeur CMS ne reçoit pas cet accès.

Le pipeline « Agenda artística » comporte cinq étapes : nouvelle proposition, conversation, proposition envoyée, confirmée et non concrétisée. Les données de contacts, propositions et tâches sont celles du CRM réel.

## Configuration et sécurité

Variables serveur : `DIRECTUS_URL`, `STUDIO_SESSION_SECRET` (minimum 32 caractères aléatoires), `STUDIO_ORIGIN`, `STUDIO_CONTENT_TOKEN`, `VERCEL_PREVIEW_DEPLOY_HOOK`, `STUDIO_PREVIEW_URL`, `ARM_API_URL`, `ARM_TENANT_ID`, `ARM_SUBSCRIPTION_ID`, `ARM_ADMIN_EMAIL`, `ARM_SERVICE_EMAIL`, `ARM_SERVICE_PASSWORD`, `STUDIO_INCLUDED_UNTIL` et `STUDIO_CUSTOMER_EMAIL`. Aucun secret ne doit être ajouté à Git ni aux variables publiques du site.

Les sessions sont chiffrées et authentifiées dans un cookie HttpOnly, Secure en déploiement, SameSite Strict. Les jetons Directus/Pulse restent côté serveur. Les écritures exigent l'origine configurée ; seuls les chemins et champs autorisés sont transmis. Les médias nécessitent une session et sont servis avec un cache privé. Le Studio ne sert aucun fichier serveur ni accès arbitraire aux API d'administration.

En mode Studio, Directus applique les permissions du compte connecté. En mode ARM, le connecteur utilise une identité Directus technique avec lecture/création/modification sur les six collections et lecture/création sur les fichiers ; aucun accès au panneau Directus, ni aux comptes, ni à la suppression. Le tenant ARM est lié à ce CMS Nathalie unique. Pour un autre client, créer un déploiement et des identités séparés.

`provision.mjs` configure uniquement les permissions techniques Directus et les variables du service Railway existant, sans créer d'utilisateur humain CRM. Exécuter avec les variables du Directus Nathalie dev :

```sh
railway run --no-local --service directus --environment dev -- node cms/studio/provision.mjs
```

`provision-arm.cjs` a provisionné le tenant via les services métier déjà déployés du CRM, puis attribué cette seule souscription à l'espace de l'administrateur désigné et enregistré sa période incluse. Il ne modifie pas le code du CRM central. Ce script doit s'exécuter dans le conteneur API CRM avec une configuration client explicite. **Sa sortie contient les identifiants techniques : la capturer dans un processus privé et l'envoyer aux variables Railway par stdin, sans l'afficher ni la sauvegarder dans Git.** Une réexécution retrouve la même souscription et conserve son échéance, mais renouvelle le mot de passe du seul connecteur ; mettre à jour Railway et redéployer immédiatement. Ne pas réexécuter pour prolonger un abonnement.

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
railway run --no-local --service directus --environment dev -- node cms/studio/arm-live-check.mjs
railway run --no-local --service directus --environment dev -- node cms/studio/browser-check.mjs
```

Le dernier test attend un Studio local sur le port 4380 ; définir `STUDIO_TEST_URL` pour viser le service déployé. Il vérifie une connexion réelle, les images privées, la création/modification d'un brouillon d'agenda, l'état du connecteur ARM, le mobile et la déconnexion. Son brouillon de test est supprimé en fin de parcours avec le compte administrateur. Les tests unitaires isolent les services et vérifient les frontières de permissions et de tenant.

`arm-browser-check.mjs` utilise uniquement des données de test isolées pour vérifier les formulaires, les étapes des propositions et les statuts des tâches. Il ne se connecte à aucun compte CRM réel.

`arm-live-check.mjs` vérifie la délégation de l’administrateur et crée un contact, une proposition et une tâche temporaires dans le seul tenant Nathalie. Il vérifie leurs mises à jour puis les supprime via les API CRM. Il lit les identifiants techniques depuis Railway sans les afficher. Il refuse toute autre configuration de projet/API/tenant.
