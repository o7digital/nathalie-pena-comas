// Isolated calendar fixtures. Never edits the customer's content or contacts ticket providers.
import {chromium} from '@playwright/test';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {createStudioServer} from './server.mjs';
import siteMap from './site-map.json' with {type:'json'};
import official from '../schedule-official-2026-11-08.json' with {type:'json'};
const server=createStudioServer({cms:'http://unused.test',secret:'isolated-calendar-browser-secret-32-characters'});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const upcoming=official.events.filter(row=>row.date>=today),history=official.events.filter(row=>row.date<today);
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];let writes=0;page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(request.method()!=='GET'){writes++;throw new Error('Unexpected calendar mutation');}
  const fixtures={
   '/api/config':{preview:'https://preview.example.test/es/',translationReady:true},'/api/session':{name:'Calendar fixture'},'/api/site-map':siteMap,
   '/api/content':{content:{concerts:official.events.map((row,sort)=>({...row,sort,status:'published'})),gallery:[],albums:[],videos:[],site_images:[],site_texts:[]}},
  };
  return route.fulfill({status:fixtures[path]?200:404,json:fixtures[path]||{error:'Unexpected fixture route'}});
 });
 await page.goto(origin+'/#concerts');await page.locator('#agenda-period').waitFor();assert.equal(await page.locator('#agenda-period').inputValue(),'upcoming');
 assert.equal(await page.locator('#items tbody tr').count(),upcoming.length);
 assert.match(await page.locator('#items tbody tr').first().textContent(),/Brahms/);
 assert.deepEqual(await page.locator('#navigation a').evaluateAll(rows=>rows.slice(1,4).map(row=>row.getAttribute('href'))),['#home','#concerts','#about']);
 await page.locator('#agenda-period').selectOption('history');assert.equal(await page.locator('#items tbody tr').count(),history.length);assert.match(await page.locator('#items tbody tr').first().textContent(),/Mahler/);
 await page.locator('#agenda-period').selectOption('all');assert.equal(await page.locator('#items tbody tr').count(),official.events.length);
 await page.locator('#search').fill('Quinto Elemento');assert.equal(await page.locator('#items tbody tr').count(),2);
 await page.locator('#items [data-edit="concert-2027-04-07"]').click();await page.locator('#editor').waitFor();
 assert.equal(await page.locator('#editor [name=date]').inputValue(),'2027-04-07');assert.equal(await page.locator('#editor [name=ticket_status]').inputValue(),'soon');assert.equal(await page.locator('#editor [name=url]').inputValue(),'https://www.tuboleta.com.do/');
 await page.locator('#cancel-editor').click();assert.equal(writes,0);
 await page.locator('#search').fill('');await page.locator('#agenda-period').selectOption('upcoming');await page.screenshot({path:'/tmp/nathalie-agenda-studio-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/nathalie-agenda-studio-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({calendarStudio:'passed',upcoming:upcoming.length,history:history.length,sourceEvents:official.events.length,editableTicketFields:true,orderedSiteSections:true,mobile:true,writes}));
}finally{await browser.close();server.closeAllConnections();server.close();}
