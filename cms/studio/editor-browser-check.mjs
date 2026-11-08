// Live editorial check. Restores the exact original translation bundle in finally; never publishes it.
import { chromium } from '@playwright/test';
import { request } from 'node:https';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import siteMap from './site-map.json' with {type:'json'};
import { sourceHash } from './translations.mjs';
const origin=process.env.STUDIO_TEST_URL||'http://127.0.0.1:4380',cms=process.env.PUBLIC_URL;
if(cms!=='https://directus-dev-9ae1.up.railway.app'||!process.env.ADMIN_TOKEN||!process.env.ADMIN_PASSWORD)throw new Error('Use the Nathalie Directus dev variables.');
async function api(path,method='GET',value) {
 const body=value===undefined?null:Buffer.from(JSON.stringify(value));
 return new Promise((resolve,reject)=>{
  const req=request(cms+path,{method,headers:{Authorization:'Bearer '+process.env.ADMIN_TOKEN,'Content-Type':'application/json',...(body?{'Content-Length':body.length}:{})}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{const result=Buffer.concat(chunks).toString();if(res.statusCode>=400)return reject(new Error('CMS QA '+method+': '+res.statusCode));resolve(result?JSON.parse(result).data:null);});});req.on('error',reject);req.end(body);
 });
}
const section=siteMap.sections.find(row=>row.id==='about'),field=section.fields.find(row=>!row.auxiliary);
const path='/items/site_texts?limit=-1&filter='+encodeURIComponent(JSON.stringify({key:{_eq:field.key}}));
const snapshot=await api(path),original=snapshot.find(row=>row.locale==='es');assert(original);
const value='La artista, una voz que une culturas.';
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'}),errors=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin+'/#about');await page.locator('input[name=email]').fill(process.env.ADMIN_EMAIL);await page.locator('input[name=password]').fill(process.env.ADMIN_PASSWORD);await page.getByRole('button',{name:/Entrar a mi Studio/}).click();
 await page.locator('[data-section-form="about"]').waitFor();
 const navigation=await page.locator('#navigation a').allTextContents();
 assert.deepEqual(navigation.map(value=>value.replace(/\d+/g,'').trim()),['Resumen',...siteMap.sections.map(row=>row.title),'Relaciones · ARM']);
 await page.getByText('Escribe en español.',{exact:true}).waitFor();
 const input=page.locator(`[data-text-key=${JSON.stringify(field.key)}]`);assert.equal(await input.inputValue(),original.value);
 await input.fill(value);const saved=page.waitForResponse(response=>response.url().endsWith('/api/sections/about')&&response.request().method()==='POST',{timeout:150000});
 await page.getByRole('button',{name:/Guardar y traducir/}).click();const response=await saved;assert.equal(response.status(),200);assert.equal((await response.json()).translatedLanguages,10);await page.locator('#toast').filter({hasText:/10 idiomas actualizados/}).waitFor();
 const translated=await api(path);assert.equal(translated.length,11);assert(translated.every(row=>row.source_hash===sourceHash(value)));
 assert.match(translated.find(row=>row.locale==='fr').value,/voix/i);assert.match(translated.find(row=>row.locale==='zh-TW').value,/\p{Script=Han}/u);
 await page.locator('.translation-review>summary').click();await page.locator('#review-locale').selectOption('fr');await page.locator('.translated-copy').first().getByText(translated.find(row=>row.locale==='fr').value,{exact:true}).waitFor();
 assert.equal(await page.locator(`[data-text-key=${JSON.stringify(field.key)}]`).inputValue(),value);
 await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>Array.from(document.querySelectorAll('#main img')).every(image=>image.complete&&image.naturalWidth>0));
 await mkdir('test-results',{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/studio-sections-desktop.png',fullPage:true});
 await page.getByRole('button',{name:/Cambiar imagen/}).click();await page.locator('#editor').waitFor({state:'visible'});await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'test-results/studio-sections-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Section editor passed: site order, Spanish-only editing, ten real translations, read-only French review, section image editor and mobile layout.');
}finally {
 await browser.close();
 const current=await api(path),spanish=current.find(row=>row.locale==='es');
 if(spanish.value!==value && spanish.value!==original.value)throw new Error('The original changed concurrently. Inspect this section before restoring the QA bundle.');
 await api('/items/site_texts','PATCH',snapshot.map(row=>({id:row.id,value:row.value,status:row.status,source_hash:row.source_hash??null,auto_translated:row.auto_translated??null,translated_at:row.translated_at??null})));
 const added=current.filter(row=>!snapshot.some(old=>old.id===row.id));if(added.length)await api('/items/site_texts','DELETE',added.map(row=>row.id));
 console.log('Original Spanish copy and all translations restored exactly. No preview publication triggered.');
}
