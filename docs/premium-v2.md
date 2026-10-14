# Premium homepage V2

Verified 14 October 2026 against the artist’s official website. Homepage demonstration only; existing Astro ES/EN routes, privacy controls and consent-based video playback retained. No CMS, DNS, Wix changes or Lighthouse audit.

## Sources

- https://www.nathaliepenacomas.net/ — official album smartlink https://orcd.co/quintoelemento. The album presentation dated 13 October 2026 is now past; no invented release date or upcoming event displayed.
- https://www.nathaliepenacomas.net/bio — Dominican origin, Vienna training, cultural ambassadorship since 2019, Latin Grammy nomination, Ebe Stignani first prize 2022, venues, collaborators and repertoire.
- https://www.nathaliepenacomas.net/recordings — album covers and listening destinations; Song to the Moon (pG7lJPLcO-g, MuTh Vienna) and O soave fanciulla with Ramón Vargas (NrGZajhOGAc). Opera video availability and ownership confirmed through YouTube oEmbed. Existing official videos: Sombras Nada Más (HbRmwVkSP8Q) and Esclavo y Amo (otT5_7vJYv4).
- https://www.nathaliepenacomas.net/gallery — Musikverein performance photo © David Moser. Other downloaded gallery images were considered but not used.
- https://www.nathaliepenacomas.net/contact — Künstlersekretariat Buchmann for concert management; Opera Connection for opera management. Concert email on official site appears misspelled (`office@buchamnn.at`) and links to a placeholder; homepage directs to official contact page rather than reproducing it. Opera email: info@opera-connection.com.
- Official home social links: https://www.instagram.com/nathaliepenacomas/ and https://www.facebook.com/sopranopenacomas/. Older conflicting handles exist in Wix data; current visible links selected.
- Sitemap index and /pages-sitemap.xml retrieved successfully; nine page URLs identified alongside navigation.

## Assets and pending validation

See `official-media.json` for original URLs. Original downloads preserved in `src/assets/official`; Astro generates responsive WebP variants without upscaling. Hero uses eager/high-priority loading plus a matching responsive preload. Below-fold imagery loads lazily. Opera thumbnails stay in smaller frames; no full-screen thumbnail backgrounds.

Artist approval of media reuse remains required. Confirm photographer credits for hero and bio portrait and label/cover artwork rights. © David Moser is retained visibly on the stage photo. Supply `alta-gracia-master.jpg` (square, minimum 1200 px) to replace the available 563 × 530 official image for future larger use. An original hero at 5760 × 3840 and Tierra cover at 1108 px were available; no invented/generated portraits used.

Please confirm current representation contacts before a full migration. Broader pages remain on the official site during this demo.

## Verification

`npm run build` and `npm run check` pass. Eleven Playwright tests cover ES/EN at 390/768/1440 px, image loading, no horizontal overflow, mobile navigation, video consent/focus restoration, opera video mapping, language links without JavaScript, privacy controls and reduced motion. Desktop/mobile screenshots reviewed. Album smartlink, all four album destinations, bio and contact returned HTTP 200. All four YouTube oEmbed endpoints confirmed the official Nathalie Peña-Comas channel; actual playback may still depend on YouTube regional/embed restrictions.
