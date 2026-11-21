// Real, scoped CRM verification. Requires the Nathalie Directus dev variables and Railway CLI access.
import { firefox } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const origin='https://studio-dev-4236.up.railway.app';
if(process.env.PUBLIC_URL!=='https://directus-dev-9ae1.up.railway.app' || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) throw new Error('Use the Nathalie Directus dev variables.');
const result=spawnSync('railway',['variable','list','--project','1601ae79-f088-42ca-b8d9-0700627bb4c3','--environment','dev','--service','studio','--json'],{encoding:'utf8'});
if(result.status!==0) throw new Error('Cannot read the Studio connector configuration.');
const config=JSON.parse(result.stdout);
const deployment=JSON.parse(await readFile(new URL('../deployment.json',import.meta.url),'utf8'));
assert.equal(config.ARM_TENANT_ID,deployment.crmSubscription.tenantId);
assert.equal(config.ARM_API_URL,'https://api.crm.o7digitalgroup.com/api');
let token;
async function crm(path,method='GET',body) {
 const response=await fetch(config.ARM_API_URL+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const data=response.status===204?null:await response.json();
 if(!response.ok) throw new Error('CRM verification '+method+' '+path+': '+response.status);
 return data;
}
token=(await crm('/auth/login','POST',{email:config.ARM_SERVICE_EMAIL,password:config.ARM_SERVICE_PASSWORD})).token;
assert.equal((await crm('/auth/me')).user.tenantId,config.ARM_TENANT_ID);
const created=[],errors=[],privateCreated=[];
async function cms(path,method='GET',body){const response=await fetch(process.env.PUBLIC_URL+path,{method,headers:{Authorization:'Bearer '+process.env.ADMIN_TOKEN,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!response.ok)throw Error('Private QA cleanup/check: '+response.status);return response.status===204?null:response.json();}
const browser=await firefox.launch();
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin+'/#arm');await page.locator('input[name=email]').fill(process.env.ADMIN_EMAIL);await page.locator('input[name=password]').fill(process.env.ADMIN_PASSWORD);await page.getByRole('button',{name:/Entrar a mi Studio/}).click();
 await page.getByRole('heading',{name:'Tu red. Tu próximo escenario.'}).waitFor();
 assert.match(await page.locator('#workspace-plan').textContent(),/2027/);
 const title='Studio ARM QA '+Date.now();
 async function save(resource) {
  const pending=page.waitForResponse(response=>response.url().endsWith('/api/arm/'+resource)&&response.request().method()==='POST');
  await page.getByRole('button',{name:/Guardar cambios/}).click();const response=await pending;
  assert(response.ok(),'Studio '+resource+' create: '+response.status());const data=await response.json();assert(data.id);created.push([resource,data.id]);
  await page.waitForFunction(()=>!document.querySelector('#arm-editor').open);
 }
 await page.getByRole('button',{name:/Añadir contacto/}).click();await page.locator('#arm-record-form [name=name]').fill(title);await page.locator('#arm-record-form [name=company]').fill('Private verification');await page.locator('#arm-record-form [name=email]').fill('studio-arm-qa-'+Date.now()+'@example.test');await page.locator('#arm-record-form [data-facet=relationshipTypes] summary').click();await page.locator('#arm-record-form [data-facet=relationshipTypes] input[value=Festival]').check();await page.locator('#arm-record-form [data-facet=countries] summary').click();await page.locator('#arm-record-form [data-facet=countries] input[value="Japón"]').check();await page.locator('#arm-record-form [data-facet=countries] input[value="Austria"]').check();await page.locator('#arm-record-form [data-facet=roles] summary').click();await page.locator('#arm-record-form [data-facet=roles] input[value="Director/a de teatro"]').check();await page.locator('#arm-record-form [data-facet=roles] input[value="Promotor/a"]').check();await page.locator('#arm-record-form [name=gender]').selectOption('female');await page.locator('#arm-record-form [name=address]').fill('Viena, Austria');await page.locator('#arm-record-form [name=notes]').fill('Private verification notes');await save('clients');
 await page.getByRole('heading',{name:title,exact:true}).waitFor();
 const contactId=created[0][1];
 await page.getByRole('button',{name:'Editar ficha ↗',exact:true}).click();await page.locator('#arm-record-form [name=notes]').fill('Updated private notes');
 const edited=page.waitForResponse(response=>response.url().endsWith('/api/arm/clients/'+contactId)&&response.request().method()==='PATCH');await page.getByRole('button',{name:/Guardar cambios/}).click();assert((await edited).ok());await page.waitForFunction(()=>!document.querySelector('#arm-editor').open);
 assert.equal((await crm('/clients/'+contactId)).notes,'Updated private notes');
 await page.reload();await page.locator('#arm-search').fill(title);await page.getByRole('button',{name:'Abrir ficha de '+title,exact:true}).click();await page.getByText('Updated private notes',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Propuestas y oportunidades',exact:true}).click();await page.getByRole('button',{name:/Nueva propuesta/}).click();await page.locator('#arm-record-form [name=title]').fill(title+' proposal');await page.locator('#arm-record-form [name=clientId]').selectOption(contactId);await page.locator('#arm-record-form [name=value]').fill('1200');await page.locator('#arm-record-form [name=currency]').selectOption('EUR');await save('deals');
 await page.getByRole('button',{name:'Contactos profesionales',exact:true}).click();await page.locator('#arm-search').fill(title);
 await page.locator('[data-mode=filter][data-facet=countries] summary').click();await page.locator('[data-mode=filter][data-facet=countries] input[value="Japón"]').check();
 await page.locator('[data-mode=filter][data-facet=roles] summary').click();await page.locator('[data-mode=filter][data-facet=roles] input[value="Director/a de teatro"]').check();assert.equal(await page.locator('#arm-results tbody tr').count(),1);
 await page.getByRole('button',{name:'Escribir a esta selección',exact:true}).click();assert(await page.locator('[data-mail-send]').isDisabled());await page.locator('#olivia-subject').fill(title+' draft');await page.locator('#olivia-message').fill('Private draft persistence verification. No message is sent.');
 const savingDraft=page.waitForResponse(response=>response.url().endsWith('/api/arm/mail/drafts')&&response.request().method()==='POST');await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();const draftResponse=await savingDraft;assert(draftResponse.ok(),'Draft save '+draftResponse.status());const savedDraft=await draftResponse.json();privateCreated.push(['studio_mail_drafts',savedDraft.id]);await page.locator('#olivia-save-status').getByText('Borrador guardado en tu espacio privado.',{exact:true}).waitFor();await page.getByRole('button',{name:'Cerrar correo',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'Borradores · Olivia One',exact:true}).click();await page.locator('[data-mail-draft="'+savedDraft.id+'"]').click();assert.equal(await page.locator('#olivia-subject').inputValue(),title+' draft');assert.equal(await page.locator('#olivia-message').textContent(),'Private draft persistence verification. No message is sent.');await page.getByRole('button',{name:'Cerrar correo',exact:true}).click();
 await page.getByRole('button',{name:'Propuestas y oportunidades',exact:true}).click();
 const pipeline=(await crm('/pipelines/'+deployment.crmSubscription.pipelineId));
 const next=pipeline.stages.find(stage=>stage.status==='OPEN'&&stage.position===1);assert(next);
 const moved=page.waitForResponse(response=>response.url().includes('/api/arm/deals/')&&response.request().method()==='PATCH');
 await page.getByRole('combobox',{name:'Etapa de '+title+' proposal'}).selectOption(next.id);assert((await moved).ok());
 await page.waitForFunction(id=>document.querySelector('[data-arm-stage]')?.value===id&&!document.querySelector('[data-arm-stage]').disabled,next.id);
 await page.getByRole('button',{name:'Los siguientes pasos',exact:true}).click();await page.getByRole('button',{name:/Nueva tarea/}).click();await page.locator('#arm-record-form [name=title]').fill(title+' task');await page.locator('#arm-record-form [name=clientId]').selectOption(contactId);await save('tasks');
 const completed=page.waitForResponse(response=>response.url().includes('/api/arm/tasks/')&&response.request().method()==='PATCH');
 await page.getByRole('combobox',{name:'Estado de '+title+' task'}).selectOption('DONE');assert((await completed).ok());
 await page.waitForFunction(()=>document.querySelector('[data-arm-task]')?.value==='DONE'&&!document.querySelector('[data-arm-task]').disabled);
 await page.getByRole('button',{name:'Contactos profesionales',exact:true}).click();await page.getByRole('button',{name:'Importar CSV',exact:true}).click();
 await page.locator('#arm-csv-file').setInputFiles({name:'qa.csv',mimeType:'text/csv',buffer:Buffer.from('name,company,notes\n'+title+' imported,Private verification,CSV persistence verification\n'+title+',Private verification,Duplicate must not overwrite')});
 const imported=page.waitForResponse(response=>response.url().endsWith('/api/arm/import')&&response.request().method()==='POST');
 await page.getByRole('button',{name:'Importar 1 contactos',exact:true}).click();const importResponse=await imported;assert(importResponse.ok());const importData=await importResponse.json();
 for(const row of importData.results)if(row.status==='created')created.push(['clients',row.id]);
 await page.locator('.arm-import-summary').getByText('1 creadas',{exact:true}).waitFor();await page.getByRole('button',{name:'Cerrar',exact:true}).click();
 assert.equal((await crm('/clients/'+contactId)).notes,'Updated private notes');
 const importedRow=await crm('/clients/'+created.at(-1)[1]);assert.equal(importedRow.notes,'CSV persistence verification');
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);
 console.log('Live ARM passed: designated administrator login, persisted contact creation/edit/reload, classification, notes, linked proposals/tasks, stage/status updates, CSV import, duplicate preservation and mobile layout.');
}finally {
 await browser.close();
 const failures=[];
 for(const [,contactId]of created.filter(([resource])=>resource==='clients')){try{const filter=encodeURIComponent(JSON.stringify({contact_id:{_eq:contactId}}));const result=await cms('/items/studio_contact_profiles?fields=id&filter='+filter);for(const row of result.data)privateCreated.push(['studio_contact_profiles',row.id]);}catch(error){failures.push(error.message);}}
 for(const [collection,id]of privateCreated)try{await cms('/items/'+collection+'/'+id,'DELETE');}catch(error){failures.push(error.message);}
 for(const [resource,id] of created.reverse())try{await crm('/'+resource+'/'+encodeURIComponent(id),'DELETE');}catch(error){failures.push(error.message);}
 if(failures.length) throw new Error('QA cleanup requires attention: '+failures.join('; '));
 console.log('Temporary CRM verification records removed.');
}
