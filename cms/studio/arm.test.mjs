import test from 'node:test';
import assert from 'node:assert/strict';
import {createArm} from './arm.mjs';

function setup(){
 const clients=[{id:'existing',name:'López',firstName:'Ana',email:'ana@example.test',company:'Teatro',website:'https://example.test'}];
 const calls=[];
 const arm=createArm({request:async(path,token,method='GET',data)=>{
  assert.equal(token,'tenant-token');calls.push({path,method,data});
  if(path==='/clients'&&method==='GET')return structuredClone(clients);
  if(path==='/clients'&&method==='POST'){if(data.name==='Unavailable')throw Object.assign(Error('Provider unavailable'),{status:502});const row={id:'contact-'+clients.length,...data};clients.push(row);return structuredClone(row);}
  if(path.startsWith('/clients/')&&method==='GET'){const row=clients.find(row=>row.id===path.split('/').at(-1));if(!row)throw Object.assign(Error('Not found'),{status:404});return structuredClone(row);}
  if(path.startsWith('/clients/')&&method==='PATCH'){const row=clients.find(row=>row.id===path.split('/').at(-1));Object.assign(row,data);return structuredClone(row);}
  if(path==='/pipelines/pipeline')return {id:'pipeline',stages:[{id:'stage'}]};
  if(path==='/deals/deal')return {id:'deal',pipelineId:'pipeline'};
  return {id:'saved',...data};
 }});
 return {arm,clients,calls};
}
test('contact create/edit persists the supported CRM fields and detects existing contacts',async()=>{
 const {arm,clients}=setup();
 const row=await arm.execute('tenant-token','clients',null,'POST',{name:'Programmer',companySector:'Festival',address:'Viena, Austria',notes:'Private notes',website:'https://festival.example.test'});
 await arm.execute('tenant-token','clients',row.id,'PATCH',{notes:'Updated\nPrivate notes',clientStatus:'CLIENT'});
 assert.equal(clients[1].notes,'Updated\nPrivate notes');assert.equal(clients[1].companySector,'Festival');
 await assert.rejects(()=>arm.execute('tenant-token','clients',null,'POST',{name:'Another',email:'ANA@example.test'}),{status:409});
 await assert.rejects(()=>arm.execute('tenant-token','clients','existing','PATCH',{website:''}),{status:422});
 assert.equal(clients[0].website,'https://example.test');
});
test('import validates before writing, skips duplicates across files and serializes concurrent batches',async()=>{
 const {arm,clients,calls}=setup();
 await assert.rejects(()=>arm.importContacts('tenant-token',{rows:[{name:'Valid'},{name:'Injected',tenantId:'other'}]}));
 assert(!calls.some(row=>row.method==='POST'));
 const input={rows:[{name:'López',firstName:'Ana',company:'Teatro'},{name:'New',email:'new@example.test'},{name:'Unavailable'},{name:'Another',email:'NEW@example.test'}]};
 const result=await arm.importContacts('tenant-token',input);
 assert.deepEqual(result.results.map(row=>row.status),['duplicate','created','failed','failed']);
 assert.equal((await arm.importContacts('tenant-token',{rows:[input.rows[3]]})).results[0].status,'duplicate');
 const both=await Promise.all([arm.importContacts('tenant-token',{rows:[{name:'Concurrent',email:'concurrent@example.test'}]}),arm.importContacts('tenant-token',{rows:[{name:'Concurrent',email:'concurrent@example.test'}]})]);
 assert.deepEqual(both.map(row=>row.results[0].status),['created','duplicate']);
 assert.equal(clients.length,3);
});
test('relations validate linked contacts, pipeline stages, dates and allowed operations before writing',async()=>{
 const {arm,calls}=setup();
 await assert.rejects(()=>arm.execute('tenant-token','tasks',null,'POST',{title:'Task',clientId:'other-tenant'}),{status:404});
 await assert.rejects(()=>arm.execute('tenant-token','deals','deal','PATCH',{stageId:'wrong-stage'}),/etapa/);
 await assert.rejects(()=>arm.execute('tenant-token','tasks',null,'POST',{title:'Task',clientId:'existing',dueDate:'2026-02-30'}),/fecha/);
 await assert.rejects(()=>arm.execute('tenant-token','clients','existing','POST',{name:'Bad'}),{status:405});
 await assert.rejects(()=>arm.execute('tenant-token','pipelines','pipeline','PATCH',{}),{status:405});
 assert(!calls.some(row=>row.method==='POST'||row.method==='PATCH'));
 const row=await arm.execute('tenant-token','deals',null,'POST',{title:'Proposal',clientId:'existing',pipelineId:'pipeline',stageId:'stage',value:1200,currency:'EUR'});
 assert.equal(row.clientId,'existing');assert.equal(row.value,1200);
});
