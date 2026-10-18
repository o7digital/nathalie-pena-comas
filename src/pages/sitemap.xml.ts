import type { APIRoute } from 'astro';
export const GET: APIRoute = ({ site }) => {
 const origin = site?.href.replace(/\/$/, '') ?? 'https://nathalie-pena-comas.vercel.app';
 const urls = ['', 'classical/', 'popular/', 'privacy/'].flatMap(path => ['es', 'en'].map(lang => `<url><loc>${origin}/${lang}/${path}</loc><xhtml:link rel="alternate" hreflang="es" href="${origin}/es/${path}"/><xhtml:link rel="alternate" hreflang="en" href="${origin}/en/${path}"/><xhtml:link rel="alternate" hreflang="x-default" href="${origin}/es/${path}"/></url>`)).join('');
 return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`, { headers: { 'Content-Type': 'application/xml' } });
};
