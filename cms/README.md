# Admin de contenu Nathalie

Directus 12.6.1 et PostgreSQL 18 sont dans le projet Railway `nathalie-cms`, environnement **dev**. Les identifiants non sensibles et l'URL figurent dans `deployment.json`. L'environnement Railway créé par défaut et nommé `production` est vide. Les VPS existants ne sont pas utilisés.

## Accès et édition

Ouvrir https://directus-dev-9ae1.up.railway.app/admin. Le compte initial utilise l'adresse du propriétaire Railway ; son mot de passe aléatoire est conservé dans la variable Railway `ADMIN_PASSWORD` du service `directus`. Ne jamais le copier dans Git ou dans une variable `PUBLIC_*`. Changer le mot de passe dans le profil Directus après récupération ; les variables de bootstrap ne changent pas un mot de passe déjà enregistré dans la base.

Collections : photographies, vidéos YouTube, albums, concerts, images des sections et textes/traductions des 11 langues. Les vidéos utilisent un identifiant YouTube de 11 caractères ; les uploads vidéo ne sont pas encore raccordés à un service d'encodage/streaming. Les textes `copy:` correspondent aux textes des sections et `translation:` au catalogue historique. Leur clé reste stable quand on modifie leur valeur. Les titres d'œuvres et certains liens fixes restent dans les composants.

Enregistrer les changements, choisir `Publicado`, puis lancer le Flow **Actualizar vista previa** depuis une collection ou une fiche. Ce bouton déclenche exclusivement la branche Vercel `dev`. Les modifications restent privées jusqu'au build réussi. Le site de production n'est pas connecté au CMS.

Garder au moins un album publié : le premier dans l'ordre est le projet mis en avant. Les concerts publiés sont filtrés à la date du build, dans le fuseau `America/Mexico_City`, puis triés par date. La galerie accepte l'ajout, le retrait et le réordonnancement des photographies.

## Séparation des accès et disponibilité

La lecture des collections et fichiers exige une authentification. L'identité `Website build` a uniquement des permissions de lecture sur les six collections et les fichiers de ce CMS. Le palier Core n'autorise pas les filtres de permissions personnalisés : cette identité peut lire les brouillons, mais le loader serveur ne demande que les fiches `published`. Aucun jeton n'est transmis au navigateur.

Les images des fiches publiées sont transformées par Directus et copiées au build dans `public/_cms/`, dossier ignoré par Git. Elles sont ensuite servies par Vercel. Le build nettoie les anciennes copies et utilise des noms avec empreinte de contenu. Les transformations sont mises en file pour limiter la charge. Les images distantes ne passent pas par l'optimisation Astro.

Si le CMS, une image ou une fiche nécessaire est indisponible/invalide, le build échoue et le précédent déploiement reste disponible. Sans `DIRECTUS_URL`, le site utilise ses contenus locaux. Seules les variables Vercel **Preview, branche dev** sont configurées : `DIRECTUS_URL` et `DIRECTUS_READ_TOKEN`.

Le bootstrap est réexécutable : il crée les éléments manquants sans écraser les modifications éditoriales. Il répare aussi les uploads initiaux incomplets. Exécution depuis ce dépôt lié au bon projet Railway :

```sh
railway run --no-local --service directus --environment dev -- node cms/bootstrap.mjs
```

Ne pas réexécuter ce seed après avoir volontairement supprimé une fiche initiale : elle serait recréée. Préférer son archivage.

## Persistance et sauvegardes

Railway héberge un volume PostgreSQL et un volume monté sur `/directus/uploads`. Les sauvegardes natives quotidiennes et hebdomadaires sont activées pour les deux volumes. Il s'agit de sauvegardes dans Railway ; une copie externe et une restauration complète restent à organiser avant une mise en production. Les frais Railway dépendent des ressources, du stockage, des sauvegardes et du trafic consommés.

Les secrets `SECRET`, `ADMIN_TOKEN`, `ADMIN_PASSWORD`, `WEBSITE_READ_TOKEN` et `VERCEL_PREVIEW_DEPLOY_HOOK` sont conservés dans Railway. Le hook est limité à `dev` et doit être traité comme un secret. L'accès initial du propriétaire est administrateur ; un compte éditorial distinct devra être créé avec l'adresse fournie par Nathalie.

## Migration ultérieure vers VPS3

`compose.yaml` prépare une instance indépendante avec les mêmes versions majeures. Ne pas lancer une nouvelle base vide contre les médias existants.

1. Préparer Docker, un reverse proxy HTTPS, les sauvegardes et les volumes sur VPS3. Fournir les secrets par environnement, hors Git.
2. Réaliser un export logique PostgreSQL (`pg_dump`, avec le client PostgreSQL 18) et une copie complète du volume uploads. Conserver les fichiers de la base et les médias Railway jusqu'à validation.
3. Restaurer la base dans PostgreSQL 18 et les fichiers dans le volume uploads, avec les permissions du compte Directus. Préserver `SECRET`, les comptes, rôles, jetons, relations et identifiants de fichiers.
4. Tester l'admin, les données, les images et la génération d'une preview avec une URL temporaire. Si une licence Directus a été ajoutée, suivre sa procédure de changement de `PUBLIC_URL`.
5. Suspendre les éditions et les uploads, refaire l'export et la synchronisation finaux, puis modifier l'URL CMS de la seule preview `dev`. Vérifier la copie finale avant de rouvrir les éditions.
6. Garder Railway sans nouvelles écritures pendant la validation. Toute connexion au site de production exige une demande explicite distincte.

## Commits vérifiés pour les mises à jour

Le projet Vercel exige des commits vérifiés par GitHub pour les déploiements Git et les Deploy Hooks. Le dernier commit de `dev` doit donc être signé et reconnu par GitHub avant d'utiliser **Actualizar vista previa**. Un déploiement CLI réussi ne vérifie pas cette condition.

Utiliser une clé de signature déjà enregistrée ou la mutation GitHub `createCommitOnBranch`, qui signe les commits côté GitHub. Cette mutation doit cibler exclusivement `dev`, avec `expectedHeadOid` pour empêcher l'écrasement d'une modification concurrente. Conserver l'exigence Vercel de commits vérifiés.
