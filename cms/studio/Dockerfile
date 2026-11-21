FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY cms/studio/package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --chown=node:node cms/studio/server.mjs cms/studio/preview.mjs cms/studio/seo.mjs cms/studio/site-media.mjs ./
COPY --chown=node:node cms/studio/arm.mjs cms/studio/social-media.mjs cms/studio/reporting.mjs cms/studio/translations.mjs cms/studio/site-map.json ./
COPY --chown=node:node cms/studio/public/ ./public/
COPY --chown=node:node public/fonts/ ./public/fonts/
COPY --chown=node:node public/logo-npc.png ./public/logo-npc.png
USER node
CMD ["node", "server.mjs"]
