// Isolated browser fixtures. No real Stripe session, customer or charge.
import {chromium} from '@playwright/test';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {createStudioServer} from './server.mjs';
const server=createStudioServer({cms:'http://unused.test',secret:'annual-billing-isolated-browser-secret-32'});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
let requests=0,subscribed=false,fail=false;
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://checkout.stripe.com/**',route=>route.fulfill({body:'<h1>Isolated Stripe checkout fixture</h1>',contentType:'text/html'}));
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(path==='/api/social/billing/checkout'){requests++;assert.equal(request.method(),'POST');assert.deepEqual(request.postDataJSON(),{});return route.fulfill({status:fail?503:200,json:fail?{error:'Stripe indisponible — réessayez'}:{url:'https://checkout.stripe.com/c/pay/fixture',mode:'test'}});}
  const fixtures={
   '/api/config':{preview:'https://preview.example.test/es/'},'/api/session':{name:'Billing fixture',reportingOwner:true},'/api/site-map':{sections:[]},
   '/api/content':{content:{gallery:[],albums:[],concerts:[],videos:[],site_images:[],site_texts:[]}},
   '/api/subscription':{amountMinor:null,currency:'USD',includedUntil:'2027-11-08T00:00:00Z',social:{amountMinor:8900,monthlyReferenceMinor:900,currency:'USD',interval:'year',paymentMode:'test',checkoutAvailable:true,subscribed,status:subscribed?'ACTIVE':'PROPOSAL',currentPeriodEnd:subscribed?'2027-11-08T00:00:00Z':null,cancelAtPeriodEnd:subscribed}},
  };
  return route.fulfill({status:fixtures[path]?200:404,json:fixtures[path]||{error:'Unexpected fixture route'}});
 });
 await page.goto(origin+'/#subscription');await page.locator('.social-subscription').waitFor();
 assert.match(await page.locator('.social-subscription .report-money').textContent(),/89.*año/);
 assert.match(await page.locator('.social-subscription').textContent(),/19.*al año/);assert.match(await page.locator('.social-subscription').textContent(),/Modo de prueba/);assert.equal(requests,0);
 await page.getByRole('button',{name:'Probar pago anual ↗',exact:true}).click();await page.locator('dialog.social-dialog').waitFor();
 await page.getByRole('button',{name:'Volver',exact:true}).click();assert.equal(requests,0);
 await page.getByRole('button',{name:'Probar pago anual ↗',exact:true}).click();await page.getByRole('button',{name:'Continuar a Stripe ↗',exact:true}).click();assert.equal(requests,0);
 fail=true;await page.locator('dialog.social-dialog input[type=checkbox]').check();await page.getByRole('button',{name:'Continuar a Stripe ↗',exact:true}).click();await page.locator('[data-social-billing-error]').filter({hasText:'réessayez'}).waitFor();assert.equal(requests,1);
 fail=false;await page.getByRole('button',{name:'Probar pago anual ↗',exact:true}).click();await page.locator('dialog.social-dialog input[type=checkbox]').check();await page.getByRole('button',{name:'Continuar a Stripe ↗',exact:true}).click();await page.waitForURL('https://checkout.stripe.com/**');assert.equal(requests,2);
 subscribed=true;await page.goto(origin+'/#subscription');await page.getByRole('button',{name:'Gestionar mi suscripción ↗',exact:true}).waitFor();
 assert.match(await page.locator('.social-subscription').textContent(),/Renovación automática cancelada/);assert.match(await page.locator('.plan-card').first().textContent(),/12 meses incluidos/);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/nathalie-social-annual-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('Annual subscription browser passed: 89 USD/year, 19 USD saving, explicit consent, no payment on cancel, test label, retry after error, Stripe handoff, renewal cancellation and mobile.');
}finally{await browser.close();server.closeAllConnections();server.close();}
