# Source complète et répartition — 18 octobre 2026

La première version de `dev` avait été construite à partir de `main` (`2d8932e`), une ancienne landing musicale. Ce n'était pas la version complète montrée par le propriétaire. L'absence de contenus constatée précédemment concernait cette ancienne branche uniquement.

La version complète est présente dans `feat/premium-homepage-v2` (`4f329a8`). Ses composants, photos, textes, données, traductions et comportements ont été repris dans `dev`, sans modifier cette branche source, `main`, `main2` ou la production.

## Structure commune et parcours internes

Les deux parcours ont le menu complet : Inicio, La artista, Agenda, Noticias, Prensa, Videos, Spirituosi, Galería, Contacto. Chaque rubrique rejoint une section réelle de la page du parcours courant. La langue et la section sont conservées lors du changement de langue. Les 11 langues de la version complète ont été reprises, avec une entrée et deux URL de parcours pour chacune.

Les liens « sitio oficial », les renvois de biographie/contact vers `nathaliepenacomas.net` et la référence à ce domaine dans les métadonnées ont été supprimés du site rendu. Les biographies, photos, vidéos, contacts professionnels, presse et agenda sont consultables directement dans le site. Les liens vers les plateformes musicales et les cinq réseaux sociaux existants sont conservés.

## Inventaire des contenus récupérés

| Élément | Parcours et traitement |
| --- | --- |
| Hero et portrait professionnel `official/hero.jpg` | Classique : hero de la version complète, conservé avec ses textes et découverte interne. |
| Sombras Nada Más, single, pochette, vidéo `HbRmwVkSP8Q` | Populaire : titre, durée, liens Apple Music/YouTube, carte musicale et vidéo conservés. Portrait du panneau d'entrée conservé selon la capture demandée ; cet usage de portrait ne change pas la catégorie du morceau. |
| Esclavo y Amo, single, pochette, vidéo `otT5_7vJYv4` | Populaire : titre, durée, liens Spotify/Apple Music/YouTube, carte musicale et vidéo conservés. Portrait utilisé sur le hero populaire. |
| Quinto Elemento: Tierra, pochette et lien de lecture | Populaire : projet, carte album, actualité de présentation du 13 octobre 2026 et lien orcd existant. |
| Alta Gracia, pochette et lien Spotify | Classique : enregistrement de l'orchestre Bratislava Festival Orchestra / Pablo Boggiano, sélection et lien récupérés. Mention de nomination conservée dans la biographie générale. |
| Una Mujer, pochette et lien Apple Music | Populaire : album et lien existants récupérés. Aucun ajout de pistes ou de collaborateurs non documentés. |
| Souvenir Latino, pochette et lien Apple Music | Projet partagé de musique de chambre et de traditions latino-américaines. Conservé dans les deux sélections et dans Spirituosi ; ne pas le réduire aux chansons populaires au seul motif de son titre latino. Classement fin des pistes à valider. |
| Song to the Moon — Rusalka, Dvořák, MuTh Vienna (`pG7lJPLcO-g`) | Classique, image et lecteur conservés. |
| O soave fanciulla — La Bohème, Puccini, Ramón Vargas (`NrGZajhOGAc`) | Classique, image et lecteur conservés. |
| Addio del passato — La Traviata, Verdi, Santo Domingo (`U1QDrRtdnAI`) | Classique, image et lecteur conservés. |
| In trutina — Carmina Burana, Orff, Târgu Mureș (`Ept9wg2IlDo`) | Classique, même si ce n'est pas un air d'opéra. Image et lecteur conservés. |
| Biographie, formation, rôles, théâtre, ambassade culturelle | Commun : biographie complète récupérée, avec son portrait `editorial.jpg`. Le répertoire Mozart/Verdi/Puccini est présenté comme une sélection du parcours général de l'artiste. |
| Distinctions, lieux et collaborations (`International`) | Commun, textes et traductions existants conservés. |
| 24 octobre 2026, Inaugural Concert, Centro Cultural Rainieri | Agenda commun, sans catégorie musicale : le titre ne donne pas le programme. À valider ; ne pas le classer populaire parce que le mot opéra est absent. |
| 28 octobre 2026, Brahms : Ein deutsches Requiem, Györ | Agenda classique. |
| 4 novembre 2026, Mahler : Symphonie n° 2, Santo Domingo | Agenda classique. |
| 15 novembre 2026, Brahms : Ein deutsches Requiem, Vienne | Agenda classique. |
| Actualité Donna Anna / Don Giovanni, 22 avril 2024 | Classique ; texte et lien interne vers les interprétations conservés. |
| Actualité documentaire Larimar Films, 6 décembre 2024 | Commun : projet cinématographique et culturel ; aucune catégorie musicale supposée. |
| Presse Oh! Magazine, En Sociedad, Corriere Romagna | Archive générale commune, image `press-oh.jpeg`, texte existant et contact presse interne. Pas d'articles complets inventés. |
| Ensemble Spirituosi et photo du sextet | Commun : projet explicitement présenté comme reliant musique classique et traditions latino-américaines ; membres, album et distinction conservés. |
| Galerie La Traviata / IMAGO Sloveniae / Musikverein | Archive photographique de la carrière commune, légendes originales et crédits conservés ; aucune légende transformée pour présenter ces scènes comme populaires. Carrousel et visionneuse repris. |
| `artist.jpg`, `closing.jpg`, `portrait.jpg`, `recital.jpg`, `musikverein.jpg`, autres visuels et logo NPC | Tous les médias de la source complète récupérés localement ; métadonnées et provenance dans `docs/official-media.json`. Aucune photo inventée. |
| Contact et représentation | Commun, directement dans chaque parcours : Künstlersekretariat Buchmann (`office@buchmann.at`), Opera Connection (`info@opera-connection.com`). |
| Cinq liens sociaux, confidentialité, Olivia AI v2, newsletter de démonstration | Fonctionnalités existantes reprises, avec leurs traductions. Aucune inscription newsletter fictive ni démarrage automatique de musique. |

## À valider

- Programme exact du concert inaugural du 24 octobre : laissé partagé, sans genre attribué.
- Répertoire piste par piste de Souvenir Latino : album partagé, musique de chambre/croisement de traditions, pas une affectation populaire automatique.
- Pertinence d'une sélection plus restrictive de l'archive photographique commune dans le parcours populaire. Les légendes de scène restent exactes et tous les médias sont conservés.

## Livraison

Travail sur `dev` uniquement. Déploiement Vercel en preview uniquement. `main` et `main2` restent au commit `2d8932e`, sans publication ni promotion en production.
