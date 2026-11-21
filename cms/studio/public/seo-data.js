export class SeoError extends Error{constructor(message,status=409){super(message);this.status=status;}}
export const emptySeoRule=id=>({id,locked:false,protected_keywords:[],required_keywords:[],revision:0});
const normalize=value=>String(value).normalize('NFKC').toLocaleLowerCase('es').replace(/\s+/gu,' ').trim();
export function plainSeoText(value){
 return String(value??'').replace(/<[^>]*>/g,' ').replace(/&(?:#(\d+)|#x([a-f\d]+)|amp|lt|gt|quot|apos|nbsp);/gi,(match,decimal,hex)=>{
  if(decimal||hex){const code=parseInt(decimal||hex,hex?16:10);return code>0&&code<=0x10ffff?String.fromCodePoint(code):' ';}
  return ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '})[match.toLowerCase()]||' ';
 }).replace(/\s+/gu,' ').trim();
}
export function keywordPresent(text,keyword){
 const source=normalize(plainSeoText(text)),term=normalize(keyword),word=character=>Boolean(character&&/[\p{L}\p{N}_]/u.test(character));
 if(!term)return false;
 let offset=0,index;
 while((index=source.indexOf(term,offset))!==-1){
  const before=[...source.slice(0,index)].at(-1),after=[...source.slice(index+term.length)][0];
  if(!(word([...term][0])&&word(before))&&!(word([...term].at(-1))&&word(after)))return true;
  offset=index+term.length;
 }
 return false;
}
export function validateSeoInput(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['locked','protected_keywords','required_keywords','revision'].includes(key))||typeof input.locked!=='boolean'||!Number.isSafeInteger(input.revision)||input.revision<0)throw new SeoError('Revisa la configuración SEO.',400);
 const result={locked:input.locked,revision:input.revision};
 for(const key of ['protected_keywords','required_keywords']){
  if(!Array.isArray(input[key])||input[key].length>30||input[key].some(value=>typeof value!=='string'||!value.trim()||value.length>120||/[<>\r\n]/.test(value)))throw new SeoError('Añade hasta 30 palabras o expresiones por lista, una por línea y sin etiquetas HTML.',400);
  const seen=new Set();result[key]=input[key].map(value=>value.replace(/\s+/gu,' ').trim()).filter(value=>{const key=normalize(value);if(seen.has(key))return false;seen.add(key);return true;});
 }
 return result;
}
export function sectionRecords(section,content){
 if(section.collection)return [...(content[section.collection]||[])].sort((a,b)=>(a.sort||0)-(b.sort||0)||String(a.id).localeCompare(String(b.id)));
 if(section.id==='home')return [...(content.albums||[])].filter(row=>row.status==='published').sort((a,b)=>(a.sort||0)-(b.sort||0)||String(a.id).localeCompare(String(b.id))).slice(0,1);
 return [];
}
export function sectionSeoText(section,content){
 const rows=content.site_texts||[],values=section.fields.filter(field=>!field.auxiliary).map(field=>rows.find(row=>row.key===field.key&&row.locale==='es'&&row.status==='published')?.value??field.source);
 for(const row of sectionRecords(section,content).filter(row=>row.status==='published'))for(const field of ['title','detail','credit','ensemble','venue','city'])if(row[field])values.push(row[field]);
 return values.map(plainSeoText).join('\n');
}
export function seoChecks(rule,section,content){
 const text=sectionSeoText(section,content);
 return {protected:rule.protected_keywords.map(keyword=>({keyword,present:keywordPresent(text,keyword)})),required:rule.required_keywords.map(keyword=>({keyword,present:keywordPresent(text,keyword)}))};
}
export function proposedContent(content,{texts=[],record,reorder}={}){
 const next={...content,site_texts:[...(content.site_texts||[])]};
 for(const source of texts){const index=next.site_texts.findIndex(row=>row.key===source.key&&row.locale===(source.locale||'es')),row={...(index<0?{}:next.site_texts[index]),...source,locale:source.locale||'es'};if(index<0)next.site_texts.push(row);else next.site_texts[index]=row;}
 if(record){const {collection,id,data}=record;next[collection]=[...(content[collection]||[])];const index=next[collection].findIndex(row=>row.id===id),row={...(index<0?{}:next[collection][index]),...data,id};if(index<0)next[collection].push(row);else next[collection][index]=row;}
 if(reorder)next[reorder.collection]=(next[reorder.collection]||[]).map(row=>reorder.ids.includes(row.id)?{...row,sort:reorder.ids.indexOf(row.id)}:row);
 return next;
}
