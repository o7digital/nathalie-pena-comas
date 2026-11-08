// Isolated browser fixtures. Never imports into the real client CMS or changes billing.
import {chromium} from '@playwright/test';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {createStudioServer} from './server.mjs';
const server=createStudioServer({cms:'http://unused.test',secret:'isolated-reporting-browser-secret-32-characters'});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
const names=['ga4','instagram','facebook','youtube','tiktok','linkedin','x','apple-music','shopify'];
let rows=[],amount=null,imports=0;
try {
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/reporting/import') {
   const input=route.request().postDataJSON();assert.equal(input.provider,'instagram');assert.match(input.csv,/profile_visits/);imports++;
   rows=[{provider:'instagram',date:'2026-11-01',channel:'Nathalie',metric:'profile_visits',value:125,currency:null,source:input.source,method:'import',updatedAt:'2026-11-02T00:00:00Z'},...['EUR','USD'].map((currency,i)=>({provider:'apple-music',date:'2026-11-01',channel:'Apple Music',metric:'royalties',value:i?20:12,currency,source:'Distributor',method:'import',updatedAt:'2026-11-02T00:00:00Z'}))];
   return route.fulfill({json:{ok:true,rows:1}});
  }
  const data={
   '/api/config':{preview:'https://preview.example.test/es/',includedUntil:'2027-11-08T00:00:00Z'},
   '/api/session':{name:'O7 test',reportingOwner:true},'/api/site-map':{sections:[]},
   '/api/content':{content:{gallery:[],albums:[],concerts:[],videos:[],site_images:[],site_texts:[]}},
   '/api/subscription':{amountMinor:amount,currency:'USD',automaticBilling:false,includedUntil:'2027-11-08T00:00:00Z'},
   '/api/reporting':{start:'2026-11-01',end:'2026-11-02',rows,generatedAt:'2026-11-02T00:00:00Z',sources:names.map(provider=>({provider,status:rows.some(r=>r.provider===provider)?'imported':'pending'}))},
  };
  return route.fulfill({status:data[path]?200:404,json:data[path]||{error:'Unmocked path '+path}});
 });
 await page.goto(origin+'/#analytics');await page.getByRole('heading',{name:'Analytics & Reporting',exact:true}).waitFor();
 await page.locator('#report-range button').filter({hasText:'Ver informe'}).waitFor();
 assert.equal(await page.locator('.report-kpi').first().locator('strong').textContent(),'—');
 assert.equal(await page.locator('.report-chart').count(),0);
 await page.locator('#report-range [name=start]').fill('2026-11-01');await page.locator('#report-range [name=end]').fill('2026-11-02');await page.locator('#report-range button').click();
 await page.locator('.report-import>summary').click();
 await page.locator('#report-import [name=source]').fill('Instagram export');
 await page.locator('#report-import [name=file]').setInputFiles({name:'instagram.csv',mimeType:'text/csv',buffer:Buffer.from('date,channel,metric,value,currency\n2026-11-01,Nathalie,profile_visits,125,')});
 await page.locator('#report-import button').click();await page.locator('.report-network-totals').waitFor();assert.equal(imports,1);
 assert.match(await page.locator('.report-network-totals').textContent(),/Instagram 125/);
 assert.match(await page.locator('.report-kpi').last().textContent(),/12.*20/);
 assert.equal(await page.locator('.report-kpi').first().locator('strong').textContent(),'—');
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/tmp/nathalie-reporting-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'/tmp/nathalie-reporting-mobile.png',fullPage:true});
 await page.evaluate(()=>location.hash='subscription');await page.getByRole('heading',{name:'Mi suscripción',exact:true}).waitFor();await page.locator('.reporting-plan').waitFor();
 assert.match(await page.locator('.reporting-plan').textContent(),/Por definir/);assert.match(await page.locator('.plan-card').first().textContent(),/2027/);
 amount=2500;await page.evaluate(()=>location.hash='analytics');await page.locator('#report-range').waitFor();await page.evaluate(()=>location.hash='subscription');await page.locator('.reporting-plan').waitFor();
 assert.match(await page.locator('.reporting-plan .report-money').textContent(),/25/);assert.match(await page.locator('.reporting-plan').textContent(),/no activa cobros automáticos/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 console.log('Reporting browser passed: honest empty states, social CSV import, chart, separate currencies, quote display, CSV export link, desktop and mobile.');
}finally{await browser.close();server.closeAllConnections();server.close();}
