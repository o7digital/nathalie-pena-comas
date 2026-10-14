import type { APIRoute } from 'astro';
export const GET: APIRoute = ({ site }) => new Response(`User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap.xml', site ?? 'https://nathalie-pena-comas.vercel.app')}\n`, { headers: { 'Content-Type': 'text/plain' } });
