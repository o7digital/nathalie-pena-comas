import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {canonical,pageDocuments} from '../../services/nath-ai/build-knowledge.mjs';
import {ensureKnowledge,publishedKnowledge} from '../../lib/nath-ai-knowledge.mjs';

const manifest=await publishedKnowledge();
test('the generated knowledge covers every locale and the complete published catalogues',async()=>{
 assert.equal(manifest.stats.pages,22);assert.equal(manifest.stats.calendarEvents,26);
 assert.equal(manifest.stats.operaRoles,18);assert.equal(manifest.stats.concertWorks,40);
 assert.equal(manifest.stats.albums,4);assert.equal(manifest.stats.recordings,2);
 for(const language of manifest.catalog.languages)for(const section of ['home','about','schedule','voice','repertorio','contemporain','spirituosi','news','gallery','contact','privacy'])
  assert(manifest.documents.some(d=>d.id===`page:${language}:${section}`),`${language}/${section} is missing`);
 assert.equal(manifest.catalog.calendar.filter(e=>e.kind==='recording_release').length,2);
 assert.deepEqual(manifest.catalog.calendar.filter(e=>e.title.includes('Aida')).map(e=>e.date),['2027-07-01','2027-07-03','2027-07-08','2027-07-10','2027-07-14','2027-07-16']);
 const {schemaVersion,documents,catalog}=manifest;
 assert.equal(manifest.revision,createHash('sha256').update(canonical({schemaVersion,documents,catalog})).digest('hex'));
 assert.deepEqual(JSON.parse(await readFile('dist/nath-ai-data.json','utf8')),catalog);
});
test('published extraction keeps collapsed complete text, entities and source links while omitting scripts and dialogs',()=>{
 const [doc]=pageDocuments('<main><section id="about"><h2>About</h2><details><p>Peña &amp; Comas: complete paragraph.</p></details><a href="https://example.com/tickets">Tickets</a><script>SECRET</script><dialog>PRIVATE</dialog></section></main>','fr');
 assert.match(doc.content,/Peña & Comas: complete paragraph\./);assert.match(doc.content,/https:\/\/example.com\/tickets/);
 assert(!doc.content.includes('SECRET'));assert(!doc.content.includes('PRIVATE'));assert.equal(doc.source,'/fr/#about');
});
const status=(revision,publishedAt)=>({status:200,data:{version:'3.6.0',revision,publishedAt}});
const local={revision:'new',publishedAt:'2026-11-14T15:00:00Z'};
test('a new build automatically sends its complete manifest to the authenticated synchronizer',async()=>{
 const calls=[];const result=await ensureKnowledge(async(path,options)=>{calls.push({path,options});return path.endsWith('/status')?status('old','2026-11-13T00:00:00Z'):status(local.revision,local.publishedAt);},local);
 assert.equal(result.revision,'new');assert.equal(calls[1].path,'/knowledge/sync');assert.deepEqual(JSON.parse(calls[1].options.body),local);
});
test('an unchanged build skips embeddings, while an old preview cannot roll the knowledge back',async()=>{
 for(const current of [status('new',local.publishedAt),status('newer','2026-11-15T00:00:00Z')]){
  let count=0;const result=await ensureKnowledge(async()=>{count++;return current;},local);assert.equal(count,1);assert.equal(result.revision,current.data.revision);
 }
});
test('a rebuild of unchanged content advances the publication watermark',async()=>{
 let calls=0;await ensureKnowledge(async()=>++calls===1?status('new','2026-11-13T00:00:00Z'):status('new',local.publishedAt),local);assert.equal(calls,2);
});
test('synchronization failure cannot advertise current knowledge',async()=>{
 await assert.rejects(ensureKnowledge(async path=>path.endsWith('/status')?status('old','2026-11-13T00:00:00Z'):{status:500,data:{}},local));
 await assert.rejects(ensureKnowledge(async()=>({status:200,data:{version:'3.5.0'}}),local));
});
