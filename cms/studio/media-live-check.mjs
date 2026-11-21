// Scoped dev verification. Always removes only the temporary records/files it creates.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {browserMediaFixture} from './browser-media-fixture.mjs';
const origin='https://studio-dev-4236.up.railway.app',cms=process.env.PUBLIC_URL;
if(cms!=='https://directus-dev-9ae1.up.railway.app'||!process.env.ADMIN_TOKEN||!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD)throw Error('Use only the Nathalie Directus dev administrator environment.');
async function directus(path,method='GET',body){
 const response=await fetch(cms+path,{method,headers:{Authorization:'Bearer '+process.env.ADMIN_TOKEN,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`Media QA Directus ${method} ${path.split('?')[0]}: ${response.status}`);
 return response.status===204?null:(await response.json()).data;
}
const files=new Set(),records=[],prefix='Studio media QA '+randomUUID();
const originalVideos=await directus('/items/videos?limit=-1&sort=id'),originalRules=await directus('/items/studio_seo?limit=-1&sort=id');
if(originalRules.some(row=>['videos','gallery'].includes(row.id)&&row.locked))throw Error('Media QA needs editable dev media sections; current customer SEO locks were preserved.');
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 const fixture=await browserMediaFixture(browser),page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.setDefaultTimeout(60000);page.on('pageerror',error=>errors.push(error.message));
 page.on('response',async response=>{try{
  if(response.request().method()==='POST'&&response.ok()&&['/api/upload','/api/media/upload'].includes(new URL(response.url()).pathname)){const data=await response.json();if(data.data?.id)files.add(data.data.id);}
 }catch{}});
 await page.goto(origin+'/#videos');await page.locator('#login-form [name=email]').fill(process.env.ADMIN_EMAIL);await page.locator('#login-form [name=password]').fill(process.env.ADMIN_PASSWORD);await page.getByRole('button',{name:/Entrar a mi Studio/}).click();
 await page.locator('.page-head [data-action=new]').waitFor();await page.locator('.page-head [data-action=new]').click();
 assert.equal(await page.locator('#video-source-type').inputValue(),'upload');
 await page.locator('#editor [name=title]').fill(prefix);await page.locator('#editor-video-upload').setInputFiles({name:'studio-qa.webm',mimeType:'video/webm',buffer:fixture.video});
 await page.locator('#video-upload-status').filter({hasText:'Vídeo listo'}).waitFor();
 const saved=page.waitForResponse(response=>response.url().endsWith('/api/content/videos')&&response.request().method()==='POST');await page.locator('#editor-form [type=submit]').click();const saveResponse=await saved;assert(saveResponse.ok(),'Live video draft: '+saveResponse.status());const row=(await saveResponse.json()).data;records.push(['videos',row.id]);files.add(row.video_file);files.add(row.image);
 await page.locator('#editor').waitFor({state:'hidden'});assert.equal(row.source_type,'upload');assert.equal(row.status,'draft');assert.equal(row.youtube_id,null);
 await page.reload();await page.getByRole('button',{name:'Editar '+prefix,exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#video-upload-preview video')?.readyState>=2);assert.equal(await page.locator('#video-source-type').inputValue(),'upload');
 const privateRange=await page.request.get(origin+'/api/video/'+row.video_file,{headers:{Range:'bytes=0-15'}});assert.equal(privateRange.status(),206);assert.deepEqual((await privateRange.body()).subarray(0,4),Buffer.from([0x1a,0x45,0xdf,0xa3]));
 const publicUrl=origin+'/site-videos/'+row.id+'/'+row.video_file;assert.equal((await fetch(publicUrl)).status,404);
 assert.equal((await fetch(cms+'/assets/'+row.video_file)).status,403);
 async function visibility(status){const response=await page.request.patch(origin+'/api/content/videos/'+row.id,{headers:{Origin:origin},data:{status}});assert(response.ok(),`Live status ${status}: ${response.status()}`);}
 await visibility('published');const publicRange=await fetch(publicUrl,{headers:{Range:'bytes=0-15'}});assert.equal(publicRange.status,206);assert.equal(publicRange.headers.get('content-type'),'video/webm');assert.equal((await publicRange.arrayBuffer()).byteLength,16);
 assert.equal((await fetch(publicUrl,{method:'HEAD'})).status,200);
 const viewer=await browser.newPage();await viewer.goto(origin);await viewer.evaluate(url=>{const video=document.createElement('video');video.src=url;video.controls=true;document.body.append(video);},publicUrl);await viewer.waitForFunction(()=>document.querySelector('video')?.readyState>=2);await viewer.close();
 await visibility('archived');assert.equal((await fetch(publicUrl)).status,404);await page.locator('#cancel-editor').click();
 await page.locator('#navigation a[href="#gallery"]').click();await page.locator('.page-head [data-action=new]').waitFor();
 const photoSaved=page.waitForResponse(response=>response.url().endsWith('/api/content/gallery')&&response.request().method()==='POST');const chooser=page.waitForEvent('filechooser');await page.locator('.page-head [data-action=new]').click();await(await chooser).setFiles({name:prefix+'.png',mimeType:'image/png',buffer:fixture.photo});
 const photoResponse=await photoSaved;assert(photoResponse.ok(),'Live photo draft: '+photoResponse.status());const photo=(await photoResponse.json()).data;records.push(['gallery',photo.id]);files.add(photo.image);assert.equal(photo.status,'draft');
 await page.reload();await page.getByRole('button',{name:'Editar '+prefix,exact:true}).click();await page.locator('#editor-photo img').waitFor();await page.waitForFunction(()=>{const img=document.querySelector('#editor-photo img');return img?.complete&&img.naturalWidth>0;});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('Live dev media passed: real photo/video uploads, automatic cover, draft persistence, private seeking, public playback only when published, archive revocation and mobile.');
}finally{
 await browser.close();const failures=[];
 // Recover our own newly created records even if a response was interrupted.
 for(const collection of ['videos','gallery'])try{const filter=encodeURIComponent(JSON.stringify({title:{_starts_with:prefix}}));for(const row of await directus(`/items/${collection}?limit=-1&filter=${filter}`)){if(!records.some(([c,id])=>c===collection&&id===row.id))records.push([collection,row.id]);if(row.image)files.add(row.image);if(row.video_file)files.add(row.video_file);}}catch(error){failures.push(error.message);}
 for(const [collection,id]of records)try{
  const filter=encodeURIComponent(JSON.stringify({key:{_starts_with:`content:${collection}:${id}:`}}));const texts=await directus('/items/site_texts?limit=-1&fields=id&filter='+filter);if(texts.length)await directus('/items/site_texts','DELETE',texts.map(row=>row.id));await directus('/items/'+collection+'/'+encodeURIComponent(id),'DELETE');
 }catch(error){failures.push(error.message);}
 for(const id of files)try{await directus('/files/'+id,'DELETE');}catch(error){failures.push(error.message);}
 if(failures.length)throw Error('Media QA cleanup requires attention: '+failures.join('; '));
 assert.deepEqual(await directus('/items/videos?limit=-1&sort=id'),originalVideos);assert.deepEqual(await directus('/items/studio_seo?limit=-1&sort=id'),originalRules);
 console.log('Only temporary media QA records, translations and files removed; customer videos and SEO rules preserved.');
}
