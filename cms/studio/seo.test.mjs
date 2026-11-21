import test from 'node:test';
import assert from 'node:assert/strict';
import {keywordPresent,plainSeoText,validateSeoInput,sectionSeoText,proposedContent,emptySeoRule} from './public/seo-data.js';
import {assertSeoMutation,assertSeoPublication,sectionFingerprint} from './seo.mjs';
const section={id:'about',title:'La artista',fields:[{key:'bio',source:'Una soprano dominicana en Viena.'}],image:'story'},sections=[section,{id:'home',title:'Inicio',fields:[{key:'bio',source:'Una soprano dominicana en Viena.'}],image:'hero'}];
const content={site_texts:[{id:'bio-es',key:'bio',locale:'es',status:'published',value:section.fields[0].source}],site_images:[{id:'story-image',key:'story',image:'old-image',status:'published'}],gallery:[],albums:[],videos:[],concerts:[]};
test('SEO matching handles inline markup, accents and word boundaries without matching substrings',()=>{
 assert.equal(plainSeoText('Nathalie &amp; <em>ópera</em> &#8212; Viena'),'Nathalie & ópera — Viena');
 assert(keywordPresent('Una SOPRANO <strong>dominicana</strong>.','soprano dominicana'));
 assert(keywordPresent('Nathalie Peña-Comas','Peña-Comas'));
 assert(!keywordPresent('operario','opera'));assert(!keywordPresent('sopranos','soprano'));assert(!keywordPresent('ópera','opera'));
 assert(!keywordPresent('',''));assert(!keywordPresent('otra artista','soprano'));
 const rule=validateSeoInput({locked:false,protected_keywords:['Soprano','soprano'],required_keywords:[],revision:0});assert.deepEqual(rule.protected_keywords,['Soprano']);
 for(const input of [{locked:'true'}, {locked:false,protected_keywords:['<script>'],required_keywords:[],revision:0},{locked:false,protected_keywords:[],required_keywords:[],revision:-1}])assert.throws(()=>validateSeoInput(input));
});
test('protected expressions survive section and individual text writes, and can move within their section',()=>{
 const rule={...emptySeoRule('about'),protected_keywords:['soprano dominicana']};
 const removed=proposedContent(content,{texts:[{key:'bio',value:'Una artista en Viena.',status:'published'}]});
 assert.throws(()=>assertSeoMutation([rule],sections,content,removed),/Conserva/);
 const preserved=proposedContent(content,{texts:[{key:'bio',value:'Una reconocida soprano dominicana en Viena.',status:'published'}]});assert.doesNotThrow(()=>assertSeoMutation([rule],sections,content,preserved));
});
test('frozen sections reject shared copy, forced translations and image changes; external drift blocks publishing',()=>{
 const rule={...emptySeoRule('about'),locked:true,locked_hash:sectionFingerprint(section,content)};
 assert.doesNotThrow(()=>assertSeoPublication([rule],sections,content));
 assert.throws(()=>assertSeoMutation([rule],sections,content,content,{touchedKeys:['bio']}),/fijada/);
 const changed=proposedContent(content,{texts:[{key:'bio',value:'Texto cambiado desde Inicio.',status:'published'}]});assert.throws(()=>assertSeoMutation([rule],sections,content,changed),/fijada/);
 const image=proposedContent(content,{record:{collection:'site_images',id:'story-image',data:{image:'new-image'}}});assert.throws(()=>assertSeoMutation([rule],sections,content,image),/fijada/);
 assert.throws(()=>assertSeoPublication([rule],sections,image),/fuera del Studio/);
});
test('collection locks cover drafts, archive, ordering and featured content; pending SEO ignores unpublished records',()=>{
 const gallery={id:'gallery',title:'Galería',fields:[],collection:'gallery'},before={...content,gallery:[{id:'a',title:'Recital en Viena',status:'published',sort:0,image:'old'},{id:'b',title:'Ensayo',status:'draft',sort:1}]};
 const lock={...emptySeoRule('gallery'),locked:true};
 for(const change of [{record:{collection:'gallery',id:'c',data:{title:'Foto',status:'draft'}}},{record:{collection:'gallery',id:'a',data:{status:'archived'}}},{reorder:{collection:'gallery',ids:['b','a']}}])assert.throws(()=>assertSeoMutation([lock],[gallery],before,proposedContent(before,change)),/fijada/);
 assert(!keywordPresent(sectionSeoText(gallery,before),'Ensayo'));
 const required={...emptySeoRule('gallery'),required_keywords:['Ensayo']};assert.throws(()=>assertSeoPublication([required],[gallery],before),/SEO pendiente/);
 const after=proposedContent(before,{record:{collection:'gallery',id:'b',data:{status:'published'}}});assert.doesNotThrow(()=>assertSeoPublication([required],[gallery],after));
});
