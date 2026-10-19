# Nathalie Peña-Comas — El arte de sentir

Site artistique en 11 langues, réalisée à partir du prototype fourni. Astro 5, TypeScript, CSS et JavaScript natifs ; sortie entièrement statique pour Vercel. Aucun portrait généré, aucune adresse de contact inventée.

## Installation et prévisualisation

Node.js 22.12+ recommandé (validé avec Node 24).

```sh
npm ci
npm run dev
```

Ouvrir `http://localhost:4321/es/` ou `/en/`. La racine redirige vers l’espagnol. Les langues sont rendues au build et fonctionnent sans JavaScript.

```sh
npm run check
npm run build
npm run preview
npm test
```

Les tests utilisent Google Chrome installé sur le Mac. Sans Chrome : `npx playwright install chromium` puis `PLAYWRIGHT_CHANNEL=chromium npm test`. Pour tester une URL déployée : `TEST_BASE_URL=https://votre-domaine npm test`.

## Organisation

- `src/components/` : header, hero, musique, biographie, vidéos, plateformes, contact, footer et dialogues.
- `src/data/translations.ts` : textes des 11 langues, rendus côté serveur ; HTML limité aux textes éditoriaux internes.
- `src/data/music.ts` : métadonnées vérifiées pour les données structurées.
- `src/layouts/Base.astro` : SEO localisé, canonical, hreflang, Open Graph, MusicGroup et MusicRecording.
- `src/scripts/interactions.ts` : menu mobile, header au scroll, animations, lecteur vidéo et consentement.
- `src/styles/global.css` : direction artistique du prototype et améliorations responsive/accessibilité.
- `src/assets/` : captures vidéo et pochettes officielles, optimisées en WebP par Astro.
- `public/fonts/` : polices Italiana et Manrope servies localement (Google Fonts, licences SIL Open Font License dans ce dossier).

## Contenus vérifiés le 13 octobre 2026

- **Quinto Elemento: Tierra** : titre confirmé par les métadonnées de la [playlist fournie](https://www.youtube.com/playlist?list=OLAK5uy_mHA1R3O-jgMZLvy-NHTHpQBcDJ70HBQHk). Le projet est présenté sans nombre de pistes, durée ou autres informations non confirmées. Le lancement du 13 octobre est annoncé dans [cette publication](https://www.10noticias.com.do/cultura/el-quinto-elemento-de-nathalie-pena-comas-esta-en-su-voz/), mais la page n’affiche pas de date non confirmée par la plateforme.
- **Sombras Nada Más** : single, 4 septembre 2026, 3:51, confirmé sur [Apple Music](https://music.apple.com/us/album/sombras-nada-m%C3%A1s-single/6808254287).
- **Esclavo y Amo** : single, 19 juin 2026, 3:32, confirmé sur [Apple Music](https://music.apple.com/us/album/esclavo-y-amo/6781307613?i=6781307624). L’oEmbed Spotify confirme que le [lien fourni](https://open.spotify.com/track/4BE0KqF21ot4HCBzuWR6aA) correspond à ce titre.
- Biographie : [site officiel](https://www.nathaliepenacomas.net/bio), formation à Vienne, nomination Latin Grammy pour Alta Gracia, Musikverein, théâtre à Los Angeles, ambassadrice culturelle depuis 2019.
- Contact professionnel : [page officielle](https://www.nathaliepenacomas.net/contact). Presse : [URL officielle réelle](https://www.nathaliepenacomas.net/about-3).
- Hero et biographie : images issues des deux vidéos fournies, pas de portrait de presse présenté comme autorisé. Cartes musicales : véritables pochettes Apple Music et Spotify. Les images restent la propriété de leurs ayants droit.

## Déploiement Vercel

Le dépôt est connecté au projet Vercel `nathalie-pena-comas`, scope `olivier-steineur`.

```sh
vercel link --project nathalie-pena-comas --scope olivier-steineur
vercel --prod
```

`vercel.json` définit le build Astro, la sortie `dist`, la redirection ES et des en-têtes de sécurité. En cas de domaine personnalisé, définir `PUBLIC_SITE_URL` dans Vercel puis redéployer pour actualiser canonical, Open Graph, robots et sitemap. Aucune configuration DNS du domaine existant de l’artiste n’est modifiée.

## Mesure et confidentialité

Aucun identifiant de mesure n’est fourni ni activé par défaut. `.env.example` réserve `PUBLIC_GA_MEASUREMENT_ID` et `PUBLIC_META_PIXEL_ID`. Une fois configurés, la préférence correspondante est requise avant de charger chaque fournisseur. Aucun consentement n’est précoché. Accepter, refuser et personnaliser sont disponibles ; retrait via le footer ou les pages de confidentialité. Choix conservé 180 jours dans le navigateur ; stockage bloqué géré sans casser le site.

GA4 reçoit `music_platform_click` avec `platform`, `destination`, `language`, `section`. Meta reçoit `MusicPlatformClick` uniquement avec consentement publicitaire. Les paramètres UTM entrants restent disponibles pour la mesure de campagne des fournisseurs. Les pixels ne sont jamais utilisés comme prérequis aux liens musicaux.

YouTube ne reçoit aucune requête initiale : ouverture du dialogue, puis confirmation de lecture avant de charger `youtube-nocookie.com`. Un lien direct YouTube est disponible si l’intégration est bloquée. Escape ferme le dialogue et rétablit le focus ; fermeture supprime le lecteur. Les dialogues natifs confinent le focus clavier. Les animations respectent `prefers-reduced-motion`.

Avant d’activer de vrais identifiants publicitaires, compléter la politique avec l’identité du responsable, les contacts et les informations de conservation propres aux comptes utilisés. Les pages actuelles décrivent les fonctions livrées.

## Sécurité et limites de validation

Astro 5 est conservé conformément au brief. L’audit npm signale encore des avis concernant Astro nécessitant une migration majeure pour disparaître. La publication est statique : aucun serveur Astro, server island, View Transition ou entrée HTML non fiable ; seules des images JPEG vérifiées et locales sont optimisées au build. Les dépendances sharp/esbuild sont mises à jour par overrides. Ne pas ajouter d’optimisation distante ou de rendu serveur sans réexaminer ces avis et envisager une migration Astro.

Les tests vérifient les routes, le responsive, les images, le menu, le clavier, les embeds, le consentement et l’absence de requêtes tierces initiales. Ils simulent le document vidéo pour vérifier l’intégration ; la lecture effective dépend de YouTube et des restrictions du navigateur. Aucun score Core Web Vitals terrain n’est revendiqué : il nécessite des mesures sur le trafic réel.

## Versions internationales

Routes : `/es/`, `/en/`, `/de/` (Autriche et Allemagne), `/fr/`, `/it/`, `/sv/`, `/hu/`, `/hr/`, `/ru/`, `/zh-TW/` (chinois traditionnel) et `/ja/`. Chaque langue dispose aussi de `/privacy/`, de métadonnées traduites et de liens hreflang dans le HTML et le sitemap. Le menu conserve la section consultée, y compris sur mobile, et fonctionne sans JavaScript.

Les traductions de démonstration sont issues d’une base automatique avec révision éditoriale ; une validation par des locuteurs natifs est recommandée avant une communication officielle. Les titres des œuvres, albums, noms propres et crédits restent dans leur forme officielle. Les textes additionnels se trouvent dans `src/data/localized.json` et le registre des langues dans `src/data/locales.ts`. Le référencement de chaque marché nécessite un travail de localisation complémentaire.

## Olivia AI v2

Le widget artistique est disponible sur les 11 versions et leurs pages de confidentialité. Son interface et la langue de chaque requête suivent la route actuelle. L’historique et l’identifiant visiteur sont conservés dans `sessionStorage` entre les langues ; les messages déjà reçus gardent leur langue d’origine. Une nouvelle conversation efface l’historique local et crée un nouvel identifiant, sans prétendre supprimer les données du service.

Le widget ne contacte aucun service avant l’envoi d’un message avec la case d’accord cochée. Il obtient ensuite une identité signée pour le client `nathalie` auprès de `https://suitesmine-bot.vercel.app/api/widget/identity` et appelle `/api/olivia/chat`. Les clés restent dans le backend [suitesmine-bot](https://github.com/o7digital/suitesmine-bot), dont le profil Nathalie est lié au domaine de production. Le moteur Python doit également être déployé avec le profil et les 11 langues. Un changement de domaine exige de mettre à jour cette liaison côté serveur.

Les conversations peuvent être enregistrées dans l’inbox Olivia ; lorsqu’un opérateur prend la main, le widget suspend les réponses IA et récupère ses messages pendant que le dialogue reste ouvert. Les demandes professionnelles disposent d’un lien vers les contacts de représentation. En cas de panne ou de refus d’identité, un message localisé s’affiche et la question reste dans le champ. Aucun faux échange IA n’est affiché. Les tests `tests/olivia.spec.ts` couvrent les 11 langues, l’accord préalable, le contexte entre langues, le rendu sûr du texte et les erreurs réseau.
