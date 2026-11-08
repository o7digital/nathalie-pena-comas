import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { translateSpanish,targetLocales,sourceHash,textId,translationWrites,assertTranslationsReady } from './translations.mjs';

async function provider(t,transform=value=>value) {
 const calls=[];
 const server=http.createServer(async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const request=JSON.parse(Buffer.concat(chunks).toString());calls.push(request);
  const fields=JSON.parse(request.input).fields;
  const values=Object.fromEntries(targetLocales.map(locale=>[locale,Object.fromEntries(fields.map(row=>[row.id,transform(row.value)]))]));
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(values)}]}]}));
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.closeAllConnections();server.close();});
 return {endpoint:`http://127.0.0.1:${server.address().port}`,key:'test-provider-key',calls};
}

test('automatic translation preserves links, email addresses and inline formatting in every language',async t=>{
 const options=await provider(t),value='Hola <em>Nathalie</em>, visita https://example.test/music o escribe a booking@example.test.';
 const result=await translateSpanish([{key:'copy:Welcome',value}],options);
 assert.equal(Object.keys(result).length,10);
 for(const locale of targetLocales)assert.equal(result[locale]['copy:Welcome'],value);
 assert.equal(options.calls[0].store,false);assert.equal(options.calls[0].text.format.strict,true);
 assert(!options.calls[0].input.includes('booking@example.test')); // Protected values are restored locally.
});

test('a response that changes markup or protected placeholders is rejected',async t=>{
 const options=await provider(t,value=>value.replace('__KEEP_0__','<script>'));
 await assert.rejects(translateSpanish([{key:'copy:Title',value:'Hola <strong>Nathalie</strong>'}],options),/no es válida|alteró/);
});

test('empty values and contact addresses are copied exactly without an API call',async()=>{
 const result=await translateSpanish([{key:'email',value:'info@example.test'},{key:'empty',value:''}],{});
 assert.equal(result.fr.email,'info@example.test');assert.equal(result.ja.empty,'');
});

test('translation bundles use stable existing IDs and a hash of their Spanish original',()=>{
 const sources=[{key:'copy:Headline',value:'Un nuevo escenario',status:'published'}];
 const translated=Object.fromEntries(targetLocales.map(locale=>[locale,{'copy:Headline':'A new stage'}]));
 const rows=translationWrites(sources,translated,[{id:'existing-spanish',locale:'es',key:'copy:Headline'}]);
 assert.equal(rows.find(row=>row.locale==='es').id,'existing-spanish');
 assert.equal(rows.find(row=>row.locale==='fr').id,textId('copy:Headline','fr'));
 assert(rows.every(row=>row.source_hash===sourceHash(sources[0].value)));
 assert.doesNotThrow(()=>assertTranslationsReady(rows));
 rows.find(row=>row.locale==='fr').source_hash='outdated';assert.throws(()=>assertTranslationsReady(rows),/stale/);
});

test('media translations are checked against actual records, with inactive media ignored',()=>{
 const key='content:concerts:concert-1:title',sources=[{key,value:'Ensayo',status:'published'}];
 const translated=Object.fromEntries(targetLocales.map(locale=>[locale,{[key]:'Rehearsal'}]));
 const rows=translationWrites(sources,translated,[]);
 assert.doesNotThrow(()=>assertTranslationsReady(rows,{concerts:[{id:'concert-1',title:'Ensayo'}]}));
 assert.throws(()=>assertTranslationsReady(rows,{concerts:[{id:'concert-1',title:'Nuevo ensayo'}]}),/stale/);
 assert.doesNotThrow(()=>assertTranslationsReady(rows,{concerts:[]}));
});
