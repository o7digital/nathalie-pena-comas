import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from '@astrojs/compiler';
import siteMap from './site-map.json' with {type:'json'};

test('the editorial map includes current artist copy, navigation, recordings, assistant and privacy page',()=>{
 const fields=new Map(siteMap.sections.flatMap(section=>section.fields.map(field=>[field.key,field])));
 for(const key of ['copy:Nathalie','copy:Peña-Comas','copy:Quinto Elemento:','copy:Tierra','copy:Donna Anna / Don Giovanni','copy:Sombras Nada Más','copy:Esclavo y Amo','copy:Media','copy:YouTube','copy:© 2026 NATHALIE PEÑA-COMAS','olivia:greeting','olivia:consent','olivia:privacyDetails'])assert(fields.has(key),`Missing editorial text: ${key}`);
 assert.equal(siteMap.sourceLocale,'es');
 assert.equal(siteMap.sections.find(section=>section.id==='privacy').page,'privacy');
 for(const section of siteMap.sections){assert.equal(new Set(section.fields.map(field=>field.key)).size,section.fields.length);assert(section.fields.every(field=>typeof field.source==='string'&&typeof field.label==='string'));}
 // Seed each assistant language from its actual existing copy, not an English fallback.
 const greeting=fields.get('olivia:greeting');assert.match(greeting.localizations.fr,/Bonjour/);assert.match(greeting.localizations.es,/Hola/);assert.equal(Object.keys(greeting.localizations).length,11);
});

test('homepage and privacy editorial text does not bypass the content editor',async()=>{
 const components=['Hero','Story','International','Releases','Schedule','Repertoire','Videos','Editorial','Spirituosi','Gallery','Newsletter','Footer','Header','Dialogs','Privacy'];
 const uneditable=[];
 for(const name of components){
  const {ast}=await parse(await readFile(new URL(`../../src/components/${name}.astro`,import.meta.url),'utf8'));
  function walk(node,parents=[]){
   if(node.type==='text'&&node.value.trim()&&/\p{L}/u.test(node.value)&&parents.at(-1)?.type!=='expression'&&!parents.some(p=>['script','style'].includes(p.name)))uneditable.push(`${name}: ${node.value.trim()}`);
   for(const child of node.children||[])walk(child,[...parents,node]);
  }
  walk(ast);
 }
 assert.deepEqual(uneditable,[],'Visible copy must use the localizer or a CMS collection.');
});
