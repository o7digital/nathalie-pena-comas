# Standalone homepage navigation

Verified sources and implementation, 14 October 2026.

- Header/footer destinations: `#home`, `#about`, `#schedule`, `#news`, `#press`, `#media`, `#spirituosi`, `#gallery`, `#contact`.
- Spanish navigation labels and visible section content are localized. Section identifiers are shared across languages.
- Language links follow the section currently being read, including manual scroll and non-menu sections (album, collection, career, music films and newsletter). Native anchor links and localized pages remain usable without JavaScript.
- Existing CSS scroll margins compensate for the fixed header and respect reduced motion. There is no routing to Wix from public anchors.
- Articles, dates and photographs with no meaningful action are editorial content rather than clickable placeholders. Musical links remain the existing verified distribution destinations. Video embeds still require explicit playback consent.
- Newsletter is explicitly unavailable in this demo. No subscription form or fake submit action is presented.
- Utility privacy pages link back to localized homepage sections.

## Contact verification

The artist's public contact page identifies the two management agencies:
https://www.nathaliepenacomas.net/contact

Buchmann's contact email is misspelled on the artist's page. The corrected public address `office@buchmann.at` is verified directly with the agency's own imprint, rather than inferred:
https://www.buchmann.at/impressum/

`info@opera-connection.com` is verified with Opera Connection's own office page:
https://www.opera-connection.com/contact/office/

Both are exposed as standard mailto links. Representation information comes from the artist's official page; the agency pages corroborate the contact addresses.

## Source references

The prior official-media provenance and source documents remain applicable. The only remaining official Wix URL in application source is the non-navigational JSON-LD `sameAs` identity reference; it is not an anchor, button, redirect or public navigation destination.

## Verification

Build and Astro checks pass. Twenty-three browser tests passed across ES/EN and five viewport widths, including clicking every header/footer entry, all discovery destinations, all video controls, utility privacy links and language preservation on menu and non-menu sections. Desktop Press and mobile Contact screenshots reviewed. Static HTML inspection found 52 links per homepage, zero Wix anchor destinations and zero missing hash targets.

The previous Una Mujer Amazon destination returned HTTP 500 during verification and was replaced with the verified album at https://music.apple.com/us/album/una-mujer/1223241296. All five current non-video musical destinations returned HTTP 200 (Apple Music, Spotify and the official Tierra smartlink). Existing video identities were retained; playback may depend on YouTube restrictions.
