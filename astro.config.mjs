import { defineConfig } from 'astro/config';
import { cp, rm } from 'node:fs/promises';
export default defineConfig({
 site: process.env.PUBLIC_SITE_URL || 'https://nathalie-pena-comas.vercel.app', output: 'static', trailingSlash: 'always',
 integrations: [{ name: 'cms-images', hooks: {
  'astro:build:done': async ({ dir }) => {
   const destination = new URL('_cms/', dir);
   await rm(destination, { recursive: true, force: true });
   try { await cp(new URL('./public/_cms/', import.meta.url), destination, { recursive: true }); }
   catch (error) { if (error.code !== 'ENOENT') throw error; }
  },
 } }],
});
