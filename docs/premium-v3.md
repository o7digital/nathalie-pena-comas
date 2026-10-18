# Official identity correction — V3

The homepage now follows the official artist site's architecture: Home, About, Schedule, News, Press, Media, Spirituosi, Gallery, Contact. Secondary navigation links use the existing Wix pages, not unimplemented Astro routes. Spanish and English homepage content remain available.

## Identity and composition

- Genuine `Logo NPC.png` downloaded from the official footer; original retained in `src/assets/official/logo-npc.png`.
- `public/logo-npc.png` removes only surrounding transparent/white padding using Sharp trim. Letterforms, spacing and proportions are untouched. CSS multiply adapts it to ivory; invert/screen creates a monochrome version for the dark footer.
- Official blue-dress portrait from Press replaces the previous hero treatment; split editorial composition, restrained ivory/black typography, no invented monogram.
- Classical performances precede contemporary music videos. Biography includes opera/oratorio/art-song repertoire, alongside verified career distinctions.
- Agenda, separate press/news material, Ensemble Spirituosi, credited photography and newsletter invitation restore the breadth of the original site.
- Newsletter uses the real mailing-list area of the official website (`/#SITE_FOOTER`). No local form or unconnected submission endpoint is presented.

## Verified sources — 14 October 2026

- https://www.nathaliepenacomas.net/ — official logo and mailing-list footer.
- https://www.nathaliepenacomas.net/bio — career, education, repertoire, awards and collaborations. Same verified facts as V2; expanded repertoire includes Donna Anna, Pamina, Contessa, Violetta, Verdi Requiem and Musetta.
- https://www.nathaliepenacomas.net/schedule — upcoming dates copied for 24 October (Inaugural Concert, Centro Cultural Rainieri, Punta Cana), 28 October (Brahms, Basilica of Györ), 4 November (Mahler Symphony Nr. 2, Teatro Nacional Eduardo Brito), 15 November (Brahms, Minoritenkirche, Vienna), all 2026. Past 13 October album presentation omitted from Upcoming. Dates filter against Mexico City calendar date at build time; this static demo requires a rebuild to refresh the filter. All event links point to the complete official schedule; ticket availability is not invented.
- https://www.nathaliepenacomas.net/recordings — four classical video references plus two official music films. YouTube oEmbed confirmed La Traviata `U1QDrRtdnAI` and Carmina Burana `Ept9wg2IlDo`, both from Nathalie's channel. Actual playback remains subject to YouTube embed restrictions.
- https://www.nathaliepenacomas.net/latest — archival articles dated 6 December 2024 (Larimar Films documentary) and 22 April 2024 (Donna Anna debut announcement). Clearly presented as archives, not current news. Original dates retained.
- https://www.nathaliepenacomas.net/about-3 — official blue-dress portrait and Oh! Magazine cover. The cover is presented as an archival press artifact, without claiming a publication date.
- https://www.nathaliepenacomas.net/projects — official ensemble image, members, instrumentation and Souvenir Latino's three 2018 Global Music Awards gold medals.
- https://www.nathaliepenacomas.net/gallery — La Traviata, Musikverein © David Moser and recital photo credited to Mankica Kranjec in the original filename.

## Rights still to confirm

See `official-media.json` for original media URLs. The existing V2 pending rights remain applicable. Also confirm reuse of the NPC logo, blue-dress portrait (photographer not identified), Spirituosi ensemble photograph (credit not identified), Oh! Magazine cover, La Traviata gallery photograph and YouTube thumbnails. Preserve David Moser and Mankica Kranjec credits. Originals remain in the repository; optimized WebP derivatives and a social-sharing JPEG are generated from these authentic assets. No AI portraits.

## Validation

`npm run build` and `npm run check` pass without diagnostics. Twelve Playwright tests pass, covering ES/EN at 390/768/1440 px, all images, overflow, mobile navigation, video consent and focus, language switching without JavaScript, privacy preferences, reduced motion, nine official navigation destinations, both NPC logos, upcoming dates, repertoire, gallery, newsletter destination and all four classical video dialogs. Desktop/mobile/menu screenshots reviewed. All nine official navigation pages returned HTTP 200.
