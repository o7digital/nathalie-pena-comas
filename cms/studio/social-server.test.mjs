import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {once} from 'node:events';
import {createStudioServer} from './server.mjs';import {SOCIAL_MEDIA_FOLDER,verifyMediaLease} from './social-media.mjs';
const mediaId='00000000-0000-4000-a000-000000000001',secret='private-native-social-server-test-secret-32';
async function setup(t,email='owner@example.test'){
 const calls=[];
 const backend=http.createServer(async(req,res)=>{
  let text='';for await(const bytes of req)text+=bytes.toString();const body=text?JSON.parse(text):null;
  calls.push({path:req.url,method:req.method,authorization:req.headers.authorization,body});res.setHeader('Content-Type','application/json');
  let result;
  if(req.url==='/auth/login')result={data:{access_token:'cms-private',refresh_token:'cms-refresh',expires:900000}};
  else if(req.url.startsWith('/users/me'))result={data:{email,first_name:'Test'}};
  else if(req.url==='/arm/auth/login')result={token:'arm-private',user:{tenantId:'client-a',email:'technical@example.test'}};
  else if(req.url==='/arm/auth/me')result={user:{tenantId:'client-a'}};
  else if(req.url.startsWith('/files/'))result={data:{id:mediaId,type:'image/jpeg',filesize:'10',folder:SOCIAL_MEDIA_FOLDER,width:1440,height:1440,modified_on:'2026-11-08T00:00:00Z'}};
  else if(req.url==='/assets/'+mediaId){res.setHeader('Content-Type','image/jpeg');const range=req.headers.range;if(range){res.statusCode=206;res.setHeader('Content-Range','bytes 0-9/10');}res.setHeader('Content-Length','10');return res.end(Buffer.alloc(10));}
  else if(req.url==='/arm/social')result={posts:[],channels:[],providers:[],offer:{enabled:true}};
  else if(req.url==='/arm/social/posts/post-1'&&req.method==='GET')result={id:'post-1',version:1,media:{id:mediaId}};
  else if(req.url==='/arm/social/posts/post-1/approve')result={id:'post-1',status:'SCHEDULED'};
  else if(req.url==='/arm/social/posts')result={id:'post-1',...body,version:1,status:'DRAFT'};
  else if(req.url==='/arm/social/oauth/meta/start')result={authorizationUrl:'https://www.facebook.com/dialog/oauth?state=fixture'};
  else if(req.url==='/arm/social/oauth/complete')result={attemptId:'attempt-fixture',candidates:[]};
  else if(req.url==='/arm/social/posts/post-invalid/approve'){res.statusCode=400;result={message:'Choisissez une vidéo pour YouTube.'};}
  else{res.statusCode=404;result={error:'Unknown fixture endpoint'};}
  res.end(JSON.stringify(result));
 });backend.listen(0,'127.0.0.1');await once(backend,'listening');const base='http://127.0.0.1:'+backend.address().port;
 const server=createStudioServer({cms:base,crm:base+'/arm',secret,tenant:'client-a',editorToken:'cms-editor',adminEmail:'owner@example.test',serviceEmail:'technical@example.test',servicePassword:'private-service-password',origin:'https://studio.example.test',secure:false});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.closeAllConnections();server.close();backend.closeAllConnections();backend.close();});const url='http://127.0.0.1:'+server.address().port;
 const request=(path,options={})=>fetch(url+path,options);
 const login=await request('/api/login',{method:'POST',headers:{Origin:'https://studio.example.test','Content-Type':'application/json'},body:JSON.stringify({email,password:'fixture'})});
 const headers={Cookie:login.headers.get('set-cookie').split(';')[0],Origin:'https://studio.example.test','Content-Type':'application/json'};
 return {calls,headers,request};
}
test('native social BFF binds requests to the client service token and rejects unknown actions and foreign fields',async t=>{
 const {request,headers,calls}=await setup(t);
 assert.equal((await request('/api/social')).status,401);assert.equal((await request('/api/social',{headers})).status,200);
 assert.equal(calls.find(c=>c.path==='/arm/social').authorization,'Bearer arm-private');
 assert.equal((await request('/api/social/run-worker',{method:'POST',headers,body:'{}'})).status,404);
 assert.equal((await request('/api/social/posts',{method:'POST',headers,body:JSON.stringify({title:'Bad',media:{url:'https://attacker.test'}})})).status,400);
 assert.equal((await request('/api/social/posts',{method:'POST',headers,body:JSON.stringify({title:'Bad',tenantId:'foreign-client'})})).status,400);
 assert.equal((await request('/api/social/posts',{method:'POST',headers:{...headers,Origin:'https://attacker.test'},body:'{}'})).status,403);
 assert(!calls.some(c=>c.path==='/arm/social/posts'));
});
test('OAuth return addresses are pinned and unprivileged CMS editors cannot delegate social access',async t=>{
 const {request,headers,calls}=await setup(t);
 const response=await request('/api/social/oauth/meta/start',{method:'POST',headers,body:JSON.stringify({redirectUri:'https://attacker.test'})});assert.equal(response.status,200);
 assert.deepEqual(calls.find(c=>c.path==='/arm/social/oauth/meta/start').body,{redirectUri:'https://studio.example.test/social-callback.html'});
 const callback=await request('/social-callback.html');assert.equal(callback.status,200);assert.equal(callback.headers.get('referrer-policy'),'no-referrer');assert.match(callback.headers.get('content-security-policy'),/script-src 'self'/);
 const other=await setup(t,'another-editor@example.test');assert.equal((await other.request('/api/social',{headers:other.headers})).status,401);
});
test('approval renews only the saved media, with a future limited lease, and requires the current version',async t=>{
 const {request,headers,calls}=await setup(t),due=new Date(Date.now()+86400000).toISOString();
 const response=await request('/api/social/posts/post-1/approve',{method:'POST',headers,body:JSON.stringify({version:1,action:'SCHEDULE',scheduledAt:due})});assert.equal(response.status,200);
 const payload=calls.find(c=>c.path==='/arm/social/posts/post-1/approve').body;
 assert.equal(payload.media.id,mediaId);assert(!JSON.stringify(payload).includes('cms-editor'));
 const url=new URL(payload.media.url);assert.deepEqual(verifyMediaLease(secret,url,Date.parse(due)),{id:mediaId,version:url.searchParams.get('v')});assert.throws(()=>verifyMediaLease(secret,url,Date.now()));
 assert.equal((await request('/api/social/posts/post-1/approve',{method:'POST',headers,body:JSON.stringify({version:2,action:'NOW'})})).status,409);
 assert.equal((await request('/api/social/posts/post-1/approve',{method:'POST',headers,body:JSON.stringify({version:1,action:'NOW',media:{id:'other'}})})).status,400);
});
test('saved images produce signed capabilities; unsigned private previews remain authenticated and ranges are preserved',async t=>{
 const {request,headers}=await setup(t);
 const response=await request('/api/social/posts',{method:'POST',headers,body:JSON.stringify({title:'Fixture',text:'Text',mediaId,channelIds:[],options:{},clientKey:'key',timezone:'UTC'})});assert.equal(response.status,200);
 const post=await response.json();const signed=new URL(post.media.url);
 const local=signed.pathname+signed.search;
 assert.equal((await request(local,{headers:{Range:'bytes=0-9'}})).status,206);
 assert.equal((await request('/api/social/media-preview/'+mediaId)).status,401);
 assert.equal((await request('/api/social/media-preview/'+mediaId,{headers})).status,200);
 signed.searchParams.set('sig','x'.repeat(43));assert.equal((await request(signed.pathname+signed.search)).status,403);
});
