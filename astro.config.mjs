import { defineConfig } from 'astro/config';
export default defineConfig({ site: process.env.PUBLIC_SITE_URL || 'https://nathalie-pena-comas.vercel.app', output: 'static', trailingSlash: 'always' });
