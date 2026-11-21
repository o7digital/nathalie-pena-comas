// Full database workflows against isolated fixtures; never writes customer data.
import {firefox} from '@playwright/test';
import {once} from 'node:events';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createStudioServer} from './server.mjs';
import {contactKeys,parseContactsCsv} from './public/arm-data.js';
import siteMap from './site-map.json' with {type:'json'};
const server=createStudioServer({cms:'http://unused.test',secret:'isolated-browser-test-secret-with-32-characters'});
server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
const browser=await firefox.launch();
const client={id:'contact-1',firstName:'Test',name:'Programmer',company:'Test theatre',companySector:'Festival',email:'test@example.test',clientStatus:'PROSPECT',notes:'Original private note',createdAt:'2026-10-01T00:00:00Z'};
const clients=[client,...Array.from({length:27},(_,i)=>({id:'extra-'+i,name:'Contact '+String(i).padStart(2,'0'),company:'Other theatre',clientStatus:'CLIENT'}))];
const stages=[{id:'new',name:'Nuevas propuestas'},{id:'confirmed',name:'Confirmadas'}];
const deals=[{id:'deal-1',title:'Test performance',pipelineId:'pipeline-1',stageId:'new',currency:'EUR',value:1200,clientId:client.id}];
const tasks=[{id:'task-1',title:'Test follow-up',clientId:client.id,status:'PENDING'}];
const writes=[],errors=[],drafts=[];let failSave=false;
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,method=req.method();
  if(path==='/api/arm/mail/status')return route.fulfill({json:{connected:false}});
  if(path==='/api/arm/mail/drafts'){if(method==='POST'){const data=req.postDataJSON(),draft={...data,id:data.id||'mail-draft-1',revision:(data.revision||0)+1,recipients:data.contactIds.map(id=>clients.find(row=>row.id===id)),updatedAt:new Date().toISOString()};const index=drafts.findIndex(row=>row.id===draft.id);if(index<0)drafts.push(draft);else drafts[index]=draft;return route.fulfill({json:draft});}return route.fulfill({json:drafts});}
  if(path==='/api/arm/import'&&method==='POST'){
   const keys=new Set(clients.flatMap(contactKeys));const results=req.postDataJSON().rows.map((data,index)=>{
    if(contactKeys(data).some(key=>keys.has(key)))return {index,status:'duplicate'};
    const row={id:'import-'+clients.length,...data};clients.push(row);contactKeys(row).forEach(key=>keys.add(key));return {index,status:'created',id:row.id};
   });writes.push({path});return route.fulfill({json:{results}});
  }
  const match=path.match(/^\/api\/arm\/(clients|deals|tasks)(?:\/([^/]+))?$/);
  if(match&&['POST','PATCH'].includes(method)){
   const data=req.postDataJSON(),rows={clients,deals,tasks}[match[1]];
   if(failSave){failSave=false;return route.fulfill({status:422,json:{error:'No se pudo guardar la ficha. Conserva tus cambios.'}});}
   const row=method==='POST'?{id:'created-'+rows.length,...data}:rows.find(row=>row.id===match[2]);if(method==='POST')rows.push(row);else Object.assign(row,data);
   writes.push({path,data});return route.fulfill({json:row});
  }
  const payload={'/api/site-map':siteMap,'/api/config':{armReady:true,preview:origin},'/api/session':{name:'Test artist',armConnected:true},'/api/content':{content:{gallery:[],albums:[],videos:[],concerts:[],site_images:[],site_texts:[]}},'/api/arm/clients':clients,'/api/arm/deals':deals,'/api/arm/tasks':tasks,'/api/arm/pipelines':[{id:'pipeline-1',name:'Agenda artística',stages}]};
  return route.fulfill({status:Object.hasOwn(payload,path)?200:404,json:payload[path]||{error:'Unexpected API'}});
 });
 await page.goto(origin+'/#arm');await page.getByRole('heading',{name:'Tu red. Tu próximo escenario.'}).waitFor();
 assert.equal(await page.locator('#arm-results tbody tr').count(),25);await page.getByRole('button',{name:'Siguiente →',exact:true}).click();assert.equal(await page.locator('#arm-results tbody tr').count(),3);
 await page.locator('#arm-search').fill('test theatre');await page.locator('[name=arm-type]').selectOption('Festival');assert.equal(await page.locator('#arm-results tbody tr').count(),1);
 await page.getByRole('button',{name:'Abrir ficha de Test Programmer',exact:true}).click();await page.getByRole('button',{name:'Editar ficha ↗',exact:true}).click();
 await page.locator('#arm-record-form [data-facet=countries] summary').click();await page.locator('#arm-record-form [data-facet=countries] input[value="Japón"]').check();await page.locator('#arm-record-form [data-facet=countries] input[value="Austria"]').check();
 await page.locator('#arm-record-form [data-facet=roles] summary').click();await page.locator('#arm-record-form [data-facet=roles] input[value="Director/a de teatro"]').check();await page.locator('#arm-record-form [data-facet=roles] input[value="Promotor/a"]').check();await page.locator('#arm-record-form [name=gender]').selectOption('female');
 await page.locator('#arm-record-form [name=notes]').fill('Nueva nota privada\nPrograma latinoamericano');await page.locator('#arm-record-form [name=address]').fill('Viena, Austria');failSave=true;
 await page.getByRole('button',{name:'Guardar cambios ↗',exact:true}).click();await page.locator('#arm-record-error').getByText('No se pudo guardar la ficha. Conserva tus cambios.',{exact:true}).waitFor();assert.equal(await page.locator('#arm-record-form [name=notes]').inputValue(),'Nueva nota privada\nPrograma latinoamericano');
 await page.getByRole('button',{name:'Guardar cambios ↗',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#arm-editor').open);await page.getByText('Nueva nota privada\nPrograma latinoamericano',{exact:true}).waitFor();
 await page.reload();
 await page.locator('[data-mode=filter][data-facet=countries] summary').click();await page.locator('[data-mode=filter][data-facet=countries] input[value="Japón"]').check();
 await page.locator('[data-mode=filter][data-facet=roles] summary').click();await page.locator('[data-mode=filter][data-facet=roles] input[value="Director/a de teatro"]').check();assert.equal(await page.locator('#arm-results tbody tr').count(),1);
 await page.getByRole('button',{name:'Escribir a esta selección',exact:true}).click();await page.locator('#olivia-composer').waitFor();assert(await page.locator('[data-mail-send]').isDisabled());await page.locator('#olivia-subject').fill('Invitación a concierto');await page.locator('#olivia-message').fill('Hola, te invito a nuestro próximo concierto.');await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.locator('#olivia-save-status').getByText('Borrador guardado en tu espacio privado.',{exact:true}).waitFor();assert.deepEqual(drafts[0].contactIds,[client.id]);await page.getByRole('button',{name:'Cerrar correo',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'Borradores · Olivia One',exact:true}).click();await page.locator('[data-mail-draft]').click();await page.locator('#olivia-message').getByText('Hola, te invito a nuestro próximo concierto.',{exact:true}).waitFor();assert.equal(await page.locator('#olivia-subject').inputValue(),'Invitación a concierto');await page.getByRole('button',{name:'Cerrar correo',exact:true}).click();
 await page.locator('#arm-search').fill('test@example.test');await page.getByRole('button',{name:'Abrir ficha de Test Programmer',exact:true}).click();await page.getByText('Viena, Austria',{exact:true}).waitFor();
 await page.getByRole('button',{name:'＋ Nueva tarea',exact:true}).click();assert.equal(await page.locator('#arm-record-form [name=clientId]').inputValue(),client.id);await page.locator('#arm-record-form [name=title]').fill('Enviar programa');await page.locator('#arm-record-form [name=dueDate]').fill('2026-12-15');await page.locator('#arm-record-form [name=priority]').selectOption('HIGH');await page.getByRole('button',{name:'Guardar cambios ↗',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#arm-editor').open);
 await page.getByRole('button',{name:'＋ Nueva propuesta',exact:true}).click();assert.equal(await page.locator('#arm-record-form [name=clientId]').inputValue(),client.id);await page.locator('#arm-record-form [name=title]').fill('Recital Viena');await page.locator('#arm-record-form [name=value]').fill('2500');await page.getByRole('button',{name:'Guardar cambios ↗',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#arm-editor').open);
 await page.getByRole('button',{name:'Propuestas y oportunidades',exact:true}).click();await page.getByRole('combobox',{name:'Etapa de Recital Viena',exact:true}).selectOption('confirmed');await page.waitForFunction(()=>document.querySelector('[data-arm-stage="created-1"]')?.value==='confirmed'&&!document.querySelector('[data-arm-stage="created-1"]').disabled);
 await page.getByRole('button',{name:'Los siguientes pasos',exact:true}).click();await page.getByRole('combobox',{name:'Estado de Enviar programa',exact:true}).selectOption('DONE');await page.waitForFunction(()=>document.querySelector('[data-arm-task="created-1"]')?.value==='DONE'&&!document.querySelector('[data-arm-task="created-1"]').disabled);
 await page.getByRole('button',{name:'Contactos profesionales',exact:true}).click();await page.locator('#arm-search').fill('test@example.test');
 const downloadPending=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar selección',exact:true}).click();const download=await downloadPending;const exported=parseContactsCsv(await readFile(await download.path(),'utf8'));assert.equal(exported.length,1);assert.equal(exported[0].contact.notes,client.notes);
 await page.getByRole('button',{name:'Importar CSV',exact:true}).click();await page.locator('#arm-csv-file').setInputFiles({name:'invalid.csv',mimeType:'text/csv',buffer:Buffer.from('name,email\n,invalid')});await page.locator('.arm-import-summary').getByText('1 con errores',{exact:true}).waitFor();assert(await page.getByRole('button',{name:'Importar 0 contactos',exact:true}).isDisabled());
 await page.locator('#arm-csv-file').setInputFiles({name:'contacts.csv',mimeType:'text/csv',buffer:Buffer.from('firstName,name,email,company\nTest,Programmer,test@example.test,Test theatre\nMaría,Peña,maria@example.test,Ópera\nJean,Martin,jean@example.test,Paris')});
 await page.getByRole('button',{name:'Importar 2 contactos',exact:true}).click();await page.locator('.arm-import-summary').getByText('2 creadas',{exact:true}).waitFor();await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.locator('#arm-search').fill('maria@example.test');await page.getByRole('button',{name:'Abrir ficha de María Peña',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/arm-database-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByRole('button',{name:'Editar ficha ↗',exact:true}).click();assert(await page.evaluate(()=>document.querySelector('#arm-editor').scrollWidth<=document.querySelector('#arm-editor').clientWidth));await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'← Volver a la base de contactos',exact:true}).click();await page.locator('#arm-search').fill('');await page.locator('[name=arm-type]').selectOption('');await page.screenshot({path:'test-results/arm-database-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/arm-list-mobile.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByRole('button',{name:'Importar CSV',exact:true}).click();
 await page.evaluate(()=>{const read=File.prototype.text;File.prototype.text=async function(){const text=await read.call(this);if(this.name==='slow.csv')await new Promise(resolve=>setTimeout(resolve,250));return text;};});
 await page.locator('#arm-csv-file').setInputFiles({name:'slow.csv',mimeType:'text/csv',buffer:Buffer.from('name\nSlow contact')});await page.keyboard.press('Escape');await page.waitForTimeout(300);
 assert.equal(await page.locator('#arm-editor').evaluate(dialog=>dialog.open),false,'A cancelled file read must not reopen the dialog');
 assert(writes.some(row=>row.path==='/api/arm/clients/contact-1'&&row.data.address==='Viena, Austria'));assert(writes.some(row=>row.path==='/api/arm/import'));assert.equal(tasks[1].clientId,client.id);assert.equal(deals[1].stageId,'confirmed');assert.deepEqual(errors,[]);
 console.log('ARM database browser checks passed: pagination, search, classification, profile edit/reload, failure recovery, linked proposals/tasks, stages/statuses, filtered CSV export, import validation/deduplication, mobile and keyboard-compatible dialogs.');
}finally{await browser.close();server.closeAllConnections();server.close();}
