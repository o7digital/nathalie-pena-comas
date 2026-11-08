// Isolated UX check. No customer content, translation provider or CRM writes.
import {chromium} from '@playwright/test';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {createStudioServer} from './server.mjs';
import siteMap from './site-map.json' with {type:'json'};
import {targetLocales} from './translations.mjs';
const server=createStudioServer({cms:'http://unused.test',secret:'isolated-content-browser-secret-32-characters'});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port,preview='https://preview.example.test/es/';
const texts=[...new Map(siteMap.sections.flatMap(section=>section.fields.map(field=>[field.key,field]))).values()].flatMap((field,index)=>['es',...targetLocales].map(locale=>({id:`text-${index}-${locale}`,key:field.key,locale,value:locale==='es'?field.source:field.localizations?.[locale]||`${locale}: ${field.english}`,status:'published'})));
const writes=[],errors=[];let failNext=false;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}});page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(path.startsWith('/api/sections/')&&request.method()==='POST'){
   const payload=request.postDataJSON();writes.push(payload);
   if(failNext){failNext=false;return route.fulfill({status:503,json:{error:'La traducción no está disponible. Conserva tu original.'}});}
   for(const source of payload.texts)for(const row of texts.filter(row=>row.key===source.key)){row.value=row.locale==='es'?source.value:`${row.locale}: ${source.value}`;row.auto_translated=row.locale!=='es';}
   return route.fulfill({json:{ok:true,changed:payload.texts.length,translatedLanguages:10}});
  }
  const data={
   '/api/config':{armReady:false,preview,translationReady:true},'/api/session':{name:'Test editor'},'/api/site-map':siteMap,
   '/api/content':{content:{gallery:[],albums:[],concerts:[],videos:[],site_images:[],site_texts:texts}},
  };
  return route.fulfill({status:Object.hasOwn(data,path)?200:404,json:data[path]||{error:'Unexpected test path'}});
 });
 await page.goto(origin+'/#about');await page.locator('[data-section-form=about]').waitFor();
 const section=siteMap.sections.find(row=>row.id==='about');
 assert.equal(await page.locator('[data-text-key]').count(),section.fields.length);
 const field=section.fields.find(row=>!row.auxiliary),input=page.locator(`[data-text-key=${JSON.stringify(field.key)}]`);
 assert.equal(await input.inputValue(),field.source);
 assert.equal(await input.evaluate(node=>getComputedStyle(node).color),'rgb(36, 99, 70)');
 assert.equal(await page.locator('[data-preview-locale]').count(),11);
 assert.equal(await page.locator('[data-preview-locale=fr]').getAttribute('href'),preview.replace('/es/','/fr/')+'#about');
 const value='Una artista que conecta culturas.';await input.fill(value);
 await page.getByRole('button',{name:'Traducir a 10 idiomas ↗',exact:true}).click();await page.locator('#toast').filter({hasText:'10 idiomas actualizados'}).waitFor();
 assert.equal(writes[0].force,true);assert.equal(writes[0].texts.length,section.fields.length);assert.equal(writes[0].texts.find(row=>row.key===field.key).value,value);
 await page.locator('.translation-review>summary').click();await page.locator('#review-locale').selectOption('fr');
 assert.equal(await page.locator('#translation-page-link').getAttribute('href'),preview.replace('/es/','/fr/')+'#about');
 assert.equal(await page.locator('.translated-copy').first().locator('input,textarea').count(),0);
 assert.equal(await page.locator('.translated-copy').first().locator('p').textContent(),'fr: '+value);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/tmp/npc-editable-studio-desktop.png',fullPage:true});
 failNext=true;await input.fill('Un cambio que debe conservarse.');await page.getByRole('button',{name:'Traducir a 10 idiomas ↗',exact:true}).click();
 await page.locator('.section-save-error').filter({hasText:'Conserva tu original'}).waitFor();assert.equal(await input.inputValue(),'Un cambio que debe conservarse.');assert.equal(await input.isDisabled(),false);
 await page.locator('#navigation a[href="#albums"]').click();await page.locator('[data-section-form=albums]').waitFor();
 assert.equal(await page.locator('.section-copy-panel').getAttribute('open'),'');assert.equal(await page.getByRole('button',{name:'Traducir a 10 idiomas ↗',exact:true}).isVisible(),true);
 await page.locator('#navigation a[href="#privacy"]').click();await page.locator('[data-section-form=privacy]').waitFor();
 assert.equal(await page.locator('[data-preview-locale=de]').getAttribute('href'),'https://preview.example.test/de/privacy/');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/tmp/npc-editable-studio-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Content Studio UX passed: original text, editable green fields, explicit Translate, unsaved input translation, error recovery, 11 language links, read-only review, media sections, privacy pages and mobile.');
}finally{await browser.close();server.closeAllConnections();server.close();}
