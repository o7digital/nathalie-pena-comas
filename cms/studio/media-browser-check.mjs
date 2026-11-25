import {chromium,firefox} from '@playwright/test';
import {once} from 'node:events';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {createStudioServer} from './server.mjs';
import {previewDocument,proxyCss} from './preview.mjs';
import {browserMediaFixture} from './browser-media-fixture.mjs';
import siteMap from './site-map.json' with {type:'json'};
const videoId='00000000-0000-4000-a000-000000000001',imageId='00000000-0000-4000-a000-000000000002';
const server=createStudioServer({cms:'http://unused.test',secret:'isolated-site-upload-browser-secret-32-characters'});server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port,site='https://preview.example.test';
const bundle=JSON.parse(await readFile('dist/_studio/pages/es.json','utf8')),content={gallery:[],albums:[],videos:[],concerts:[],site_images:[],site_texts:[...new Map(siteMap.sections.flatMap(section=>section.fields.map(field=>[field.key,field]))).values()].map((field,index)=>({id:'text-'+index,key:field.key,locale:'es',value:field.source,status:'published'}))};
const browser=await (process.env.PLAYWRIGHT_BROWSER==='firefox'?firefox.launch():chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'}));
try{
 const fixture=await browserMediaFixture(browser),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],writes=[];page.setDefaultTimeout(25000);page.on('pageerror',error=>errors.push(error.message));
 let mode='fail',waiting=null,uploads=0,photos=0;
 async function waitUpload(){const end=Date.now()+20000;while(!waiting&&Date.now()<end)await new Promise(resolve=>setTimeout(resolve,40));assert(waiting,'Video upload did not start.');}
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;
  if(path==='/api/preview')return route.fulfill({contentType:'text/html',body:previewDocument(bundle,'/es/',site,{assetOrigin:origin}),headers:{'Content-Security-Policy':`default-src 'none'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; base-uri ${site}; sandbox allow-same-origin`}});
  if(path==='/api/preview-asset'){const asset=url.searchParams.get('path'),bytes=await readFile(resolve('dist','.'+asset));return route.fulfill({body:asset.endsWith('.css')?proxyCss(bytes.toString(),asset,site,origin):bytes,contentType:({'.css':'text/css','.webp':'image/webp','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'})[extname(asset)]||'application/octet-stream'});}
  if(path.startsWith('/api/image/'))return route.fulfill({contentType:'image/png',body:fixture.photo});
  if(path.startsWith('/api/video/'))return route.fulfill({contentType:'video/webm',body:fixture.video,headers:{'Accept-Ranges':'bytes'}});
  if(path==='/api/media/upload'){
   uploads++;assert.equal(request.headers()['content-type'],'video/webm');assert.deepEqual(request.postDataBuffer().subarray(0,4),Buffer.from([0x1a,0x45,0xdf,0xa3]));
   if(mode==='fail')return route.fulfill({status:503,json:{error:'La conexión se interrumpió. Tus textos siguen aquí.'}});
   if(mode==='hold')await new Promise(resolve=>{waiting=resolve;});
   return route.fulfill({status:201,json:{data:{id:videoId,type:'video/webm',filesize:fixture.video.length}}}).catch(()=>{});
  }
  if(path==='/api/upload'){photos++;const form=await new Response(request.postDataBuffer(),{headers:{'Content-Type':request.headers()['content-type']}}).formData();assert(form.get('file').size>0);return route.fulfill({status:201,json:{data:{id:imageId}}});}
  const record=path.match(/^\/api\/content\/(videos|gallery)(?:\/([^/]+))?$/);
  if(record&&['POST','PATCH'].includes(request.method())){const data=request.postDataJSON();writes.push({collection:record[1],data});const row=record[2]?content[record[1]].find(row=>row.id===record[2]):{id:'new-'+record[1]};Object.assign(row,data);if(!record[2])content[record[1]].push(row);return route.fulfill({status:record[2]?200:201,json:{data:row}});}
  const data={'/api/config':{preview:site+'/es/',translationReady:true},'/api/session':{name:'Media test editor'},'/api/site-map':siteMap,'/api/content':{content,seoRules:[]}};return route.fulfill({status:Object.hasOwn(data,path)?200:404,json:data[path]||{error:'Unexpected path'}});
 });
 await page.goto(origin+'/#videos');await page.locator('.page-head [data-action=new]').waitFor();await page.locator('.page-head [data-action=new]').click();
 assert.equal(await page.locator('.video-source-editor').getAttribute('data-editing-kind'),'media');
 assert.equal(await page.locator('#editor-photo').getAttribute('data-editing-kind'),'media');
 assert.equal(await page.locator('.video-source-editor').evaluate(node=>getComputedStyle(node).borderLeftColor),'rgb(40, 107, 193)');
 assert.equal(await page.locator('#editor [name=title]').evaluate(node=>node.closest('label').dataset.editingKind),'text');
 assert.equal(await page.locator('#video-source-type').inputValue(),'upload');assert(await page.getByRole('button',{name:'Subir vídeo desde mi dispositivo',exact:true}).isVisible());
 await page.locator('#editor [name=title]').fill('Concierto creado por Nathalie');
 await page.locator('#editor-video-upload').setInputFiles({name:'concierto.webm',mimeType:'video/webm',buffer:fixture.video});await page.locator('#video-upload-error').filter({hasText:'Tus textos siguen aquí'}).waitFor();assert.equal(await page.locator('#editor [name=title]').inputValue(),'Concierto creado por Nathalie');
 mode='hold';await page.getByRole('button',{name:'Volver a intentar',exact:true}).click();await page.locator('#video-upload-progress').waitFor();assert(await page.locator('#editor-form [type=submit]').isDisabled());
 await waitUpload();waiting();waiting=null;await page.locator('#video-upload-status').filter({hasText:'Vídeo listo'}).waitFor();assert.equal(uploads,2);assert.equal(photos,1);assert(await page.locator('#editor-photo img').isVisible());
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/studio-video-upload-desktop.png'});
 await page.locator('#editor-form [type=submit]').click();await page.locator('#editor').waitFor({state:'hidden'});assert.equal(writes[0].data.video_file,videoId);assert.equal(writes[0].data.source_type,'upload');assert.equal(writes[0].data.youtube_id,null);assert.equal(writes[0].data.image,imageId);assert.equal(writes[0].data.status,'draft');
 await page.getByRole('button',{name:'Editar Concierto creado por Nathalie',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#video-upload-preview video')?.readyState>=2);assert.equal(await page.locator('#video-source-type').inputValue(),'upload');
 await page.locator('#video-source-type').selectOption('youtube');await page.locator('#editor [name=youtube_id]').fill('https://youtu.be/abcdefghijk');await page.locator('#editor-form [type=submit]').click();await page.locator('#editor').waitFor({state:'hidden'});assert.equal(writes[1].data.source_type,'youtube');assert.equal(writes[1].data.youtube_id,'abcdefghijk');assert.equal(writes[1].data.video_file,null);
 await page.locator('.page-head [data-action=new]').click();await page.locator('#editor-video-upload').setInputFiles({name:'cancelado.webm',mimeType:'video/webm',buffer:fixture.video});await waitUpload();await page.getByRole('button',{name:'Cancelar subida',exact:true}).click();waiting();waiting=null;await page.locator('#video-upload-error').filter({hasText:'Carga cancelada'}).waitFor();assert.equal(writes.length,2);
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'test-results/studio-video-upload-mobile.png'});await page.locator('#cancel-editor').click();
 await page.setViewportSize({width:1440,height:1100});await page.locator('#navigation a[href="#gallery"]').click();await page.locator('[data-section-form=gallery]').waitFor({state:'attached'});
 const chooser=page.waitForEvent('filechooser');await page.locator('.page-head [data-action=new]').click();await(await chooser).setFiles({name:'Mi-fotografia.png',mimeType:'image/png',buffer:fixture.photo});await page.locator('#toast').filter({hasText:'fotografía añadida'}).waitFor();assert.equal(writes.at(-1).collection,'gallery');assert.equal(content.gallery.length,1);
 assert.deepEqual(errors,[]);console.log('Media upload UX passed: device upload actions, browser-playable video, progress, failed-upload recovery, metadata retention, automatic cover, draft persistence, existing-video preview, YouTube switching, cancel without creating a record, photo upload and mobile.');
}finally{await browser.close();server.closeAllConnections();server.close();}
