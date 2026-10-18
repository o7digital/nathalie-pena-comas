import type { APIRoute } from 'astro';
import { locales } from '../data/locales';
export const GET: APIRoute = ({ site }) => {
 const origin = site?.href.replace(/\/$/, '') ?? 'https://nathalie-pena-comas.vercel.app';
 const urls = ['', 'classical/', 'popular/', 'privacy/'].flatMap(path => locales.map(({code}) => `<url><loc>${origin}/${code}/${path}</loc>${locales.map(locale=>`<xhtml:link rel="alternate" hreflang="${locale.code}" href="${origin}/${locale.code}/${path}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${origin}/es/${path}"/></url>`)).join('');
 return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`, { headers: { 'Content-Type': 'application/xml' } });
};
