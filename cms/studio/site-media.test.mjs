import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {Readable} from 'node:stream';
import {createStudioServer} from './server.mjs';
import {createSiteMedia,SITE_VIDEO_FOLDER} from './site-media.mjs';
import {VIDEO_LIMIT} from './public/video-data.js';
import {targetLocales} from './translations.mjs';
const fileId='00000000-0000-4000-a000-000000000001',privateId='00000000-0000-4000-a000-000000000002',poster='00000000-0000-4000-a000-000000000003';
const mp4=Buffer.concat([Buffer.from([0,0,0,24]),Buffer.from('ftypisom0000'),Buffer.alloc(96,5)]);
async function setup(t,{readOnly=false}={}){
 const calls=[],files=new Map([[fileId,{id:fileId,type:'video/mp4',filesize:mp4.length,folder:SITE_VIDEO_FOLDER}],[privateId,{id:privateId,type:'video/mp4',filesize:mp4.length,folder:'private-social-folder'}]]),videos=[],texts=[];let uploaded=null;
 const provider=http.createServer(async(req,res)=>{
  const chunks=[];try{for await(const chunk of req)chunks.push(chunk);}catch{return res.destroy();}const bytes=Buffer.concat(chunks),url=new URL(req.url,'http://test');calls.push({path:url.pathname,method:req.method,authorization:req.headers.authorization});
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  if(url.pathname==='/auth/login')return send(200,{data:{access_token:'private-access',refresh_token:'private-refresh',expires:900000}});
  if(url.pathname==='/users/me')return send(200,{data:{id:'owner',email:'owner@example.test'}});
  if(url.pathname==='/permissions/me')return send(200,{data:Object.fromEntries(['videos','directus_files','site_texts'].map(key=>[key,Object.fromEntries(['read','create','update'].map(action=>[action,{access:readOnly&&action!=='read'?'none':'full',fields:['*']}]))]))});
  if(url.pathname==='/files'&&req.method==='POST'){
   const form=await new Response(bytes,{headers:{'Content-Type':req.headers['content-type']}}).formData(),file=form.get('file');assert.equal(form.get('folder'),SITE_VIDEO_FOLDER);
   uploaded=Buffer.from(await file.arrayBuffer());files.set(fileId,{id:fileId,type:file.type,filesize:uploaded.length,folder:SITE_VIDEO_FOLDER});return send(200,{data:files.get(fileId)});
  }
  if(url.pathname.startsWith('/files/')){const row=files.get(url.pathname.split('/').at(-1));return send(row?200:404,{data:row});}
  if(url.pathname.startsWith('/assets/')){
   const body=uploaded||mp4,total=body.length;let start=0,end=total-1;
   if(req.headers.range){const match=req.headers.range.match(/^bytes=(\d*)-(\d*)$/);start=match[1]?Number(match[1]):Math.max(0,total-Number(match[2]));end=match[1]&&match[2]?Math.min(total-1,Number(match[2])):total-1;if(start>=total||end<start)return send(416,{});}
   res.writeHead(req.headers.range?206:200,{'Content-Type':files.get(fileId).type,'Content-Length':end-start+1,'Accept-Ranges':'bytes',...(req.headers.range?{'Content-Range':`bytes ${start}-${end}/${total}`}:{})});return res.end(req.method==='HEAD'?undefined:body.subarray(start,end+1));
  }
  if(url.pathname==='/items/studio_seo')return send(200,{data:[]});
  if(url.pathname==='/items/site_texts'){
   if(req.method==='GET')return send(200,{data:texts});for(const row of JSON.parse(bytes)){const previous=texts.find(item=>item.id===row.id);if(previous)Object.assign(previous,row);else texts.push(row);}return send(200,{data:[]});
  }
  if(url.pathname==='/items/videos'&&req.method==='POST'){const row=JSON.parse(bytes);videos.push(row);return send(200,{data:row});}
  if(url.pathname.startsWith('/items/videos/')){const id=url.pathname.split('/').at(-1),row=videos.find(row=>row.id===id);if(!row)return send(404,{});if(req.method==='PATCH')Object.assign(row,JSON.parse(bytes));return send(200,{data:row});}
  send(404,{});
 });
 provider.listen(0,'127.0.0.1');await once(provider,'listening');const cms='http://127.0.0.1:'+provider.address().port;
 const server=createStudioServer({cms,editorToken:'private-build-token',secret:'site-media-private-test-secret-with-32-characters',translate:async sources=>Object.fromEntries(targetLocales.map(locale=>[locale,Object.fromEntries(sources.map(source=>[source.key,locale+': '+source.value]))]))});server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
 t.after(()=>{server.closeAllConnections();server.close();provider.closeAllConnections();provider.close();});
 const login=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'owner@example.test',password:'private-password'})}),cookie=login.headers.get('set-cookie').split(';')[0];
 const request=(path,{method='GET',body,headers={}}={})=>fetch(origin+path,{method,headers:{Cookie:cookie,Origin:origin,...headers},body});
 const save=(body,id)=>request('/api/content/videos'+(id?'/'+id:''),{method:id?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 return {request,save,origin,cms,calls,files,videos,uploaded:()=>uploaded};
}
test('site uploads require authentication, write permission and the correct origin before storing bytes',async t=>{
 const s=await setup(t);
 assert.equal((await fetch(s.origin+'/api/media/upload',{method:'POST',headers:{Origin:s.origin,'Content-Type':'video/mp4'},body:mp4})).status,401);
 assert.equal((await s.request('/api/media/upload',{method:'POST',headers:{Origin:'https://other.test','Content-Type':'video/mp4'},body:mp4})).status,403);
 const denied=await setup(t,{readOnly:true});assert.equal((await denied.request('/api/media/upload',{method:'POST',headers:{'Content-Type':'video/mp4'},body:mp4})).status,403);assert.equal(denied.uploaded(),null);
 assert.equal((await fetch(s.origin+'/api/video/'+fileId)).status,401);
});
test('MP4 and WebM stream into the website folder with bounded size and signature validation',async t=>{
 const s=await setup(t);
 const response=await s.request('/api/media/upload',{method:'POST',headers:{'Content-Type':'video/mp4'},body:mp4});assert.equal(response.status,201);assert.equal((await response.json()).data.id,fileId);assert.deepEqual(s.uploaded(),mp4);
 const webm=Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(100,3)]);assert.equal((await s.request('/api/media/upload',{method:'POST',headers:{'Content-Type':'video/webm'},body:webm})).status,201);assert.deepEqual(s.uploaded(),webm);
 const count=s.calls.filter(call=>call.path==='/files'&&call.method==='POST').length;
 assert.equal((await s.request('/api/media/upload',{method:'POST',headers:{'Content-Type':'video/mp4'},body:Buffer.from('not a video')})).status,400);
 assert.equal(s.calls.filter(call=>call.path==='/files'&&call.method==='POST').length,count);
 const media=createSiteMedia({cms:s.cms});const oversized=Readable.from([mp4]);oversized.headers={'content-type':'video/mp4','content-length':String(VIDEO_LIMIT+1)};await assert.rejects(media.upload(oversized,'private-access'),error=>error.status===400);
});
test('native files preview privately, publish through a checked record, support seeking, and disappear after archival',async t=>{
 const s=await setup(t);
 const preview=await s.request('/api/video/'+fileId,{headers:{Range:'bytes=0-15'}});assert.equal(preview.status,206);assert.equal(preview.headers.get('content-range'),`bytes 0-15/${mp4.length}`);assert.deepEqual(Buffer.from(await preview.arrayBuffer()),mp4.subarray(0,16));
 assert.equal((await s.request('/api/video/'+privateId)).status,400);
 const draft=await s.save({title:'Mi vídeo',source_type:'upload',video_file:fileId,image:poster,status:'draft',category:'opera'});assert.equal(draft.status,201);const row=(await draft.json()).data;
 const url=s.origin+'/site-videos/'+row.id+'/'+fileId;
 assert.equal((await fetch(url)).status,404);
 assert.equal((await s.save({status:'published'},row.id)).status,200);
 const publicVideo=await fetch(url,{headers:{Range:'bytes=0-15'}});assert.equal(publicVideo.status,206);assert.equal(publicVideo.headers.get('content-type'),'video/mp4');assert(!JSON.stringify([...publicVideo.headers]).includes('private-'));assert.deepEqual(Buffer.from(await publicVideo.arrayBuffer()),mp4.subarray(0,16));
 const head=await fetch(url,{method:'HEAD',headers:{Range:'bytes=4-15'}});assert.equal(head.status,206);assert.equal(head.headers.get('content-length'),'12');assert.equal((await head.arrayBuffer()).byteLength,0);
 assert.equal((await fetch(url,{headers:{Range:'bytes=0-1,3-4'}})).status,416);
 assert.equal((await fetch(s.origin+'/site-videos/'+row.id+'/'+privateId)).status,404);
 assert(s.calls.some(call=>call.path==='/assets/'+fileId&&call.authorization==='Bearer private-build-token'));
 assert.equal((await s.save({status:'archived'},row.id)).status,200);assert.equal((await fetch(url)).status,404);
});
test('video records reject unrelated private files and published videos without a cover, while YouTube stays supported',async t=>{
 const s=await setup(t);
 assert.equal((await s.save({title:'Private file',source_type:'upload',video_file:privateId,image:poster})).status,400);
 assert.equal((await s.save({title:'No cover',source_type:'upload',video_file:fileId,status:'published'})).status,400);
 const youtube=await s.save({title:'YouTube',youtube_id:'abcdefghijk',image:poster,status:'published'});assert.equal(youtube.status,201);const row=(await youtube.json()).data;assert.equal(row.source_type,'youtube');assert.equal(row.video_file,null);
 const switched=await s.save({source_type:'upload',video_file:fileId},row.id);assert.equal(switched.status,200);assert.equal((await switched.json()).data.youtube_id,null);
});
