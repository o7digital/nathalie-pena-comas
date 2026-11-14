# Nath AI on Olivia 3.6

The public website and dev preview use the same Olivia **3.6.0** instance dedicated to Nathalie on the authorized o7 VPS. Production was explicitly authorized and activated on 14 November 2026. Both targets share this artist's published-site knowledge; browser cookies remain scoped to their respective hosts. The public name is **Nath AI** everywhere. Its core is recovered unchanged from `/opt/o7/apps/vialterna3-olivia36/core`, revision `3453702` of `o7digital/olivia-v3`; the other client's knowledge, database and gateway credentials are not reused.

The floating treatment follows `o7digital/suitesmine-bot/public/olivia-floating-theme.js` (blob `f36504e30bf11aa7cb009138524cb68951f12257`): panel motion, layered shadow and green presence dot. Reduced-motion users retain the shadow and presence without movement. Availability comes from the same-origin health endpoint and is never fabricated by an idle timer.

## Request path

Browser → `/api/nath-ai/*` (Vercel Node functions) → `https://olivia.o7digitalgroup.com/nathalie-preview/*` → dedicated `nathalie-olivia36` container and PostgreSQL/pgvector database. This existing backend prefix serves both approved website targets. Provider API keys remain on the VPS. The gateway key exists only in mode-0600 VPS configuration and Vercel's sensitive **production** and **preview/dev** environment variables; it is never bundled into browser code.

Browser identities use a signed HttpOnly, Secure, SameSite cookie. Conversation IDs bind the cookie session and visitor ID. Tenant, language, consent, message size and origin checks happen server-side. The dedicated service enforces per-session/IP/global rate limits and a concurrency limit. It retrieves approved complete website sections; browser-supplied page text cannot replace the knowledge base. The system instructions require the name Nath AI and the chosen one of 11 languages.

Only the availability request runs before agreement. Messages are sent after the visitor checks the agreement box. The existing local session key is preserved. The service keeps authenticated model replies and visitor/operator state in its isolated database; the public widget cannot insert operator messages. This preview does not send conversations into the old shared Suitesmine inbox. Representation links remain available; connecting an operator dashboard to this isolated store is a separate integration.

## Recovery and deployment

1. Run `npm run build`; it also generates the complete knowledge manifest.
2. Copy this directory (including generated `knowledge/`, excluding `.env*` and `__pycache__`) to `/opt/o7/apps/nathalie-olivia36` on the VPS.
3. Run `sudo python3 bootstrap-vps.py` there. It copies the verified core, generates new database/gateway credentials and uses the existing configured AI provider entirely server-side. It never prints secrets.
4. Run `sudo docker compose up --build -d` and verify loopback port 8138 `/health`.
5. Run `sudo python3 install-proxy.py`. It adds only the authenticated `/nathalie-preview/` prefix, backs up the existing configuration, validates nginx, and reloads it. Existing routes are preserved.
6. Set `NATH_AI_GATEWAY_URL` and the sensitive `NATH_AI_GATEWAY_KEY` for the website's **preview/dev** target through stdin. Do not add production variables or promote the preview without an explicit order.
7. Run `node --test tests/unit/*.unit.mjs`, the widget browser tests and the site build/check; deploy with `vercel --yes`. Verify health and a real consented response from the deployed preview.

Production recovery: `/api/nath-ai/health` returning 503 with `Nath AI is not configured` means a server gateway parameter is missing from that deployment. Configure both names above for the production target using stdin, keeping the gateway key sensitive. After explicit user authorization, use `vercel redeploy <existing-production-deployment> --target production` to rebuild the existing public version with its current environment settings. Merely saving environment variables does not update already deployed functions. Verify the public alias's health, identity and a real consented widget response. This operation does not require changing `main` or `main2` and does not authorize future production releases.

## Complete published-site knowledge

Every `npm run build` indexes the full homepages and privacy pages in all 11 languages, including expanded About and Spirituosi text, news, media, voice, gallery, contacts and hidden repertoire rows. `src/pages/nath-ai-data.json.ts` exports the same published CMS snapshot used by the website, including the entire calendar rather than only the upcoming dates visible initially. The manifest currently covers 22 pages, 26 calendar entries (24 performances and two recording releases), 18 opera roles, 40 concert works, four albums and two singles.

Vercel packages the generated manifest server-side. Health checks and authorized chat requests compare its revision/publication timestamp with the dedicated VPS; a new build automatically synchronizes changed and deleted content. Embeddings are prepared before the database transaction replaces documents. The existing knowledge remains active if preparation fails. A durable publication watermark prevents visitors to an older preview from restoring outdated content. Startup also preserves a newer database snapshot over an older bundled seed. Conversations are retained separately and never become published facts.

Every question receives the entire structured calendar, opera/concert repertoire and discography, plus relevant page passages selected in the visitor's language. This avoids missing dates or works through vector search. The instructions distinguish past/upcoming events using the current Mexico City date, roles in preparation, digital releases and published ticket statuses. No unannounced dates, times, prices or remaining seats are inferred.

Generated core and knowledge are ignored by Git. Source links use real website anchors. No external tool sends mail, books tickets or changes CRM records. For knowledge-only content updates, a normal site build and preview deployment suffice; a VPS rebuild is needed only when the service implementation or system instructions change.

Verification: `node --test tests/unit/*.unit.mjs`, `python3 -m unittest discover -s services/nath-ai/tests`, `npm run check`, `npm run test:e2e`.
Run the non-mutating database/provider-failure integration check on the dedicated VPS with `sudo docker exec -i nathalie-olivia36 python < tests/check-runtime.py`.

## Rollback

Revert the website commit and preview deployment. The dedicated VPS service can be stopped with `docker compose stop` in its own directory. Preserve its database volume if conversations need to be retained. Remove only the `/nathalie-preview/` nginx block if retiring the service, validating nginx before reload. Never restore the entire proxy backup over changes made by other services.
