/** Extract every localized public page and preserve complete structured catalogues. */
import {parse} from 'parse5';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
function attr(node,name){return node.attrs?.find(a=>a.name===name)?.value;}
function find(node,predicate){if(predicate(node))return node;for(const child of node.childNodes||[]){const found=find(child,predicate);if(found)return found;}}
function text(node){
 if(['script','style','template','dialog','nav'].includes(node.tagName))return '';
 if(node.nodeName==='#text')return node.value;
 const chunks=(node.childNodes||[]).map(text);
 if(node.tagName==='img'&&attr(node,'alt'))chunks.push(attr(node,'alt'));
 if(node.tagName==='time'&&attr(node,'datetime'))chunks.unshift('Date: '+attr(node,'datetime'));
 if(node.tagName==='a'&&/^(https:\/\/|mailto:)/.test(attr(node,'href')||''))chunks.push(attr(node,'href'));
 if(node.tagName==='button'&&attr(node,'data-video'))chunks.push('https://www.youtube.com/watch?v='+attr(node,'data-video'));
 return chunks.join(' ');
}
export function pageDocuments(html,locale,privacy=false){
 const root=parse(html),main=find(root,n=>n.tagName==='main');
 if(!main)throw Error('Published page has no main content');
 if(privacy)return [{id:`page:${locale}:privacy`,title:`Nathalie Peña-Comas — Privacy (${locale})`,source:`/${locale}/privacy/`,content:text(main).replace(/\s+/g,' ').trim(),metadata:{kind:'page',locale,section:'privacy'}}];
 const nodes=[];
 function walk(node){
  if(['section','article','footer'].includes(node.tagName)&&attr(node,'id'))nodes.push(node);
  for(const child of node.childNodes||[])walk(child);
 }
 walk(main);const footer=find(root,n=>n.tagName==='footer');if(footer)walk(footer);
 const seen=new Set();return nodes.flatMap(node=>{
  const id=attr(node,'id');if(seen.has(id))return [];seen.add(id);
  const content=text(node).replace(/\s+/g,' ').trim();
  if(!content)return [];
  return [{id:`page:${locale}:${id}`,title:`Nathalie Peña-Comas — ${id} (${locale})`,source:`/${locale}/#${id}`,content,metadata:{kind:'page',locale,section:id}}];
 });
}
export function catalogueDocuments(catalog){
 const rows=[];
 for(const event of catalog.calendar)rows.push({id:`event:${event.id}`,title:`Calendar — ${event.date} — ${event.title}`,source:`/es/#schedule`,content:JSON.stringify({type:'announced_calendar_event',...event}),metadata:{kind:'calendar_event',locale:'es',section:'schedule'}});
 for(const [kind,groups]of Object.entries(catalog.repertoire))for(const [index,group]of groups.entries())rows.push({id:`repertoire:${kind}:${index}`,title:`Classical ${kind} — ${group.composer}`,source:`/es/#repertorio`,content:JSON.stringify({type:`classical_${kind}_repertoire`,...group}),metadata:{kind:`repertoire_${kind}`,locale:'es',section:'repertorio'}});
 for(const album of catalog.albums)rows.push({id:`album:${album.id}`,title:`Album — ${album.title}`,source:`/es/#collection`,content:JSON.stringify({type:'album',...album}),metadata:{kind:'album',locale:'es',section:'collection'}});
 for(const [index,recording]of catalog.recordings.entries())rows.push({id:`recording:${index}`,title:`Recording — ${recording.name}`,source:`/es/#contemporain`,content:JSON.stringify({type:'recording',...recording}),metadata:{kind:'recording',locale:'es',section:'contemporain'}});
 return rows;
}
export async function buildKnowledge(root=process.cwd()){
 const catalog=JSON.parse(await readFile(resolve(root,'dist/nath-ai-data.json'),'utf8'));
 if(catalog.schemaVersion!==1||!catalog.calendar.length||!catalog.repertoire.opera.length)throw Error('Invalid published knowledge data');
 const documents=[];
 for(const locale of catalog.languages)for(const privacy of [false,true])documents.push(...pageDocuments(await readFile(resolve(root,`dist/${locale}/${privacy?'privacy/':''}index.html`),'utf8'),locale,privacy));
 documents.push(...catalogueDocuments(catalog));documents.sort((a,b)=>a.id.localeCompare(b.id,'en'));
 if(new Set(documents.map(d=>d.id)).size!==documents.length)throw Error('Duplicate knowledge ID');
 const payload={schemaVersion:1,documents,catalog};
 const manifest={...payload,revision:createHash('sha256').update(canonical(payload)).digest('hex'),publishedAt:new Date().toISOString(),stats:{pages:catalog.languages.length*2,documents:documents.length,calendarEvents:catalog.calendar.length,operaRoles:catalog.repertoire.opera.reduce((n,g)=>n+g.roles.length,0),concertWorks:catalog.repertoire.concert.reduce((n,g)=>n+g.works.length,0),albums:catalog.albums.length,recordings:catalog.recordings.length}};
 const directory=resolve(root,'services/nath-ai/knowledge');await mkdir(directory,{recursive:true});await mkdir(resolve(root,'lib'),{recursive:true});
 const encoded=JSON.stringify(manifest);
 await writeFile(resolve(directory,'manifest.json'),encoded+'\n');await writeFile(resolve(root,'lib/nath-ai-knowledge.generated.json'),encoded+'\n');
 await writeFile(resolve(directory,'documents.json'),JSON.stringify(documents)+'\n');await writeFile(resolve(directory,'system.txt'),await readFile(resolve(root,'services/nath-ai/system.txt')));
 console.log(`Nath AI knowledge: ${manifest.stats.pages} pages, ${documents.length} documents, ${manifest.stats.calendarEvents} events, ${manifest.stats.operaRoles} opera roles, ${manifest.stats.concertWorks} concert works (${Buffer.byteLength(encoded)} bytes)`);
 return manifest;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildKnowledge();
