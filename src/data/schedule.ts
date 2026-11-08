import { readContent } from '../lib/cms';
// Transcribed from the official /schedule page on 14 October 2026.
const localSchedule = [
  {date:'2026-10-24',title:'Inaugural Concert',ensemble:'National Symphony Orchestra',venue:'Centro Cultural Rainieri',city:'Punta Cana, Dominican Republic'},
  {date:'2026-10-28',title:'Brahms: Ein deutsches Requiem',ensemble:'Györ Philharmonic Orchestra',venue:'Basilica of Györ',city:'Györ, Hungary'},
  {date:'2026-11-04',title:'Mahler: Symphony Nr. 2 — Resurrection',ensemble:'National Symphony Orchestra',venue:'Teatro Nacional Eduardo Brito',city:'Santo Domingo, Dominican Republic'},
  {date:'2026-11-15',title:'Brahms: Ein deutsches Requiem',ensemble:'Györ Philharmonic Orchestra',venue:'Minoritenkirche',city:'Vienna, Austria'},
];

const cmsConcerts = await readContent('concerts');
export const schedule = cmsConcerts === null ? localSchedule.map((row,i)=>({...row,id:`concert-${i}`})) : cmsConcerts.map(row => {
 if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error('Published concerts need a valid date.');
 return { id:row.id,date: row.date, title: row.title, ensemble: row.ensemble || '', venue: row.venue || '', city: row.city || '' };
});
