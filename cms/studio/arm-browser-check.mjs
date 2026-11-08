// UI contract check against isolated fixtures. Never creates customer CRM data.
import { chromium } from '@playwright/test';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { createStudioServer } from './server.mjs';
import siteMap from './site-map.json' with {type:'json'};
const server=createStudioServer({cms:'http://unused.test',secret:'isolated-browser-test-secret-with-32-characters'});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
const client={id:'contact-1',firstName:'Test',name:'Programmer',company:'Test theatre'};
const stages=[{id:'new',name:'Nuevas propuestas'},{id:'confirmed',name:'Confirmadas'}];
const deal={id:'deal-1',title:'Test performance',pipelineId:'pipeline-1',stageId:'new',currency:'EUR',value:1200,client};
const task={id:'task-1',title:'Test follow-up',client,status:'PENDING'};
const writes=[],errors=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  const payload={
   '/api/site-map':siteMap,'/api/config':{armReady:true,preview:origin},'/api/session':{name:'Test artist',armConnected:true},
   '/api/content':{content:{gallery:[],albums:[],videos:[],concerts:[],site_images:[],site_texts:[]}},
   '/api/arm/clients':[client],'/api/arm/deals':[deal],'/api/arm/tasks':[task],'/api/arm/pipelines':[{id:'pipeline-1',name:'Agenda artística',stages}],
  };
  if(request.method()==='PATCH'){
   const data=request.postDataJSON();writes.push({path,data});if(path.endsWith('deal-1'))Object.assign(deal,data);if(path.endsWith('task-1'))Object.assign(task,data);
   return route.fulfill({json:{ok:true}});
  }
  if(request.method()==='POST'&&path==='/api/arm/clients'){writes.push({path,data:request.postDataJSON()});return route.fulfill({json:{id:'new-contact'}});}
  return route.fulfill({status:Object.hasOwn(payload,path)?200:404,json:payload[path]||{error:'Unexpected test API path'}});
 });
 await page.goto(origin+'/#arm');await page.getByRole('heading',{name:'Las relaciones que te impulsan.'}).waitFor();
 assert.match(await page.locator('#arm-content').textContent(),/Test Programmer/);
 await page.getByRole('button',{name:'Añadir contacto'}).click();await page.locator('#editor-form [name=name]').fill('Test new contact');await page.getByRole('button',{name:/Guardar cambios/}).click();await page.waitForFunction(()=>!document.querySelector('#editor').open);
 await page.getByRole('button',{name:'Propuestas y oportunidades',exact:true}).click();await page.getByRole('heading',{name:'Test performance',exact:true}).waitFor();
 await page.getByRole('combobox',{name:'Etapa de Test performance'}).selectOption('confirmed');
 await page.waitForFunction(()=>document.querySelector('[data-deal-stage]')?.value==='confirmed'&&!document.querySelector('[data-deal-stage]').disabled);
 assert(writes.some(row=>row.path.endsWith('/deals/deal-1')&&row.data.stageId==='confirmed'));
 await page.getByRole('button',{name:'Los siguientes pasos',exact:true}).click();await page.getByRole('combobox',{name:'Estado de Test follow-up'}).selectOption('DONE');
 await page.waitForFunction(()=>document.querySelector('[data-task-status]')?.value==='DONE'&&!document.querySelector('[data-task-status]').disabled);
 assert(writes.some(row=>row.path.endsWith('/tasks/task-1')&&row.data.status==='DONE'));
 assert(writes.some(row=>row.path==='/api/arm/clients'&&row.data.name==='Test new contact'));
 assert.deepEqual(errors,[]);console.log('ARM UI contract passed: contact form, pipeline stages and task status updates. Fixtures only; no customer data created.');
}finally{await browser.close();server.closeAllConnections();server.close();}
