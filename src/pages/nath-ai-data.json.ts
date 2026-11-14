import type { APIRoute } from 'astro';
import { schedule } from '../data/schedule';
import { albums } from '../data/albums';
import { artist, recordings } from '../data/music';
import repertoire from '../data/repertoire.json';
import { locales } from '../data/locales';

// Public, published content only, from the same CMS snapshot used to build the site.
export const GET: APIRoute = () => new Response(JSON.stringify({
 schemaVersion:1,
 artist,
 languages:locales.map(locale=>locale.code),
 calendar:schedule.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).map(event=>({...event,kind:recordings.some(recording=>recording.date===event.date&&event.title.includes(recording.name))?'recording_release':'performance'})),
 repertoire:{opera:repertoire.opera,concert:repertoire.concert},
 albums:albums.map(({id,title,url,detail,category})=>({id,title,url,detail,category})),
 recordings:recordings.map(recording=>({...recording})),
}),{headers:{'Content-Type':'application/json; charset=utf-8'}});
