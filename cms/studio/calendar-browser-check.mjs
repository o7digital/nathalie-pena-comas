// Isolated calendar fixtures: manual writes below never reach customer content or a ticket provider.
import {chromium} from '@playwright/test';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {createStudioServer} from './server.mjs';
import siteMap from './site-map.json' with {type:'json'};
import official from '../schedule-official-2026-11-08.json' with {type:'json'};
const server=createStudioServer({cms:'http://unused.test',secret:'isolated-calendar-browser-secret-32-characters'});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
const today='2026-11-14',rows=official.events.map((row,sort)=>({...row,sort,status:'published'})),writes=[];
let failNext=false;
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
 await page.clock.setFixedTime(new Date('2026-11-14T18:00:00Z'));
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(request.method()!=='GET'){
   assert.match(path,/^\/api\/content\/concerts(?:\/manual-fixture)?$/);
   if(failNext){failNext=false;return route.fulfill({status:503,json:{error:'No se pudo guardar. Conserva tus datos.'}});}
   const data=request.postDataJSON();writes.push({path,data,method:request.method()});
   if(request.method()==='POST')rows.push({id:'manual-fixture',...data});else Object.assign(rows.find(row=>row.id==='manual-fixture'),data);
   return route.fulfill({status:request.method()==='POST'?201:200,json:{data:{id:'manual-fixture',...data}}});
  }
  const fixtures={
   '/api/config':{preview:'https://preview.example.test/es/',translationReady:true},'/api/session':{name:'Calendar fixture'},'/api/site-map':siteMap,
   '/api/content':{content:{concerts:rows,gallery:[],albums:[],videos:[],site_images:[],site_texts:[]}},
  };
  return route.fulfill({status:fixtures[path]?200:404,json:fixtures[path]||{error:'Unexpected fixture route'}});
 });
 await page.goto(origin+'/#concerts');await page.locator('.agenda-month-grid').waitFor();
 assert.equal(await page.locator('[data-calendar-date]').count(),42);
 assert.equal(await page.locator('#agenda-month').inputValue(),'11');assert.equal(await page.locator('#agenda-year').inputValue(),'2026');
 assert.equal(await page.locator('[data-calendar-date="2026-11-15"] [data-edit]').count(),1);
 assert.equal(await page.locator('[data-calendar-date="2026-11-04"] [data-edit]').count(),1);
 assert.equal(await page.locator('[aria-current=date]').count(),1);
 assert.deepEqual(await page.locator('#navigation a').evaluateAll(links=>links.slice(1,4).map(link=>link.getAttribute('href'))),['#home','#concerts','#about']);
 await page.locator('[data-agenda-step="1"]').click();assert.equal(await page.locator('#agenda-month').inputValue(),'12');
 await page.locator('[data-agenda-step="1"]').click();assert.equal(await page.locator('#agenda-year').inputValue(),'2027');assert.equal(await page.locator('#agenda-month').inputValue(),'01');
 await page.locator('#agenda-month').selectOption('07');assert.equal(await page.locator('.agenda-event').count(),6);
 await page.locator('[data-agenda-view=list]').click();
 assert.equal(await page.locator('#items tbody tr').count(),official.events.filter(row=>row.date>=today).length);
 await page.locator('#agenda-period').selectOption('history');assert.equal(await page.locator('#items tbody tr').count(),official.events.filter(row=>row.date<today).length);
 await page.locator('#agenda-period').selectOption('all');assert.equal(await page.locator('#items tbody tr').count(),official.events.length);
 await page.locator('#search').fill('Quinto Elemento');assert.equal(await page.locator('#items tbody tr').count(),2);
 await page.locator('[data-edit="concert-2027-04-07"]').click();
 assert.equal(await page.locator('#event-day').inputValue(),'7');assert.equal(await page.locator('#event-month').inputValue(),'4');assert.equal(await page.locator('#event-year').inputValue(),'2027');
 assert.equal(await page.locator('#editor [name=ticket_status]').inputValue(),'available');assert.equal(await page.locator('#editor [name=url]').inputValue(),'https://www.tuboleta.com.do/nathaliepe%C3%B1a-comas');
 await page.locator('#cancel-editor').click();assert.equal(writes.length,0);
 await page.locator('#search').fill('');await page.locator('[data-agenda-view=calendar]').click();await page.locator('[data-agenda-today]').click();
 await page.locator('[data-new-date="2026-11-18"]').focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator('#event-day').inputValue(),'18');assert.equal(await page.locator('#editor [name=date]').inputValue(),'2026-11-18');
 await page.locator('#editor [name=title]').fill('Mi recital manual');await page.locator('#editor [name=ensemble]').fill('Mi ensemble');
 await page.locator('#editor [name=venue]').fill('Mi teatro');await page.locator('#editor [name=city]').fill('Viena, Austria');
 await page.locator('#event-year').fill('2027');await page.locator('#event-month').selectOption('2');await page.locator('#event-day').fill('31');
 await page.locator('#editor-form [type=submit]').click();assert.equal(writes.length,0);assert.match(await page.locator('[data-date-description]').textContent(),/no existe/);
 await page.locator('#event-year').fill('2028');await page.locator('#event-day').fill('29');
 assert.equal(await page.locator('#editor [name=date]').inputValue(),'2028-02-29');
 await page.screenshot({path:'/tmp/nathalie-agenda-manual-editor.png',fullPage:true});
 failNext=true;await page.locator('#editor-form [type=submit]').click();await page.locator('#editor-error').filter({hasText:'Conserva tus datos'}).waitFor();
 assert.equal(await page.locator('#editor [name=title]').inputValue(),'Mi recital manual');assert.equal(await page.locator('#event-day').inputValue(),'29');assert.equal(writes.length,0);
 await page.locator('#editor-form [type=submit]').click();await page.locator('[data-edit=manual-fixture]').waitFor();
 assert.equal(writes.length,1);assert.equal(writes[0].data.date,'2028-02-29');assert.equal(writes[0].data.status,'draft');assert.equal(writes[0].data.venue,'Mi teatro');
 assert(!Object.keys(writes[0].data).some(key=>key.startsWith('date-')));
 await page.locator('[data-edit=manual-fixture]').click();await page.locator('#event-year').fill('2029');await page.locator('#event-month').selectOption('1');await page.locator('#event-day').fill('15');
 await page.locator('#editor [name=title]').fill('Mi recital editado');await page.locator('#editor-form [type=submit]').click();await page.locator('[data-calendar-date="2029-01-15"] [data-edit=manual-fixture]').waitFor();
 assert.equal(writes.length,2);assert.equal(writes[1].method,'PATCH');assert.equal(writes[1].data.date,'2029-01-15');
 await page.locator('[data-agenda-today]').click();await page.screenshot({path:'/tmp/nathalie-agenda-studio-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/nathalie-agenda-studio-mobile.png',fullPage:true});
 await page.locator('[data-new-date="2026-11-18"]').click();assert.equal(await page.locator('#event-day').isVisible(),true);assert.equal(await page.locator('#event-month').isVisible(),true);assert.equal(await page.locator('#event-year').isVisible(),true);
 await page.screenshot({path:'/tmp/nathalie-agenda-studio-mobile-editor.png',fullPage:true});await page.locator('#cancel-editor').click();
 assert.deepEqual(errors,[]);assert.deepEqual(rows.slice(0,official.events.length).map(({sort,status,...row})=>row),official.events);
 console.log(JSON.stringify({manualCalendar:'passed',months:true,yearBoundary:true,manualCreation:true,manualEditing:true,invalidDateBlocked:true,failedSavePreserved:true,keyboard:true,mobile:true,existingEventsPreserved:official.events.length,isolatedWrites:writes.length}));
}finally{await browser.close();server.closeAllConnections();server.close();}
