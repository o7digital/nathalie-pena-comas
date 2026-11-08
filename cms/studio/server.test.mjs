import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createStudioServer } from './server.mjs';
import siteMap from './site-map.json' with {type:'json'};
import {targetLocales,sourceHash} from './translations.mjs';

async function setup(t, overrides = {}) {
 const reportingRows=[];const calls=[];const texts=structuredClone(overrides.texts||[]);const translationCalls=[];
 const upstream=http.createServer(async(req,res)=>{
  const chunks=[];for await(const part of req)chunks.push(part);
  const body=Buffer.concat(chunks).toString();
  calls.push({path:req.url,method:req.method,authorization:req.headers.authorization,body});
  res.setHeader('Content-Type','application/json');
  if(req.url==='/auth/login')return res.end(JSON.stringify({data:{access_token:'private-access',refresh_token:'private-refresh',expires:900000}}));
  if(req.url.startsWith('/users/me'))return res.end(JSON.stringify({data:{id:'owner',email:overrides.cmsEmail || 'owner@example.test',first_name:'Owner'}}));
  if(req.url==='/permissions/me')return res.end(JSON.stringify({data:Object.fromEntries(['gallery','albums','videos','concerts','site_images','site_texts','studio_reporting'].map(collection=>[collection,{read:{access:overrides.reportingReadDenied&&collection==='studio_reporting'?'none':'full',fields:['*']},create:{access:overrides.readOnly?'none':'full',fields:['*']},update:{access:overrides.readOnly?'none':'full',fields:['*']}}]))}));
  if(req.url==='/api/auth/login')return res.end(JSON.stringify({token:'private-crm-token',user:{tenantId:overrides.returnedTenant||'tenant-nathalie',email:'artist@example.test',name:'Artist'}}));
  if(req.url==='/api/auth/me')return res.end(JSON.stringify({user:{tenantId:overrides.returnedTenant||'tenant-nathalie',email:'artist@example.test'}}));
  if(req.url==='/api/pipelines')return res.end(JSON.stringify([{id:'pipeline-1',name:'Artistic proposals'}]));
  if(req.url==='/api/pipelines/pipeline-1')return res.end(JSON.stringify({id:'pipeline-1',name:'Artistic proposals',stages:[{id:'stage-1',name:'New proposal',position:0}]}));
  if(req.url==='/api/clients')return res.end(JSON.stringify(req.method==='POST'?{id:'contact-1',...JSON.parse(body)}:[]));
  if(req.url.startsWith('/items/studio_reporting')){
   if(req.method==='GET')return res.end(JSON.stringify({data:reportingRows}));
   for(const row of JSON.parse(body)){const previous=reportingRows.find(r=>r.id===row.id);if(previous)Object.assign(previous,row);else reportingRows.push(row);}return res.end(JSON.stringify({data:JSON.parse(body)}));
  }
  if(req.url==='/api/tenant/reporting-plan')return res.end(JSON.stringify({amountMinor:1250,currency:'USD',automaticBilling:false}));
  if(req.url.startsWith('/items/site_texts')){
   if(req.method==='GET')return res.end(JSON.stringify({data:req.url.includes('/site_texts/')?texts.find(row=>row.id===req.url.split('/').at(-1).split('?')[0]):texts}));
   const rows=JSON.parse(body);for(const row of Array.isArray(rows)?rows:[rows]){const current=texts.find(value=>value.id===row.id);if(current)Object.assign(current,row);else texts.push(row);}return res.end(JSON.stringify({data:rows}));
  }
  if(/^\/items\/[^/?]+\//.test(req.url)&&req.method==='GET')return res.end(JSON.stringify({data:{id:'photo-1',title:'Photo',status:'draft'}}));
  if(req.url.startsWith('/items/'))return res.end(JSON.stringify({data:req.method==='GET'?[{id:'photo-1',title:'Photo',status:'draft'}]:{id:'saved'}}));
  if(req.url==='/hook')return res.end(JSON.stringify({job:{state:'PENDING'}}));
  res.statusCode=404;res.end('{}');
 });
 upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const provider=`http://127.0.0.1:${upstream.address().port}`;
 const server=createStudioServer({cms:provider,crm:provider+'/api',secret:'test-session-secret-with-more-than-32-characters',secure:false,publishHook:provider+'/hook',translate:async sources=>{translationCalls.push(sources);return Object.fromEntries(targetLocales.map(locale=>[locale,Object.fromEntries(sources.map(row=>[row.key,locale+': '+row.value]))]));},...overrides});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin=`http://127.0.0.1:${server.address().port}`;
 t.after(()=>{server.closeAllConnections();upstream.closeAllConnections();server.close();upstream.close();});
 const request=(path,options={})=>fetch(origin+path,options);
 async function login(mode='cms') {
  const response=await request('/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'owner@example.test',password:'private-password',mode})});
  return {response,cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 return {request,login,origin,calls,texts,translationCalls};
}

test('the private studio serves its login but never exposes server files or unauthenticated content',async t=>{
 const {request}=await setup(t);
 const page=await request('/');assert.equal(page.status,200);assert.match(await page.text(),/Tu universo/);
 assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 assert.equal((await request('/server.mjs')).status,404);
 assert.equal((await request('/api/content')).status,401);
 assert.equal((await request('/api/image/00000000-0000-4000-a000-000000000000')).status,401);
 assert.equal((await request('/api/session',{headers:{Cookie:'npc_studio=forged'}})).status,401);
});

test('login stores encrypted HttpOnly cookies and only whitelisted content can be changed',async t=>{
 const {request,login,origin,calls}=await setup(t);
 const {response,cookie}=await login();assert.equal(response.status,200);
 assert.match(response.headers.get('set-cookie'),/HttpOnly/);assert.match(response.headers.get('set-cookie'),/SameSite=Strict/);
 assert.doesNotMatch(cookie,/private-access|private-refresh|private-password/);
 assert.deepEqual(await response.json(),{ok:true});
 assert.equal((await request('/api/content',{headers:{Cookie:cookie}})).status,200);
 const write=body=>request('/api/content/gallery/photo-1',{method:'PATCH',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await write({title:'A real edit',status:'draft'})).status,200);
 assert.equal((await write({title:'No',tenantId:'another-customer'})).status,400);
 assert.equal((await request('/api/content/directus_users',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:'{}'})).status,404);
 assert(calls.some(call=>call.method==='PATCH'&&call.body.includes('A real edit')));
});

test('cross-origin mutations are rejected before the CMS is changed',async t=>{
 const {request,login,calls}=await setup(t);const {cookie}=await login();
 const response=await request('/api/content/gallery/photo-1',{method:'PATCH',headers:{Cookie:cookie,Origin:'https://unrelated.example','Content-Type':'application/json'},body:JSON.stringify({title:'Must not save'})});
 assert.equal(response.status,403);assert(!calls.some(call=>call.method==='PATCH'));
});

test('read-only identities cannot trigger a preview rebuild',async t=>{
 const {request,login,origin,calls}=await setup(t,{readOnly:true});const {cookie}=await login();
 const response=await request('/api/publish',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:'{}'});
 assert.equal(response.status,403);assert(!calls.some(call=>call.path==='/hook'));
});

test('publishing uses the configured preview hook without returning credentials',async t=>{
 const {request,login,origin,calls}=await setup(t);const {cookie}=await login();
 const response=await request('/api/publish',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:'{}'});
 assert.equal(response.status,200);const result=await response.text();assert.doesNotMatch(result,/private-access|private-refresh/);
 assert(calls.some(call=>call.path==='/hook'&&call.method==='POST'&&!call.authorization));
});

test('ARM login rejects another customer tenant and never grants CMS access',async t=>{
 const {login}=await setup(t,{tenant:'tenant-nathalie',editorToken:'private-editor-token',returnedTenant:'tenant-someone-else'});
 const {response,cookie}=await login('arm');assert.equal(response.status,403);assert.equal(cookie,undefined);
});

test('ARM login binds CMS access to the verified Nathalie workspace',async t=>{
 const {request,login,calls}=await setup(t,{tenant:'tenant-nathalie',editorToken:'private-editor-token'});
 const {response,cookie}=await login('arm');assert.equal(response.status,200);
 const content=await request('/api/content',{headers:{Cookie:cookie}});assert.equal(content.status,200);
 assert(calls.some(call=>call.path.startsWith('/items/')&&call.authorization==='Bearer private-editor-token'));
 assert(calls.filter(call=>call.path==='/api/auth/me').length>=2);
 assert.doesNotMatch(await content.text(),/private-editor-token|private-crm-token/);
});

test('ARM remains explicitly unavailable before a tenant is linked',async t=>{
 const {request,login,origin}=await setup(t);const config=await(await request('/api/config')).json();assert.equal(config.armReady,false);
 const {cookie}=await login();
 const response=await request('/api/arm/connect',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:'{}'});
 assert.equal(response.status,409);
});

test('ARM loads real pipeline stage definitions and prevents tenant injection on contact creation',async t=>{
 const {request,login,origin,calls}=await setup(t,{tenant:'tenant-nathalie',editorToken:'private-editor-token'});
 const {cookie}=await login('arm');
 const pipelines=await request('/api/arm/pipelines',{headers:{Cookie:cookie}});
 assert.equal(pipelines.status,200);assert.equal((await pipelines.json())[0].stages[0].name,'New proposal');
 const create=body=>request('/api/arm/clients',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await create({name:'A professional contact',email:'contact@example.test'})).status,200);
 assert.equal((await create({name:'Injected',tenantId:'another-tenant'})).status,400);
 assert(!calls.some(call=>call.path==='/api/clients'&&call.body.includes('another-tenant')));
 assert(calls.some(call=>call.path==='/api/clients'&&call.authorization==='Bearer private-crm-token'));
});

test('the designated CMS administrator receives tenant-scoped ARM access without changing their CRM account',async t=>{
 const {request,login,calls}=await setup(t,{tenant:'tenant-nathalie',editorToken:'private-editor-token',adminEmail:'owner@example.test',serviceEmail:'connector@example.test',servicePassword:'private-service-password',includedUntil:'2027-11-08T00:00:00.000Z'});
 const {cookie}=await login();
 const session=await(await request('/api/session',{headers:{Cookie:cookie}})).json();assert.equal(session.armConnected,true);
 const contacts=await request('/api/arm/clients',{headers:{Cookie:cookie}});assert.equal(contacts.status,200);
 assert(calls.some(call=>call.path==='/api/auth/login'&&JSON.parse(call.body).email==='connector@example.test'));
 assert(calls.some(call=>call.path==='/users/me?fields=id,email'));
 assert(calls.some(call=>call.path==='/api/clients'&&call.authorization==='Bearer private-crm-token'));
 const publicConfig=await(await request('/api/config')).text();assert.match(publicConfig,/2027-11-08/);
 assert.doesNotMatch(publicConfig+JSON.stringify(session)+cookie,/private-service-password|connector@example.test|private-crm-token/);
});

test('another CMS editor cannot use the administrator ARM connector',async t=>{
 const {request,login,calls}=await setup(t,{tenant:'tenant-nathalie',editorToken:'private-editor-token',adminEmail:'different@example.test',serviceEmail:'connector@example.test',servicePassword:'private-service-password'});
 const {cookie}=await login();
 assert.equal((await(await request('/api/session',{headers:{Cookie:cookie}})).json()).armConnected,false);
 assert.equal((await request('/api/arm/clients',{headers:{Cookie:cookie}})).status,401);
 assert(!calls.some(call=>call.path==='/api/auth/login'||call.path==='/api/clients'));
});

test('delegated ARM access rejects a service account in another tenant',async t=>{
 const {request,login,calls}=await setup(t,{tenant:'tenant-nathalie',editorToken:'private-editor-token',adminEmail:'owner@example.test',serviceEmail:'connector@example.test',servicePassword:'private-service-password',returnedTenant:'other-customer'});
 const {cookie}=await login();
 assert.equal((await request('/api/arm/clients',{headers:{Cookie:cookie}})).status,403);
 assert(!calls.some(call=>call.path==='/api/clients'));
});


test('section editing is Spanish-first and updates all ten translations together',async t=>{
 const field=siteMap.sections.find(row=>row.id==='about').fields.find(row=>!row.auxiliary);
 const {request,login,origin,texts,translationCalls}=await setup(t,{texts:[{id:'spanish-1',key:field.key,locale:'es',value:field.source,status:'published'}]});
 const {cookie}=await login();
 const save=value=>request('/api/sections/about',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({texts:[{key:field.key,value}]})});
 const response=await save('Un nuevo texto en español.');assert.equal(response.status,200);assert.equal((await response.json()).translatedLanguages,10);
 assert.equal(texts.length,11);assert(texts.every(row=>row.source_hash===sourceHash('Un nuevo texto en español.')));assert.equal(texts.find(row=>row.locale==='fr').value,'fr: Un nuevo texto en español.');
 assert.equal((await(await save('Un nuevo texto en español.')).json()).changed,0);assert.equal(translationCalls.length,1);
 const retry=await request('/api/sections/about',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({force:true,texts:[{key:field.key,value:'Un nuevo texto en español.'}]})});assert.equal(retry.status,200);assert.equal(translationCalls.length,2);
 assert.equal((await request('/api/site-map',{headers:{Cookie:cookie}})).status,200);
 const french=texts.find(row=>row.locale==='fr');
 assert.equal((await request('/api/content/site_texts/'+french.id,{method:'PATCH',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({value:'Manual overwrite'})})).status,400);
});

test('a translation failure retains the previous Spanish text and does not write partial changes',async t=>{
 const field=siteMap.sections.find(row=>row.id==='about').fields.find(row=>!row.auxiliary);
 const {request,login,origin,calls,texts}=await setup(t,{texts:[{id:'spanish-1',key:field.key,locale:'es',value:field.source,status:'published'}],translate:async()=>{throw new Error('Translator unavailable');}});
 const {cookie}=await login();
 const response=await request('/api/sections/about',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({texts:[{key:field.key,value:'Do not partially save this'}]})});
 assert.equal(response.status,503);assert.equal(texts[0].value,field.source);assert(!calls.some(row=>row.path.startsWith('/items/')&&row.method!=='GET'));
});

test('section edits reject unrelated fields and read-only accounts cannot consume translations',async t=>{
 const field=siteMap.sections.find(row=>row.id==='about').fields[0];
 const {request,login,origin,translationCalls}=await setup(t,{readOnly:true});const {cookie}=await login();
 const save=texts=>request('/api/sections/about',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({texts})});
 assert.equal((await save([{key:'unrelated-key',value:'No'}])).status,400);
 assert.equal((await save([{key:field.key,value:'No'}])).status,403);assert.equal(translationCalls.length,0);
});

test('incomplete translations prevent a preview deployment',async t=>{
 const key='copy:Test headline',texts=[{id:'es',key,locale:'es',value:'Original español',status:'published',source_hash:sourceHash('Original español')}];
 const {request,login,origin,calls}=await setup(t,{texts});const {cookie}=await login();
 const response=await request('/api/publish',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:'{}'});
 assert.equal(response.status,409);assert(!calls.some(row=>row.path==='/hook'));
});

test('whole-section translation is batched and keeps all eleven locales coherent',async t=>{
 const {request,login,origin,texts,translationCalls}=await setup(t);
 const {cookie}=await login();
 const section=siteMap.sections.find(section=>section.id==='settings');
 assert(section.fields.length>40);
 const input=section.fields.map(field=>({key:field.key,value:field.source}));
 const response=await request('/api/sections/settings',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({force:true,texts:input})});
 assert.equal(response.status,200);assert.equal((await response.json()).translatedLanguages,10);
 assert(translationCalls.length>1);assert(translationCalls.every(batch=>batch.length<=16));
 for(const source of input){const bundle=texts.filter(row=>row.key===source.key);assert.equal(bundle.length,11);assert(bundle.every(row=>row.source_hash===sourceHash(source.value)));}
});

test('a failure in the final translation batch never persists earlier batches or the new Spanish original',async t=>{
 let calls=0;
 const {request,login,origin,texts}=await setup(t,{translate:async sources=>{
  if(++calls===2)throw new Error('Translation unavailable');
  return Object.fromEntries(targetLocales.map(locale=>[locale,Object.fromEntries(sources.map(source=>[source.key,locale+': '+source.value]))]));
 }});
 const {cookie}=await login();
 const section=siteMap.sections.find(section=>section.id==='settings');
 const response=await request('/api/sections/settings',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({force:true,texts:section.fields.map(field=>({key:field.key,value:field.source}))})});
 assert.equal(response.status,503);assert.equal(calls,2);assert.equal(texts.length,0);
});


test('reporting imports require the designated verified administrator and reads require explicit permission',async t=>{
 const {request,login,origin,calls}=await setup(t,{editorToken:'editor-token',adminEmail:'owner@example.test',cmsEmail:'editor@example.test'});
 assert.equal((await request('/api/reporting?start=2026-11-01&end=2026-11-02')).status,401);
 const {cookie}=await login();
 const response=await request('/api/reporting/import',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({provider:'instagram',csv:'invalid',source:'Export'})});
 assert.equal(response.status,403);assert(!calls.some(c=>c.path==='/items/studio_reporting'&&c.method==='POST'));
 const denied=await setup(t,{editorToken:'editor-token',reportingReadDenied:true});const noRead=await denied.login();
 assert.equal((await denied.request('/api/reporting?start=2026-11-01&end=2026-11-02',{headers:{Cookie:noRead.cookie}})).status,403);
});

test('owner reporting imports persist and repeated imports update stable IDs; exports remain private',async t=>{
 const {request,login,origin,calls}=await setup(t,{editorToken:'editor-token',adminEmail:'owner@example.test'});const {cookie}=await login();
 const headers={Cookie:cookie,Origin:origin,'Content-Type':'application/json'};
 const input={provider:'apple-music',source:'Distributor',csv:'date,channel,metric,value,currency\n2026-11-01,Apple Music,royalties,20,EUR'};
 for(const amount of [20,30])assert.equal((await request('/api/reporting/import',{method:'POST',headers,body:JSON.stringify({...input,csv:input.csv.replace(',20,',','+amount+',')})})).status,200);
 const report=await (await request('/api/reporting?start=2026-11-01&end=2026-11-02',{headers})).json();
 assert.equal(report.rows.length,1);assert.equal(report.rows[0].value,30);assert.equal(report.rows[0].currency,'EUR');
 assert.equal(calls.filter(c=>c.path==='/items/studio_reporting'&&c.method==='POST').length,1);
 assert.equal(calls.filter(c=>c.path==='/items/studio_reporting'&&c.method==='PATCH').length,1);
 const csv=await request('/api/reporting/export?start=2026-11-01&end=2026-11-02',{headers});assert.match(csv.headers.get('content-type'),/text\/csv/);assert.match(await csv.text(),/EUR/);
 assert.equal((await request('/api/reporting/import',{method:'POST',headers:{...headers,Origin:'https://malicious.test'},body:JSON.stringify(input)})).status,403);
 assert.equal((await request('/api/reporting?start=bad&end=2026-11-02',{headers})).status,400);
});

test('the subscription view uses the bound CRM tenant and never accepts billing mutations',async t=>{
 const {request,login,origin}=await setup(t,{tenant:'tenant-nathalie',editorToken:'editor-token',adminEmail:'owner@example.test',serviceEmail:'technical@example.test',servicePassword:'server-secret'});const {cookie}=await login();const headers={Cookie:cookie,Origin:origin};
 const result=await request('/api/subscription',{headers});assert.equal(result.status,200);assert.deepEqual(await result.json(),{amountMinor:1250,currency:'USD',automaticBilling:false});
 assert.equal((await request('/api/subscription',{method:'PATCH',headers,body:'{}'})).status,404);
});
