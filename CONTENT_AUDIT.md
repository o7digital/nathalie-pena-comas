# Répartition éditoriale — 18 octobre 2026

Périmètre : tous les contenus suivis par Git sur `dev`, composants, traductions ES/EN, médias locaux, données musicales et références documentées dans le README. Vérification complémentaire des références déjà documentées et de la catégorie officielle de nomination d'Alta Gracia. Aucun nouveau titre musical ajouté. `main2` sauvegarde exactement `origin/main` à `2d8932e`, avant cette répartition. Les changements sont sur `dev` et en preview uniquement.

| Élément existant | Destination | Justification et traitement |
| --- | --- | --- |
| Sombras Nada Más — titre, date, durée, Apple Music | Populaire | Présenté dans les textes existants comme une interprétation du répertoire latino ; pas un air d'opéra ou un récital. Toutes ses métadonnées conservées. |
| Sombras Nada Más — vidéo `HbRmwVkSP8Q` | Populaire | Vidéo officielle du même titre. Retirée du hero classique et de ses liens. |
| `sombras-cover.jpg` | Populaire | Pochette du single, conservée dans sa carte musicale. |
| `sombras-video.jpg` | Populaire | Capture de cette vidéo : conservée dans la section vidéos, retirée du hero classique. Le portrait est conservé sur le panneau d’entrée à la demande du propriétaire, selon la capture de référence ; cet usage éditorial ne classe pas la vidéo comme classique. |
| Esclavo y Amo — titre, date, durée, Spotify / Apple Music | Populaire | Même contexte de répertoire latino dans la présentation existante ; métadonnées et liens conservés. |
| Esclavo y Amo — vidéo `otT5_7vJYv4` | Populaire | Captation officielle du single ; lecteur conservé avec confirmation de lecture. |
| `esclavo-cover.jpg` | Populaire | Pochette du single, conservée dans sa carte. |
| `esclavo-video.jpg` | Populaire | Capture du single, utilisée uniquement dans le parcours populaire (entrée, hero, biographie illustrée, vidéo). La biographie classique utilise un motif typographique sans photographie de ce répertoire. |
| Quinto Elemento: Tierra — projet et playlist | Populaire | La source 10Noticias déjà référencée dans le README décrit explicitement ce projet comme une exploration du répertoire populaire, avec Esclavo y Amo (boléro) et Sombras Nada Más (bachata). Projet conservé intégralement. Aucun classement piste par piste : la liste des morceaux n'est pas présente dans le dépôt. |
| Alta Gracia | Classique | Titre déjà cité dans la biographie. La Latin Recording Academy confirme la catégorie précise « Mejor Álbum de Música Clásica » (2017). Carte éditoriale bilingue dédiée au classique avec lien vers cette preuve officielle ; aucune pochette, piste ou URL de streaming supposée. La mention biographique reste commune. |
| Formation à Vienne, origine dominicaine, carrière de soprano | Commun ; contexte du parcours classique | Informations biographiques existantes. Présentation classique sans inventer d'opéras, d'airs ni de programmes. |
| Musikverein de Vienne | Commun | Mention de carrière, sans date ni programme de concert. Pas de création d'un événement ou d'affectation arbitraire à un répertoire. |
| Début théâtral au Los Angeles Theater Center | Commun | Théâtre / biographie : pas une chanson populaire par défaut. |
| Ambassadrice culturelle depuis 2019 | Commun | Information professionnelle générale. |
| Citation, distinctions, lieux de carrière, lien biographie | Commun | Même texte et mêmes traductions sur les deux parcours. Aucune catégorie musicale ajoutée aux distinctions. |
| Spotify (lien vers Esclavo y Amo), YouTube Music (playlist Tierra) | Populaire | Liens vers des contenus identifiés ; plus de liens musicaux populaires dans le parcours classique. |
| Profil Apple Music de l'artiste, site officiel | Commun | Profils généraux ; ne constituent pas une sélection d'enregistrements classiques. |
| Contact, représentation, booking | Commun | Informations générales conservées. |
| Presse officielle `/about-3` | Commun, lien général uniquement | Aucun article individuel ni sujet daté n'est stocké dans le projet. Le lien ne devient pas une liste d'articles classés. |
| Agenda / concerts | Aucun événement individuel disponible | Le dépôt ne contient pas d'agenda, de dates, de lieux et programmes à répartir. La mention historique du Musikverein reste biographique. |
| `public/social.jpg` | Populaire | Visuel social préexistant titré Sombras Nada Más dans les métadonnées. Conservé pour le populaire ; métadonnées classiques et de l'entrée avec nouveau visuel typographique neutre (source SVG, export PNG pour le partage social). |
| Polices, palette, favicon, navigation, confidentialité | Commun | Identité unique et mécanismes partagés. |

## Points à faire valider

- Alta Gracia : classement classique confirmé. La liste des pistes, les droits de pochette et une URL officielle de lecture ne sont pas présents ; aucun lecteur ajouté.
- Contenu détaillé de Quinto Elemento: Tierra : le projet est classé selon sa description existante ; ses pistes ne sont pas présumées toutes populaires et restent à examiner si elles sont fournies.
- En dehors de la référence à l’album Alta Gracia, aucun programme, air classique, récital lyrique, vidéo ni photo de scène classique identifiable dans le dépôt. Le parcours classique présente donc la carrière documentée, avec un hero et des motifs typographiques sobres, avec une carte Alta Gracia documentée, sans fausse discographie ni vidéos populaires.
- Aucun article de presse ni concert individuel disponible à répartir. Fournir titre, programme et lien pour une sélection pertinente par univers.

## Conservation et navigation

Tous les fichiers médias, titres, liens et traductions existants restent dans le dépôt et les contenus musicaux sont accessibles dans le parcours populaire. Les textes généraux sont conservés dans les deux biographies. Les clés des traductions antérieures restent présentes ; les nouveaux textes classiques sont traduits en ES/EN dans `src/data/classification.ts`.

Les anciens liens partagés `/{lang}/#music`, `#videos`, `#listen` et `#hero-title` rejoignent le populaire ; `#story` et `#contact` rejoignent le classique, où ces contenus communs existent toujours. `/{lang}/classical/#videos` rejoint également les vidéos populaires. Redirection côté navigateur, car les fragments ne sont pas transmis au serveur. Les URL des pages ne changent pas ; les liens directs fonctionnent sans JavaScript.

Les données structurées ne publient plus les deux singles sur la page classique ni sur l'écran d'entrée. Les liens du menu et du footer correspondent aux sections de chaque univers.

## Sources de vérification

- [Latin Recording Academy — Nathalie Peña Comas](https://www.latingrammy.com/es/artists/nathalie-pena-comas-32921/) : nomination 2017, catégorie Meilleur album de musique classique, Alta Gracia.
- [10Noticias — El quinto elemento de Nathalie Peña-Comas está en su voz](https://www.10noticias.com.do/cultura/el-quinto-elemento-de-nathalie-pena-comas-esta-en-su-voz/) : référence déjà présente dans le README ; décrit explicitement le projet populaire et les deux singles. Ne pas importer les autres albums mentionnés par cet article, absents du contenu initial du site.
