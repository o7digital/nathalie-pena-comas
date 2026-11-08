// Real, scoped CRM verification. Requires the Nathalie Directus dev variables and Railway CLI access.
import { chromium } from '@playwright/test';
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
const created=[],errors=[];
const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin+'/#arm');await page.locator('input[name=email]').fill(process.env.ADMIN_EMAIL);await page.locator('input[name=password]').fill(process.env.ADMIN_PASSWORD);await page.getByRole('button',{name:/Entrar a mi Studio/}).click();
 await page.getByRole('heading',{name:'Las relaciones que te impulsan.'}).waitFor();
 assert.match(await page.locator('#workspace-plan').textContent(),/2027/);
 const title='Studio ARM QA '+Date.now();
 async function save(resource) {
  const pending=page.waitForResponse(response=>response.url().endsWith('/api/arm/'+resource)&&response.request().method()==='POST');
  await page.getByRole('button',{name:/Guardar cambios/}).click();const response=await pending;
  assert(response.ok(),'Studio '+resource+' create: '+response.status());const data=await response.json();assert(data.id);created.push([resource,data.id]);
  await page.waitForFunction(()=>!document.querySelector('#editor').open);
 }
 await page.getByRole('button',{name:/Añadir contacto/}).click();await page.locator('#editor-form [name=name]').fill(title);await page.locator('#editor-form [name=company]').fill('Private verification');await save('clients');
 await page.getByText(title,{exact:true}).waitFor();
 await page.getByRole('button',{name:'Propuestas y oportunidades',exact:true}).click();await page.getByRole('button',{name:/Nueva propuesta/}).click();await page.locator('#editor-form [name=title]').fill(title+' proposal');await page.locator('#editor-form [name=value]').fill('1200');await page.locator('#editor-form [name=currency]').selectOption('EUR');await save('deals');
 const pipeline=(await crm('/pipelines/'+deployment.crmSubscription.pipelineId));
 const next=pipeline.stages.find(stage=>stage.status==='OPEN'&&stage.position===1);assert(next);
 const moved=page.waitForResponse(response=>response.url().includes('/api/arm/deals/')&&response.request().method()==='PATCH');
 await page.getByRole('combobox',{name:'Etapa de '+title+' proposal'}).selectOption(next.id);assert((await moved).ok());
 await page.waitForFunction(id=>document.querySelector('[data-deal-stage]')?.value===id&&!document.querySelector('[data-deal-stage]').disabled,next.id);
 await page.getByRole('button',{name:'Los siguientes pasos',exact:true}).click();await page.getByRole('button',{name:/Nueva tarea/}).click();await page.locator('#editor-form [name=title]').fill(title+' task');await save('tasks');
 const completed=page.waitForResponse(response=>response.url().includes('/api/arm/tasks/')&&response.request().method()==='PATCH');
 await page.getByRole('combobox',{name:'Estado de '+title+' task'}).selectOption('DONE');assert((await completed).ok());
 await page.waitForFunction(()=>document.querySelector('[data-task-status]')?.value==='DONE'&&!document.querySelector('[data-task-status]').disabled);
 assert.deepEqual(errors,[]);
 console.log('Live ARM passed: designated administrator login, real pipeline, contact/proposal/task creation, stage and status changes.');
}finally {
 await browser.close();
 const failures=[];
 for(const [resource,id] of created.reverse())try{await crm('/'+resource+'/'+encodeURIComponent(id),'DELETE');}catch(error){failures.push(error.message);}
 if(failures.length) throw new Error('QA cleanup requires attention: '+failures.join('; '));
 console.log('Temporary CRM verification records removed.');
}
