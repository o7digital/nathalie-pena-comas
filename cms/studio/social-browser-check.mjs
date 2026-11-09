// Browser contract with isolated API fixtures. Never connects or publishes to a real account.
import {chromium} from '@playwright/test';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {createStudioServer} from './server.mjs';
const server=createStudioServer({cms:'http://unused.test',secret:'native-social-isolated-browser-secret-32-characters'});server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
const channels=[{id:'00000000-0000-4000-a000-000000000001',provider:'facebook',name:'Nathalie fixture',state:'CONNECTED',profileUrl:'https://www.facebook.com/fixture'}];
let posts=[],approvals=0,failSave=false,saveCalls=0;
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;
  const id=path.match(/^\/api\/social\/posts\/([^/]+)(?:\/(approve|cancel|refresh))?$/);
  if(path==='/api/social/posts'&&request.method()==='POST'){
   saveCalls++;if(failSave){failSave=false;return route.fulfill({status:503,json:{error:'Fixture save failed; keep your message.'}});}
   const input=request.postDataJSON();assert(!Object.hasOwn(input,'media'));const row={...input,id:'post-'+posts.length,version:1,status:'DRAFT',media:null,deliveries:[]};posts.unshift(row);return route.fulfill({json:row});
  }
  if(id){const row=posts.find(p=>p.id===id[1]);
   if(request.method()==='PATCH'){Object.assign(row,request.postDataJSON(),{version:row.version+1});return route.fulfill({json:row});}
   if(id[2]==='approve'){approvals++;const input=request.postDataJSON();assert.equal(input.action,'SCHEDULE');assert.equal(input.version,row.version);row.status='SCHEDULED';row.scheduledAt=input.scheduledAt;row.version++;row.deliveries=[{id:'delivery-1',state:'QUEUED',channel:channels[0]}];return route.fulfill({json:row});}
   if(id[2]==='cancel'){row.status='CANCELED';row.version++;row.deliveries[0].state='CANCELED';return route.fulfill({json:row});}
   return route.fulfill({json:row});
  }
  const data={
   '/api/config':{preview:'https://preview.example.test/es/'},'/api/session':{name:'Test owner',reportingOwner:true},'/api/site-map':{sections:[]},
   '/api/content':{content:{gallery:[],concerts:[],videos:[],albums:[],site_images:[],site_texts:[]}},
   '/api/social':{offer:{enabled:true,amountMinor:900,currency:'USD'},tenantName:'Nathalie fixture',channels,posts,counts:Object.fromEntries(['DRAFT','SCHEDULED','PUBLISHED'].map(status=>[status,posts.filter(p=>p.status===status).length])),providers:[{id:'instagram',oauth:'meta',configured:false},{id:'facebook',oauth:'meta',configured:true},{id:'youtube',oauth:'youtube',configured:false},{id:'x',oauth:'x',configured:false}]},
   '/api/social/calendar':posts.filter(p=>p.scheduledAt),
  };
  return route.fulfill({status:data[path]?200:404,json:data[path]||{error:'Unmocked path '+path}});
 });
 await page.goto(origin+'/#social');await page.getByRole('heading',{name:'Comparte tu universo.'}).waitFor();await page.getByRole('button',{name:'＋ Nueva publicación',exact:true}).click();
 await page.locator('#social-composer [name=title]').fill('Un concierto para compartir');await page.locator('#social-composer [name=text]').fill('Nuestro nuevo escenario.');await page.locator('#social-composer [name=channel]').check();
 failSave=true;await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.locator('#social-form-error').filter({hasText:'keep your message'}).waitFor();assert.equal(await page.locator('#social-composer [name=text]').inputValue(),'Nuestro nuevo escenario.');assert.equal(approvals,0);
 await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.locator('#toast').filter({hasText:'Borrador guardado'}).waitFor();assert.equal(posts.length,1);assert.equal(approvals,0);
 await page.locator('#social-composer [name=timezone]').selectOption('Europe/Vienna');
 const future=new Date(Date.now()+3*86400000).toISOString().slice(0,10)+'T18:30';await page.locator('#social-composer [name=plannedLocal]').fill(future);
 await page.getByRole('button',{name:'Programar ↗',exact:true}).click();await page.locator('#social-approval').waitFor();assert.equal(approvals,0);await page.getByRole('button',{name:'Seguir editando'}).click();assert.equal(approvals,0);
 await page.getByRole('button',{name:'Programar ↗',exact:true}).click();await page.getByRole('button',{name:'Sí, programar esta publicación'}).click();await page.locator('.social-post-row').filter({hasText:'Programada'}).waitFor();assert.equal(approvals,1);
 await page.getByRole('button',{name:'Calendario',exact:true}).click();await page.locator('.social-calendar-grid').waitFor();assert.equal(await page.locator('.social-calendar-post').count(),1);
 await page.getByRole('button',{name:'Mis cuentas',exact:true}).click();await page.getByRole('heading',{name:'Elige dónde quieres estar.'}).waitFor();
 assert.equal(await page.locator('.social-network').count(),4);assert.equal(await page.getByRole('button',{name:'Conectar Instagram ↗',exact:true}).isDisabled(),true);assert.equal(await page.locator('.social-music a[href*="spotify.com/artist/"]').count(),1);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/tmp/nathalie-native-social-connections.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/nathalie-native-social-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Crear publicación',exact:true}).click();await page.locator('#social-composer').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.setViewportSize({width:1500,height:1000});await page.screenshot({path:'/tmp/nathalie-native-social-composer.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({socialBrowser:'passed',saveFailurePreservesText:true,approvals,explicitReviewRequired:true,networks:4,spotify:'music only',calendar:'passed',mobile:'passed',saveCalls}));
}finally{await browser.close();server.closeAllConnections();server.close();}
