import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createStudioServer } from './server.mjs';

async function setup(t, overrides = {}) {
 const calls=[];
 const upstream=http.createServer(async(req,res)=>{
  const chunks=[];for await(const part of req)chunks.push(part);
  const body=Buffer.concat(chunks).toString();
  calls.push({path:req.url,method:req.method,authorization:req.headers.authorization,body});
  res.setHeader('Content-Type','application/json');
  if(req.url==='/auth/login')return res.end(JSON.stringify({data:{access_token:'private-access',refresh_token:'private-refresh',expires:900000}}));
  if(req.url.startsWith('/users/me'))return res.end(JSON.stringify({data:{id:'owner',email:overrides.cmsEmail || 'owner@example.test',first_name:'Owner'}}));
  if(req.url==='/permissions/me')return res.end(JSON.stringify({data:{gallery:{update:{access:overrides.readOnly?'none':'full'}}}}));
  if(req.url==='/api/auth/login')return res.end(JSON.stringify({token:'private-crm-token',user:{tenantId:overrides.returnedTenant||'tenant-nathalie',email:'artist@example.test',name:'Artist'}}));
  if(req.url==='/api/auth/me')return res.end(JSON.stringify({user:{tenantId:overrides.returnedTenant||'tenant-nathalie',email:'artist@example.test'}}));
  if(req.url==='/api/pipelines')return res.end(JSON.stringify([{id:'pipeline-1',name:'Artistic proposals'}]));
  if(req.url==='/api/pipelines/pipeline-1')return res.end(JSON.stringify({id:'pipeline-1',name:'Artistic proposals',stages:[{id:'stage-1',name:'New proposal',position:0}]}));
  if(req.url==='/api/clients')return res.end(JSON.stringify(req.method==='POST'?{id:'contact-1',...JSON.parse(body)}:[]));
  if(req.url.startsWith('/items/'))return res.end(JSON.stringify({data:req.method==='GET'?[{id:'photo-1',title:'Photo',status:'draft'}]:{id:'saved'}}));
  if(req.url==='/hook')return res.end(JSON.stringify({job:{state:'PENDING'}}));
  res.statusCode=404;res.end('{}');
 });
 upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const provider=`http://127.0.0.1:${upstream.address().port}`;
 const server=createStudioServer({cms:provider,crm:provider+'/api',secret:'test-session-secret-with-more-than-32-characters',secure:false,publishHook:provider+'/hook',...overrides});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const origin=`http://127.0.0.1:${server.address().port}`;
 t.after(()=>{server.closeAllConnections();upstream.closeAllConnections();server.close();upstream.close();});
 const request=(path,options={})=>fetch(origin+path,options);
 async function login(mode='cms') {
  const response=await request('/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'owner@example.test',password:'private-password',mode})});
  return {response,cookie:response.headers.get('set-cookie')?.split(';')[0]};
 }
 return {request,login,origin,calls};
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
