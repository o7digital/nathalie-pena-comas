# Nath AI on Olivia 3.6

The website preview uses a dedicated Olivia **3.6.0** instance on the authorized o7 VPS. The public name is **Nath AI** everywhere. Its core is recovered unchanged from `/opt/o7/apps/vialterna3-olivia36/core`, revision `3453702` of `o7digital/olivia-v3`; the other client's knowledge, database and gateway credentials are not reused.

The floating treatment follows `o7digital/suitesmine-bot/public/olivia-floating-theme.js` (blob `f36504e30bf11aa7cb009138524cb68951f12257`): panel motion, layered shadow and green presence dot. Reduced-motion users retain the shadow and presence without movement. Availability comes from the same-origin health endpoint and is never fabricated by an idle timer.

## Request path

Browser → `/api/nath-ai/*` (Vercel Node functions) → `https://olivia.o7digitalgroup.com/nathalie-preview/*` → dedicated `nathalie-olivia36` container and PostgreSQL/pgvector database. API keys remain on the VPS. The preview gateway key exists only in mode-0600 VPS configuration and Vercel's sensitive **preview/dev** environment variables; it is never bundled into browser code.

Browser identities use a signed HttpOnly, Secure, SameSite cookie. Conversation IDs bind the cookie session and visitor ID. Tenant, language, consent, message size and origin checks happen server-side. The dedicated service enforces per-session/IP/global rate limits and a concurrency limit. It retrieves approved complete website sections; browser-supplied page text cannot replace the knowledge base. The system instructions require the name Nath AI and the chosen one of 11 languages.

Only the availability request runs before agreement. Messages are sent after the visitor checks the agreement box. The existing local session key is preserved. The service keeps authenticated model replies and visitor/operator state in its isolated database; the public widget cannot insert operator messages. This preview does not send conversations into the old shared Suitesmine inbox. Representation links remain available; connecting an operator dashboard to this isolated store is a separate integration.

## Recovery and deployment

1. Run `npm run build` and `python3 services/nath-ai/build-knowledge.py`.
2. Copy this directory (including generated `knowledge/`, excluding `.env*` and `__pycache__`) to `/opt/o7/apps/nathalie-olivia36` on the VPS.
3. Run `sudo python3 bootstrap-vps.py` there. It copies the verified core, generates new database/gateway credentials and uses the existing configured AI provider entirely server-side. It never prints secrets.
4. Run `sudo docker compose up --build -d` and verify loopback port 8138 `/health`.
5. Run `sudo python3 install-proxy.py`. It adds only the authenticated `/nathalie-preview/` prefix, backs up the existing configuration, validates nginx, and reloads it. Existing routes are preserved.
6. Set `NATH_AI_GATEWAY_URL` and the sensitive `NATH_AI_GATEWAY_KEY` for the website's **preview/dev** target through stdin. Do not add production variables or promote the preview without an explicit order.
7. Run `node --test tests/unit/nath-ai-gateway.unit.mjs`, the widget browser tests and the site build/check; deploy with `vercel --yes`. Verify health and a real consented response from the deployed preview.

The generated core and knowledge are ignored by Git. The generator reads the built Spanish homepage, including complete About, repertoire, Spirituosi, official concert dates and representation contacts. Refresh knowledge explicitly after relevant content changes. Source knowledge links use the site's canonical routes; no external tool can send mail, book or change CRM records from this assistant.

## Rollback

Revert the website commit and preview deployment. The dedicated VPS service can be stopped with `docker compose stop` in its own directory. Preserve its database volume if conversations need to be retained. Remove only the `/nathalie-preview/` nginx block if retiring the service, validating nginx before reload. Never restore the entire proxy backup over changes made by other services.
