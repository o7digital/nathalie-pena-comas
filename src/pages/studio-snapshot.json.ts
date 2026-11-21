import {readContent,contentImage,localizedRecord} from '../lib/cms';
import {locales,localizer} from '../data/locales';
import {translations,type Locale} from '../data/translations';
import siteMap from '../../cms/studio/site-map.json';

// Build-time intermediate, consumed and removed by build-preview.mjs.
export async function GET(){
 const texts:Record<string,unknown[]>={},images:unknown[]=[];
 const content:Record<string,Awaited<ReturnType<typeof readContent>>>={};
 for(const collection of ['gallery','albums','videos','concerts','site_images'])content[collection]=await readContent(collection);
 for(const {code} of locales){
  const l=localizer(code),t=translations[code];
  texts[code]=siteMap.sections.flatMap(section=>section.fields.map(field=>({section:section.id,value:field.key.startsWith('translation:')?t[field.key.slice(12) as keyof typeof t]:l(field.source,field.english),target:{key:field.key}})));
  for(const collection of ['gallery','albums','videos','concerts'])for(const row of content[collection]||[]){
   for(const field of ['title','detail','credit','ensemble','venue','city'])if(row[field as keyof typeof row])texts[code].push({section:collection,value:localizedRecord(collection,row.id,field,code as Locale,String(row[field as keyof typeof row])),target:{collection,id:row.id,field}});
   if(collection==='albums')texts[code].push({section:'home',value:row.title,target:{collection,id:row.id,field:'title'}});
  }
 }
 for(const [collection,rows]of Object.entries(content))for(const row of rows||[])if(row.image){
  const section=collection==='site_images'?siteMap.sections.find(section=>section.image===row.key)?.id:collection;
  images.push({src:contentImage(row.image).src,section,collection,id:row.id});
  if(collection==='albums')images.push({src:contentImage(row.image).src,section:'home',collection,id:row.id});
 }
 return new Response(JSON.stringify({locales:locales.map(row=>row.code),texts,images}),{headers:{'Content-Type':'application/json','X-Robots-Tag':'noindex'}});
}
