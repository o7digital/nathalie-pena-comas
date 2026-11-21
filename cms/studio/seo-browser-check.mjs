// Isolated editorial SEO workflow with the actual site design; no customer writes.
import {chromium} from '@playwright/test';
import {once} from 'node:events';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {createStudioServer} from './server.mjs';
import {annotatePreview,previewDocument,proxyCss} from './preview.mjs';
import {seoChecks,proposedContent} from './public/seo-data.js';
import siteMap from './site-map.json' with {type:'json'};
const server=createStudioServer({cms:'http://unused.test',secret:'isolated-seo-browser-secret-32-characters'});server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port,site='https://preview.example.test';
const html=await readFile('dist/es/index.html','utf8'),photoSrc=html.match(/class="story-visual"[^]*?<img[^]*?src="([^"]+)"/)[1];
const content={gallery:[],albums:[],concerts:[],videos:[],site_images:[{id:'story',key:'story',title:'La artista',image:'00000000-0000-4000-a000-000000000001',status:'published'}],site_texts:[...new Map(siteMap.sections.flatMap(section=>section.fields.map(field=>[field.key,field]))).values()].map((field,index)=>({id:'text-'+index,key:field.key,locale:'es',value:field.source,status:'published'}))};
const fields=siteMap.sections.flatMap(section=>section.fields.map(field=>({section:section.id,value:field.source,target:{key:field.key}}))),preview=annotatePreview(html,{sections:siteMap.sections,texts:fields,images:[{section:'about',src:photoSrc,collection:'site_images',id:'story'}]});
const rules=[],ruleWrites=[],contentWrites=[],errors=[];let failRules=true;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1550,height:1100}});page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;
  if(path==='/api/preview'){const current=url.searchParams.get('page');return route.fulfill({contentType:'text/html',body:previewDocument({page:current,html:preview},current,site,{assetOrigin:origin}),headers:{'Content-Security-Policy':`default-src 'none'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; base-uri ${site}; sandbox allow-same-origin`}});}
  if(path==='/api/preview-asset'){const asset=url.searchParams.get('path'),bytes=await readFile(resolve('dist','.'+asset));return route.fulfill({contentType:({'.css':'text/css','.webp':'image/webp','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'})[extname(asset)]||'application/octet-stream',body:asset.endsWith('.css')?proxyCss(bytes.toString(),asset,site,origin):bytes});}
  if(path.startsWith('/api/image/'))return route.fulfill({contentType:'image/webp',body:await readFile(resolve('dist','.'+photoSrc))});
  if(path.startsWith('/api/seo/')&&request.method()==='POST'){
   const id=path.split('/').at(-1),input=request.postDataJSON();ruleWrites.push(input);
   if(failRules){failRules=false;return route.fulfill({status:503,json:{error:'No se pudieron guardar las reglas. Conserva tus palabras.'}});}
   const current=rules.find(rule=>rule.id===id),rule={id,...input,revision:(current?.revision||0)+1};if(current)Object.assign(current,rule);else rules.push(rule);return route.fulfill({json:{rule}});
  }
  if(path.startsWith('/api/sections/')&&request.method()==='POST'){
   const input=request.postDataJSON(),next=proposedContent(content,{texts:input.texts.map(row=>({...row,status:'published'}))}),section=siteMap.sections.find(section=>section.id===path.split('/').at(-1)),rule=rules.find(rule=>rule.id===section.id);contentWrites.push(input);
   if(rule?.protected_keywords.length&&seoChecks(rule,section,next).protected.some(row=>!row.present))return route.fulfill({status:409,json:{error:'Conserva las palabras protegidas de La artista: Raíces latinas.'}});
   content.site_texts=next.site_texts;return route.fulfill({json:{ok:true,changed:input.texts.length,translatedLanguages:10}});
  }
  const data={'/api/config':{preview:site+'/es/',translationReady:true},'/api/session':{name:'Test SEO editor'},'/api/site-map':siteMap,'/api/content':{content,seoRules:rules}};
  return route.fulfill({status:Object.hasOwn(data,path)?200:404,json:data[path]||{error:'Unexpected path'}});
 });
 await page.goto(origin+'/#seo');await page.locator('.seo-section-grid').waitFor();assert.equal(await page.locator('.seo-section-grid article').count(),siteMap.sections.length);
 await page.locator('.seo-section-grid article').filter({has:page.getByRole('heading',{name:'La artista',exact:true})}).getByRole('link',{name:'Configurar SEO',exact:true}).click();
 const panel=page.locator('[data-seo-panel=about]'),form=page.locator('[data-seo-form=about]');await panel.locator('form').waitFor();assert.equal(await panel.getAttribute('open'),'');
 await form.locator('[name=protected_keywords]').fill('Raíces latinas.');await form.locator('[name=required_keywords]').fill('soprano del Caribe');
 await form.getByRole('button',{name:'Guardar reglas SEO',exact:true}).click();await form.locator('.seo-form-error').filter({hasText:'Conserva tus palabras'}).waitFor();
 await page.locator('#navigation a[href="#home"]').click();await page.locator('[data-section-form=home]').waitFor({state:'attached'});await page.locator('#navigation a[href="#about"]').click();await form.waitFor();assert.equal(await form.locator('[name=required_keywords]').inputValue(),'soprano del Caribe');
 await form.getByRole('button',{name:'Guardar reglas SEO',exact:true}).click();await page.locator('#toast').filter({hasText:'Reglas SEO guardadas'}).waitFor();assert.equal(rules[0].revision,1);
 assert.equal(await page.locator('.seo-keyword.present').count(),1);assert.equal(await page.locator('.seo-keyword.missing-required').count(),1);
 const frame=page.frameLocator('.visual-editor iframe'),text=frame.locator('#about-title [data-studio-editable]').first();await text.waitFor();assert.equal(await text.textContent(),'Raíces latinas.');
 // New SEO targets remain a task, never an automatic rewrite of the artist's copy.
 assert.equal(contentWrites.length,0);await text.fill('Raíces latinas. Una soprano del Caribe.');await page.locator('.seo-keyword.missing-required').waitFor({state:'hidden'});
 await form.locator('[name=locked]').check();await form.getByRole('button',{name:'Guardar reglas SEO',exact:true}).click();await form.locator('.seo-form-error').filter({hasText:'Guarda los cambios de contenido'}).waitFor();assert.equal(ruleWrites.length,2);
 await page.locator('[data-visual-save]').click();await page.locator('.visual-status').filter({hasText:'Haz clic'}).waitFor();
 await form.getByRole('button',{name:'Guardar reglas SEO',exact:true}).click();await page.locator('.seo-lock-banner').waitFor();assert.equal(rules[0].locked,true);
 await frame.locator('#about-title [data-studio-editable]').first().waitFor();assert.equal(await frame.locator('#about-title [data-studio-editable]').first().getAttribute('contenteditable'),'false');assert.equal(await page.locator('[data-visual-save]').isDisabled(),true);
 await frame.getByRole('button',{name:'Cambiar fotografía: La artista',exact:true}).click();assert.equal(await page.locator('[data-upload-visual]').isDisabled(),true);
 await page.locator('.studio-text-fields>summary').click();assert.equal(await page.locator('[data-text-key]').first().isDisabled(),true);
 await page.evaluate(()=>scrollTo(0,0));await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/studio-seo-desktop.png',fullPage:true});
 await form.locator('[name=locked]').uncheck();await form.getByRole('button',{name:'Guardar reglas SEO',exact:true}).click();await page.locator('.seo-lock-banner').waitFor({state:'hidden'});await frame.locator('#about-title [data-studio-editable]').first().waitFor();
 const editable=frame.locator('#about-title [data-studio-editable]').first();await editable.fill('Una historia diferente.');await page.locator('.seo-keyword.missing-protected').waitFor();await page.locator('[data-visual-save]').click();await page.locator('.visual-error').filter({hasText:'Conserva las palabras protegidas'}).waitFor();assert.equal(await editable.textContent(),'Una historia diferente.');
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/studio-seo-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('SEO Studio passed: section overview, keyword rules, error and navigation recovery, live keyword checks, no automatic rewriting, lock after content save, read-only page and photos, unlock, protected-copy error retention and mobile.');
}finally{await browser.close();server.closeAllConnections();server.close();}
