// Real site design with isolated CMS fixtures: no client content or provider writes.
import {chromium} from '@playwright/test';
import {once} from 'node:events';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {createStudioServer} from './server.mjs';
import {annotatePreview,previewDocument,proxyCss} from './preview.mjs';
import siteMap from './site-map.json' with {type:'json'};
const studio=createStudioServer({cms:'http://unused.test',secret:'isolated-visual-browser-test-secret-32-characters'});
const site=http.createServer(async(req,res)=>{
 try{const path=resolve('dist','.'+new URL(req.url,'http://site.test').pathname);if(!path.startsWith(resolve('dist')+'/'))throw Error();const bytes=await readFile(path);res.setHeader('Content-Type',({'.css':'text/css','.webp':'image/webp','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');res.end(bytes);}catch{res.statusCode=404;res.end();}
});
studio.listen(0,'127.0.0.1');site.listen(0,'127.0.0.1');await Promise.all([once(studio,'listening'),once(site,'listening')]);
const origin=`http://127.0.0.1:${studio.address().port}`,siteOrigin=`http://127.0.0.1:${site.address().port}`;
const original=await readFile('dist/es/index.html','utf8'),privacy=await readFile('dist/es/privacy/index.html','utf8');
const about=siteMap.sections.find(row=>row.id==='about'),field=about.fields.find(row=>row.source==='Raíces latinas.');assert(field);
const texts=[...new Map(siteMap.sections.flatMap(section=>section.fields.map(field=>[field.key,field]))).values()].map((field,index)=>({id:`text-${index}`,key:field.key,locale:'es',value:field.source,status:'published'}));
const photoSrc=original.match(/class="story-visual"[^]*?<img[^]*?src="([^"]+)"/)[1];
const records={gallery:[],albums:[{id:'album-2',title:'Alta Gracia',detail:'Bratislava Festival Orchestra · Pablo Boggiano',url:'https://example.test/album',category:'classical',image:'00000000-0000-4000-a000-000000000001',status:'published'}],concerts:[],videos:[],site_images:[{id:'story',key:'story',title:'La artista',image:'00000000-0000-4000-a000-000000000001',status:'published'}],site_texts:texts};
const markers=siteMap.sections.flatMap(section=>section.fields.map(field=>({section:section.id,value:field.source,target:{key:field.key}})));
markers.push({section:'albums',value:'Alta Gracia',target:{collection:'albums',id:'album-2',field:'title'}});
const html=annotatePreview(original,{texts:markers,sections:siteMap.sections,images:[{section:'about',src:photoSrc,collection:'site_images',id:'story'}]});
const writes=[],errors=[];let failNext=false,failPreview=false,uploadCount=0;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1550,height:1100}});page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;
  if(path==='/api/preview'){
   if(failPreview){failPreview=false;return route.fulfill({status:503,json:{error:'La vista no está disponible.'}});}
   const current=url.searchParams.get('page');return route.fulfill({contentType:'text/html',body:previewDocument({page:current,html:current.includes('privacy')?annotatePreview(privacy,{texts:markers,initialSection:'privacy'}):html},current,siteOrigin,{assetOrigin:origin}),headers:{'Content-Security-Policy':`default-src 'none'; script-src 'none'; style-src 'self' 'unsafe-inline' ${siteOrigin}; img-src 'self' data: ${siteOrigin}; font-src 'self' ${siteOrigin}; base-uri ${siteOrigin}; sandbox allow-same-origin`}});
  }
  if(path==='/api/preview-asset'){
   const asset=url.searchParams.get('path'),bytes=await readFile(resolve('dist','.'+asset)),type=({'.css':'text/css','.webp':'image/webp','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'})[extname(asset)]||'application/octet-stream';
   return route.fulfill({contentType:type,body:type==='text/css'?proxyCss(bytes.toString(),asset,siteOrigin,origin):bytes});
  }
  if(path.startsWith('/api/image/')){const bytes=await readFile(resolve('dist','.'+photoSrc));return route.fulfill({contentType:'image/webp',body:bytes});}
  if(path==='/api/upload'){uploadCount++;return route.fulfill({json:{data:{id:'00000000-0000-4000-a000-000000000002'}}});}
  if(path.startsWith('/api/sections/')&&request.method()==='POST'){
   const payload=request.postDataJSON();writes.push(payload);
   if(failNext){failNext=false;return route.fulfill({status:503,json:{error:'La traducción no está disponible. Tu cambio se conserva.'}});}
   for(const row of payload.texts)Object.assign(texts.find(text=>text.key===row.key),{value:row.value});return route.fulfill({json:{ok:true,changed:payload.texts.length,translatedLanguages:10}});
  }
  if(path.startsWith('/api/content/site_images/')&&request.method()==='PATCH'){const data=request.postDataJSON();writes.push(data);Object.assign(records.site_images[0],data);return route.fulfill({json:{ok:true}});}
  if(path==='/api/content/albums/album-2'&&request.method()==='PATCH'){const data=request.postDataJSON();writes.push(data);Object.assign(records.albums[0],data);return route.fulfill({json:{ok:true}});}
  const data={'/api/config':{preview:siteOrigin+'/es/',translationReady:true},'/api/session':{name:'Editor de prueba'},'/api/site-map':siteMap,'/api/content':{content:records}};
  return route.fulfill({status:Object.hasOwn(data,path)?200:404,json:data[path]||{error:'Unexpected test path'}});
 });
 await page.goto(origin+'/#about');
 const frame=page.frameLocator('.visual-editor iframe'),input=frame.getByRole('textbox',{name:field.label,exact:true}).filter({hasText:field.source});
 await input.waitFor();assert.equal(await page.locator('.visual-editor iframe').evaluate(frame=>frame.contentWindow.getComputedStyle(frame.contentDocument.querySelector('#about')).display),'grid');assert.equal(await page.locator('.studio-text-fields').getAttribute('open'),null);
 await input.fill('Una voz que conecta culturas.');
 assert.equal(await page.locator('[data-visual-text]').textContent(),'Una voz que conecta culturas.');
 assert.match(await page.locator('.visual-status').textContent(),/1 cambio/);
 await page.locator('[data-visual-save]').click();await page.locator('.visual-status').filter({hasText:'Haz clic'}).waitFor();
 assert.deepEqual(writes[0].texts,[{key:field.key,value:'Una voz que conecta culturas.'}]);
 const edited=frame.getByRole('textbox',{name:field.label,exact:true}).filter({hasText:'Una voz que conecta culturas.'});await edited.waitFor();
 // The old built HTML receives the latest saved CMS values without a site rebuild.
 assert.equal(await edited.textContent(),'Una voz que conecta culturas.');
 await page.locator('[data-visual-mode=preview]').click();assert.equal(await edited.getAttribute('contenteditable'),'false');
 await page.locator('[data-visual-mode=edit]').click();
 failNext=true;await edited.fill('Un borrador que debe conservarse.');await page.locator('[data-visual-save]').click();
 await page.locator('.visual-error').filter({hasText:'Tu cambio se conserva'}).waitFor();assert.equal(await frame.getByRole('textbox',{name:field.label,exact:true}).filter({hasText:'Un borrador que debe conservarse.'}).textContent(),'Un borrador que debe conservarse.');assert.equal(await page.locator('[data-visual-save]').isEnabled(),true);
 await page.locator('#navigation a[href="#home"]').click();await page.locator('.visual-loading').waitFor({state:'hidden'});
 await page.locator('#navigation a[href="#about"]').click();await frame.getByRole('textbox',{name:field.label,exact:true}).filter({hasText:'Un borrador que debe conservarse.'}).waitFor();
 await frame.getByRole('button',{name:'Cambiar fotografía: La artista',exact:true}).click();
 await page.locator('.visual-upload').setInputFiles({name:'portrait.webp',mimeType:'image/webp',buffer:await readFile(resolve('dist','.'+photoSrc))});
 await page.waitForFunction(()=>document.querySelector('.visual-inspector img')?.src.includes('00000000-0000-4000-a000-000000000002'));
 assert.equal(uploadCount,1);assert.match(await frame.getByRole('button',{name:'Cambiar fotografía: La artista'}).getAttribute('src'),/000000000002/);
 await page.locator('[data-visual-save]').click();await page.locator('.visual-status').filter({hasText:'Haz clic'}).waitFor();assert(writes.some(write=>write.image?.endsWith('000000000002')));
 await page.locator('[data-visual-device=mobile]').click();assert.equal(await page.locator('.visual-editor iframe').evaluate(node=>node.style.width),'390px');
 await page.locator('[data-visual-device=tablet]').click();assert.equal(await page.locator('.visual-editor iframe').evaluate(node=>node.style.width),'820px');
 await page.locator('[data-visual-device=desktop]').click();await page.evaluate(()=>scrollTo(0,0));await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/studio-wysiwyg-desktop.png',fullPage:true});
 // Collection text uses its own CMS record, and the detailed editor shares the draft.
 await page.locator('#navigation a[href="#albums"]').click();const album=frame.getByRole('textbox',{name:'Alta Gracia · Título',exact:true});await album.fill('Alta Gracia · Edición del Studio');
 await page.getByRole('button',{name:'Editar Alta Gracia',exact:true}).click();assert.equal(await page.locator('#editor [name=title]').inputValue(),'Alta Gracia · Edición del Studio');await page.locator('#cancel-editor').click();
 await page.locator('[data-visual-save]').click();await page.locator('.visual-status').filter({hasText:'Haz clic'}).waitFor();assert(writes.some(write=>write.title==='Alta Gracia · Edición del Studio'));
 // Resource failures can be retried without affecting existing drafts.
 failPreview=true;await page.locator('#navigation a[href="#privacy"]').click();await page.locator('[data-visual-retry]').waitFor();await page.locator('[data-visual-retry]').click();await page.locator('.visual-loading').waitFor({state:'hidden'});assert.equal(await page.locator('.visual-editor iframe').getAttribute('src'),'/api/preview?page=%2Fes%2Fprivacy%2F');
 await page.locator('#navigation a[href="#about"]').click();await page.locator('.visual-loading').waitFor({state:'hidden'});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('[data-visual-device=mobile]').click();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/studio-wysiwyg-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Visual Studio passed: real page, direct editing, inspector synchronization, persisted saves, failed translation recovery, retained navigation drafts, live photo replacement, read-only preview, three device sizes, retry, privacy and mobile.');
}finally{await browser.close();studio.closeAllConnections();studio.close();site.closeAllConnections();site.close();}
