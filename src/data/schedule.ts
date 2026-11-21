import { readContent, localizedRecord, externalLink } from '../lib/cms';
import official from '../../cms/schedule-official-2026-11-08.json';
import translations from './schedule-translations.json';
import type { Locale } from './translations';

export type ConcertEvent = { id: string; date: string; title: string; ensemble: string; venue: string; city: string; url: string; ticket_status: string };
// Spanish originals and dates transcribed from the artist's official schedule.
const localSchedule = official.events;
const cmsConcerts = await readContent('concerts');
const loadedSchedule: ConcertEvent[] = cmsConcerts === null ? localSchedule : cmsConcerts.map(row => {
 if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error('Published concerts need a valid date.');
 return { id: row.id, date: row.date, title: row.title, ensemble: row.ensemble || '', venue: row.venue || '', city: row.city || '', url: row.url ? externalLink(row.url) : '', ticket_status: row.ticket_status || 'none' };
});
// Replace the old placeholder even when an older CMS entry is still published.
const confirmedConcert = localSchedule.find(event => event.id === 'concert-2027-04-07')!;
export const schedule = loadedSchedule.map(event => event.id === confirmedConcert.id && (!event.url || event.ticket_status === 'soon' || /^https:\/\/www\.tuboleta\.com\.do\/?$/.test(event.url))
 ? {...event, url:confirmedConcert.url, ticket_status:confirmedConcert.ticket_status} : event);
const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const featuredConcert = schedule.find(event => event.id === confirmedConcert.id && event.date >= today);
export function concertText(event: ConcertEvent, field: 'title' | 'ensemble' | 'venue' | 'city', lang: Locale) {
 const fallback = lang === 'es' ? event[field] : (translations as Record<string, Record<string, string>>)[lang]?.[`content:concerts:${event.id}:${field}`] ?? event[field];
 return localizedRecord('concerts', event.id, field, lang, fallback);
}
