// Explicit, repeatable import into Nathalie Directus DEV only. Never publishes production.
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import official from './schedule-official-2026-11-08.json' with {type:'json'};
import siteMap from './studio/site-map.json' with {type:'json'};
import {targetLocales,localizedFields,recordTextKey,sourceHash,translateSpanish,translationWrites,assertTranslationsReady} from './studio/translations.mjs';

const base=process.env.DIRECTUS_URL,token=process.env.ADMIN_TOKEN;
if(base!=='https://directus-dev-9ae1.up.railway.app'||!token)throw new Error('Use the Nathalie Directus DEV URL and an administrator token.');
async function api(path,method='GET',body){
 const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error(`Directus schedule ${method} ${path.split('?')[0]}: HTTP ${response.status}`);
 return (await response.json()).data;
}
const current=await api('/items/concerts?limit=-1&sort=date,id'),texts=await api('/items/site_texts?limit=-1');
if(new Set(official.events.map(row=>row.id)).size!==official.events.length)throw new Error('Duplicate official calendar identifiers.');
const existing=new Map(current.map(row=>[row.id,row]));
for(const row of official.events){
 if(row.id!=='concert-'+row.date||!/^\d{4}-\d{2}-\d{2}$/.test(row.date))throw new Error('Invalid official calendar date or identity.');
 if(existing.has(row.id)&&existing.get(row.id).status!=='published')throw new Error(`Review the unpublished concert before importing: ${row.id}`);
}
if(!process.argv.includes('--apply')){
 console.log(JSON.stringify({source:official.source,events:official.events.length,add:official.events.filter(row=>!existing.has(row.id)).length,existing:official.events.filter(row=>existing.has(row.id)).length,dryRun:true}));
 process.exit(0);
}

// Back up only the affected content, privately and outside Git, before any write.
const folder=join(homedir(),'.codex','private','nathalie-schedule-backups');await mkdir(folder,{recursive:true,mode:0o700});await chmod(folder,0o700);
const backup=join(folder,new Date().toISOString().replace(/[:.]/g,'-')+'.json');
await writeFile(backup,JSON.stringify({concerts:current,site_texts:texts.filter(row=>row.key?.startsWith('content:concerts:')||siteMap.sections.find(section=>section.id==='concerts').fields.some(field=>field.key===row.key))},null,2),{mode:0o600});
const sources=official.events.flatMap(row=>localizedFields.concerts.map(field=>({key:recordTextKey('concerts',row.id,field),value:row[field]||'',status:'published'})));
const newCopy=siteMap.sections.find(section=>section.id==='concerts').fields.filter(field=>!texts.some(row=>row.key===field.key&&row.locale==='es'));
sources.push(...newCopy.map(field=>({key:field.key,value:field.source,status:'published'})));
const translations=Object.fromEntries(targetLocales.map(locale=>[locale,{}])),lookup=new Map(texts.map(row=>[row.locale+':'+row.key,row]));
const unique=new Map();
for(const source of sources){
 const ready=targetLocales.every(locale=>lookup.get(locale+':'+source.key)?.source_hash===sourceHash(source.value));
 if(ready){for(const locale of targetLocales)translations[locale][source.key]=lookup.get(locale+':'+source.key).value;}
 else if(!unique.has(source.value))unique.set(source.value,source);
}
const pending=[...unique.values()];
for(let offset=0;offset<pending.length;offset+=20){
 const group=pending.slice(offset,offset+20);
 const result=await translateSpanish(group,{key:process.env.OPENAI_API_KEY,model:process.env.TRANSLATION_MODEL||'gpt-5.4-mini'});
 for(const locale of targetLocales)Object.assign(translations[locale],result[locale]);
 console.log('Schedule translation batch completed:',Math.min(offset+20,pending.length),'/',pending.length);
}
for(const source of sources)for(const locale of targetLocales){
 if(translations[locale][source.key]===undefined)translations[locale][source.key]=translations[locale][unique.get(source.value).key];
}
for(const field of newCopy)translations.en[field.key]=field.english;

// Add only the two fields required to edit the source's reservation information.
const fields=await api('/fields/concerts');
for(const field of [
 {field:'url',type:'string',schema:{is_nullable:true,max_length:2000},meta:{interface:'input',width:'full',note:'Enlace oficial de información o reserva (HTTPS).'}},
 {field:'ticket_status',type:'string',schema:{is_nullable:true,default_value:'none'},meta:{interface:'select-dropdown',width:'half',options:{choices:[{text:'Información y entradas',value:'available'},{text:'Próximamente',value:'soon'},{text:'Entrada libre',value:'free'},{text:'Sin enlace',value:'none'}]}}},
])if(!fields.some(row=>row.field===field.field))await api('/fields/concerts','POST',field);
const oldTexts=new Map(texts.map(row=>[row.id,row]));
const writes=translationWrites(sources,translations,texts).filter(row=>!oldTexts.has(row.id)||['key','locale','value','status','source_hash','auto_translated'].some(field=>oldTexts.get(row.id)[field]!==row[field])),oldIds=new Set(texts.map(row=>row.id));
for(const [method,rows]of [['POST',writes.filter(row=>!oldIds.has(row.id))],['PATCH',writes.filter(row=>oldIds.has(row.id))]])for(let offset=0;offset<rows.length;offset+=100)await api('/items/site_texts',method,rows.slice(offset,offset+100));
let added=0,updated=0;
for(const [sort,row]of official.events.entries()){
 const old=existing.get(row.id),payload={...row,sort,status:'published'};
 if(!old){await api('/items/concerts','POST',payload);added++;}
 else if(Object.entries(payload).some(([field,value])=>old[field]!==value)){await api('/items/concerts/'+row.id,'PATCH',payload);updated++;}
}
const saved=await api('/items/concerts?limit=-1&sort=date,id'),savedTexts=await api('/items/site_texts?limit=-1');
assertTranslationsReady(savedTexts.filter(row=>row.key?.startsWith('content:concerts:')||newCopy.some(field=>field.key===row.key)),{concerts:saved.filter(row=>row.status==='published')});
for(const expected of official.events){const row=saved.find(row=>row.id===expected.id);if(!row||Object.entries(expected).some(([field,value])=>row[field]!==value))throw new Error('Calendar verification failed: '+expected.id);}

// Keep local, unauthenticated development and CMS-backed previews in agreement.
const fallback=Object.fromEntries(targetLocales.map(locale=>[locale,Object.fromEntries(sources.filter(row=>row.key.startsWith('content:concerts:')).map(row=>[row.key,translations[locale][row.key]]))]));
await writeFile(new URL('../src/data/schedule-translations.json',import.meta.url),JSON.stringify(fallback,null,2)+'\n');
const localizedPath=new URL('../src/data/localized.json',import.meta.url),localized=JSON.parse(await readFile(localizedPath,'utf8'));
for(const field of newCopy)for(const locale of targetLocales.filter(locale=>locale!=='en'))localized[locale][field.english]=translations[locale][field.key];
await writeFile(localizedPath,JSON.stringify(localized,null,2)+'\n');
console.log(JSON.stringify({officialScheduleImported:true,source:official.source,events:official.events.length,added,updated,translatedLanguages:targetLocales.length,productionPublished:false}));
