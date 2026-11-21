import {createHash} from 'node:crypto';
import {emptySeoRule,seoChecks,sectionRecords,SeoError} from './public/seo-data.js';
import {videoFileId,videoSourceType} from './public/video-data.js';
export {SeoError};
const locales=['es','en','de','fr','it','sv','hu','hr','ru','zh-TW','ja'];
const imageId=row=>typeof row.image==='string'?row.image:row.image?.id||null;
const recordFields=['id','status','sort','title','detail','credit','category','youtube_id','date','ensemble','venue','city','url','ticket_status'];
export const publicSeoRule=rule=>Object.fromEntries(['id','locked','protected_keywords','required_keywords','revision','updated_at'].filter(key=>rule[key]!==undefined).map(key=>[key,rule[key]]));
export function sectionFingerprint(section,content){
 const texts=content.site_texts||[],records=sectionRecords(section,content),collection=section.collection||(section.id==='home'?'albums':null);
 const keys=[...new Set([...section.fields.map(field=>field.key),...records.flatMap(row=>['title','detail','ensemble','venue','city'].map(field=>`content:${collection}:${row.id}:${field}`))])].sort();
 const snapshot={texts:keys.map(key=>[key,locales.map(locale=>{
  const row=texts.find(row=>row.key===key&&row.locale===locale),field=section.fields.find(field=>field.key===key);
  return [locale,row?.value??(locale==='es'?field?.source:field?.localizations?.[locale])??null,row?.status||'published'];
 })]),records:records.map(row=>({...Object.fromEntries(recordFields.map(field=>[field,row[field]??null])),image:imageId(row),...(videoSourceType(row)==='upload'?{source_type:'upload',video_file:videoFileId(row)}:{})})),images:(content.site_images||[]).filter(row=>section.image&&row.key===section.image).sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(row=>({id:row.id,key:row.key,title:row.title,status:row.status,sort:row.sort??null,image:imageId(row)}))};
 return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}
export function assertSeoMutation(rules,sections,before,after,{touchedKeys=[]}={}){
 for(const rule of rules){
  const section=sections.find(section=>section.id===rule.id);if(!section)continue;
  const changed=sectionFingerprint(section,before)!==sectionFingerprint(section,after);
  const shared=touchedKeys.some(key=>section.fields.some(field=>field.key===key)||sectionRecords(section,before).some(row=>key.startsWith(`content:${section.collection||(section.id==='home'?'albums':'')}:${row.id}:`)));
  if(rule.locked&&(changed||shared))throw new SeoError(`«${section.title}» está fijada en SEO. Desbloquea esa sección para modificar sus textos, traducciones, imágenes u orden.`,423);
  if(changed){const missing=seoChecks(rule,section,after).protected.filter(row=>!row.present);if(missing.length)throw new SeoError(`Conserva las palabras protegidas de «${section.title}»: ${missing.map(row=>row.keyword).join(', ')}.`,409);}
 }
}
export function assertSeoPublication(rules,sections,content){
 for(const rule of rules){
  const section=sections.find(section=>section.id===rule.id);if(!section)continue;
  if(rule.locked&&rule.locked_hash!==sectionFingerprint(section,content))throw new SeoError(`La sección fijada «${section.title}» cambió fuera del Studio. Revisa su contenido y su bloqueo SEO antes de actualizar la vista previa.`,409);
  const checks=seoChecks(rule,section,content),missing=[...checks.protected,...checks.required].filter(row=>!row.present);
  if(missing.length)throw new SeoError(`SEO pendiente en «${section.title}». Incorpora al texto español: ${[...new Set(missing.map(row=>row.keyword))].join(', ')}.`,409);
 }
}
export function seoRuleFor(rules,id){return rules.find(rule=>rule.id===id)||emptySeoRule(id);}
