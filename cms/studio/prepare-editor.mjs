// Add translation metadata and missing section labels without changing existing editorial values.
import { request } from 'node:https';
import { readFile } from 'node:fs/promises';
import siteMap from './site-map.json' with { type: 'json' };
import { targetLocales,textId } from './translations.mjs';
const base=process.env.PUBLIC_URL,token=process.env.ADMIN_TOKEN;
if(base!=='https://directus-dev-9ae1.up.railway.app'||!token)throw new Error('Use the Nathalie Directus dev variables.');
async function api(path,method='GET',data) {
 const bytes=data===undefined?null:Buffer.from(JSON.stringify(data));
 const result=await new Promise((resolve,reject)=>{
  const req=request(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(bytes?{'Content-Length':bytes.length}:{})}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(Buffer.concat(chunks).toString()||'null')}));});req.on('error',reject);req.setTimeout(60000,()=>req.destroy(new Error('CMS timeout')));req.end(bytes);
 });
 if(result.status>=400)throw new Error(`Editor setup ${method} ${path}: ${result.status}`);return result.data?.data;
}
const fields=await api('/fields/site_texts');
for(const field of [{field:'source_hash',type:'string',schema:{max_length:64}},{field:'auto_translated',type:'boolean',schema:{}},{field:'translated_at',type:'timestamp',schema:{}}]) {
 if(!fields.some(row=>row.field===field.field))await api('/fields/site_texts','POST',{...field,schema:{...field.schema,is_nullable:true},meta:{hidden:true,readonly:true}});
}
const current=await api('/items/site_texts?limit=-1&fields=key,locale');
const existing=new Set(current.map(row=>`${row.locale}:${row.key}`));
const dictionaries=JSON.parse(await readFile(new URL('../../src/data/localized.json',import.meta.url),'utf8'));
const unique=new Map(siteMap.sections.flatMap(section=>section.fields).map(row=>[row.key,row]));
const missing=[];
for(const row of unique.values())for(const locale of ['es',...targetLocales]) {
 if(existing.has(`${locale}:${row.key}`))continue;
 const value=locale==='es'?row.source:locale==='en'?row.english:dictionaries[locale]?.[row.english]??row.english;
 missing.push({id:textId(row.key,locale),key:row.key,locale,value,status:'published',sort:0});
}
for(let i=0;i<missing.length;i+=80)await api('/items/site_texts','POST',missing.slice(i,i+80));
console.log('Spanish section editor prepared. Translation metadata ready;',missing.length,'missing labels added; existing content preserved.');
