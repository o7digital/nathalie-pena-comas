import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createStudioServer} from './server.mjs';
import siteMap from './site-map.json' with {type:'json'};
import {targetLocales} from './translations.mjs';
const about=siteMap.sections.find(row=>row.id==='about'),headline=about.fields.find(row=>row.source==='Raíces latinas.');
async function setup(t,{readOnly=false}={}){
 const unique=[...new Map(siteMap.sections.flatMap(section=>section.fields).map(field=>[field.key,field])).values()];
 const content={site_texts:unique.map((field,index)=>({id:'text-'+index,key:field.key,locale:'es',value:field.source,status:'published'})),gallery:[],albums:[{id:'album-a',title:'Alta Gracia',status:'published',sort:0,image:'00000000-0000-4000-a000-000000000001'},{id:'album-b',title:'Una Mujer',status:'published',sort:1,image:'00000000-0000-4000-a000-000000000002'}],videos:[],concerts:[],site_images:[{id:'story',key:'story',title:'La artista',image:'00000000-0000-4000-a000-000000000001',status:'published'}],studio_seo:[]};
 const writes=[];let translations=0,hooks=0;
 const provider=http.createServer(async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const raw=Buffer.concat(chunks).toString(),body=raw?JSON.parse(raw):null,url=new URL(req.url,'http://test');
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  if(url.pathname==='/auth/login')return send(200,{data:{access_token:'private-access',refresh_token:'private-refresh',expires:900000}});
  if(url.pathname==='/users/me')return send(200,{data:{id:'owner',email:'owner@example.test'}});
  if(url.pathname==='/permissions/me')return send(200,{data:Object.fromEntries(Object.keys(content).map(key=>[key,Object.fromEntries(['read','create','update'].map(action=>[action,{access:readOnly&&action!=='read'?'none':'full',fields:['*']}]))]))});
  if(url.pathname==='/hook'){hooks++;return send(200,{});}
  const match=url.pathname.match(/^\/items\/([a-z_]+)(?:\/([^/]+))?$/);if(!match||!content[match[1]])return send(404,{});
  const [,collection,id]=match;
  if(req.method==='GET')return send(200,{data:id?content[collection].find(row=>row.id===id):content[collection]});
  writes.push({collection,id,method:req.method,body});
  const rows=Array.isArray(body)?body:[{...body,...(id?{id}:{})}];
  for(const row of rows){const current=content[collection].find(item=>item.id===row.id);if(current)Object.assign(current,row);else content[collection].push(row);}
  return send(200,{data:Array.isArray(body)?rows:rows[0]});
 });
 provider.listen(0,'127.0.0.1');await once(provider,'listening');const base='http://127.0.0.1:'+provider.address().port;
 const server=createStudioServer({cms:base,secret:'isolated-seo-server-test-secret-32-characters',publishHook:base+'/hook',translate:async sources=>{translations++;return Object.fromEntries(targetLocales.map(locale=>[locale,Object.fromEntries(sources.map(row=>[row.key,locale+': '+row.value]))]));}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
 t.after(()=>{server.closeAllConnections();server.close();provider.closeAllConnections();provider.close();});
 const login=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'owner@example.test',password:'private-password'})}),cookie=login.headers.get('set-cookie').split(';')[0];
 const request=(path,method='GET',body,extra={})=>fetch(origin+path,{method,headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)});
 const rule=(id,changes={})=>request('/api/seo/'+id,'POST',{locked:false,protected_keywords:[],required_keywords:[],revision:0,...changes});
 return {origin,request,rule,content,writes,translations:()=>translations,hooks:()=>hooks};
}
test('SEO settings are private, revision checked, permission checked and reject unrelated or absent protected words',async t=>{
 const s=await setup(t);assert.equal((await fetch(s.origin+'/api/seo/about')).status,401);
 assert.equal((await s.request('/api/seo/about','POST',{}, {Origin:'https://other.test'})).status,403);
 assert.equal((await s.rule('about',{protected_keywords:['expresión ausente']})).status,422);
 const saved=await s.rule('about',{protected_keywords:['Raíces latinas.']});assert.equal(saved.status,200);assert.equal((await saved.json()).rule.revision,1);
 assert.equal((await s.rule('about')).status,409);assert.equal(s.content.studio_seo.length,1);
 const data=await (await s.request('/api/content')).json();assert.equal(data.seoRules[0].locked_hash,undefined);assert.equal(data.seoRules[0].protected_keywords[0],'Raíces latinas.');
 const denied=await setup(t,{readOnly:true});assert.equal((await denied.rule('about')).status,403);assert.equal(denied.writes.length,0);
});
test('protected phrases cannot be removed through either text API, and invalid saves never consume translations',async t=>{
 const s=await setup(t);await s.rule('about',{protected_keywords:['Raíces latinas.']});const count=s.writes.length;
 const row=s.content.site_texts.find(row=>row.key===headline.key);
 const bad=await s.request('/api/sections/about','POST',{texts:[{key:headline.key,value:'Otro horizonte.'}]});assert.equal(bad.status,409);
 assert.equal((await s.request('/api/content/site_texts/'+row.id,'PATCH',{value:'Otro horizonte.'})).status,409);
 assert.equal(s.translations(),0);assert.equal(s.writes.length,count);assert.equal(row.value,headline.source);
 assert.equal((await s.request('/api/sections/about','POST',{texts:[{key:headline.key,value:'Raíces latinas. Una historia viva.'}]})).status,200);assert.equal(s.translations(),1);
});
test('section locks stop forced translations, shared fields and images until explicitly unlocked',async t=>{
 const s=await setup(t);assert.equal((await s.rule('about',{locked:true})).status,200);const count=s.writes.length;
 assert.equal((await s.request('/api/sections/about','POST',{force:true,texts:[{key:headline.key,value:headline.source}]})).status,423);
 assert.equal((await s.request('/api/content/site_images/story','PATCH',{image:'00000000-0000-4000-a000-000000000003'})).status,423);
 const shared=siteMap.sections.filter(section=>section.id!=='about').flatMap(section=>section.fields.filter(field=>about.fields.some(row=>row.key===field.key)).map(field=>({section,field})))[0];assert(shared);
 assert.equal((await s.request('/api/sections/'+shared.section.id,'POST',{texts:[{key:shared.field.key,value:'Cambio compartido'}]})).status,423);
 assert.equal(s.translations(),0);assert.equal(s.writes.length,count);
 assert.equal((await s.rule('about',{locked:false,revision:1})).status,200);
 assert.equal((await s.request('/api/content/site_images/story','PATCH',{image:'00000000-0000-4000-a000-000000000003'})).status,200);
});
test('collection locks prevent new drafts, archiving and order changes',async t=>{
 const s=await setup(t);assert.equal((await s.rule('albums',{locked:true})).status,200);const count=s.writes.length;
 assert.equal((await s.request('/api/content/albums','POST',{title:'Nuevo álbum',status:'draft'})).status,423);
 assert.equal((await s.request('/api/content/albums/album-a','PATCH',{status:'archived'})).status,423);
 assert.equal((await s.request('/api/reorder/albums','POST',{ids:['album-b','album-a']})).status,423);assert.equal(s.writes.length,count);
});
test('required keywords block preview publication until present in saved content, and locked external drift is detected',async t=>{
 const s=await setup(t);const required='expresión SEO de prueba';assert.equal((await s.rule('about',{required_keywords:[required]})).status,200);
 assert.equal((await s.rule('about',{locked:true,required_keywords:[required],revision:1})).status,422);
 assert.equal((await s.request('/api/publish','POST',{})).status,409);assert.equal(s.hooks(),0);
 assert.equal((await s.request('/api/sections/about','POST',{texts:[{key:headline.key,value:headline.source+' '+required}]})).status,200);
 assert.equal((await s.request('/api/publish','POST',{})).status,200);assert.equal(s.hooks(),1);
 assert.equal((await s.rule('about',{locked:true,required_keywords:[required],revision:1})).status,200);
 s.content.site_images[0].image='changed-outside-studio';
 const blocked=await s.request('/api/publish','POST',{});assert.equal(blocked.status,409);assert.match((await blocked.json()).error,/fuera del Studio/);assert.equal(s.hooks(),1);
 assert.equal((await s.rule('about',{locked:true,required_keywords:[required],revision:2})).status,409);
});
