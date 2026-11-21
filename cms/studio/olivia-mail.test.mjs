import test from 'node:test';
import assert from 'node:assert/strict';
import {createOliviaMail,cleanMailHtml} from './olivia-mail.mjs';
function setup(){
 const rows=[],calls=[],contacts=[{id:'ana',firstName:'Ana',name:'Test',email:'ana@example.test'},{id:'ben',name:'Ben',email:'ben@example.test'}];let offline=false;
 const mail=createOliviaMail({contacts:async token=>{assert.equal(token,'crm-tenant');return contacts;},drafts:{list:async owner=>structuredClone(rows.filter(row=>row.owner===owner)),save:async(owner,id,draft)=>{const row={id,owner,draft:structuredClone(draft),updated_at:new Date().toISOString()},index=rows.findIndex(row=>row.owner===owner&&row.id===id);if(index<0)rows.push(row);else rows[index]=row;return structuredClone(row);}},fetcher:async(url,options)=>{
  calls.push({url,options});if(offline)throw Error('timeout');
  if(url.endsWith('/api/auth/login'))return new Response(JSON.stringify({user:{email:'artist@example.test'},csrfToken:'csrf'}),{headers:{'set-cookie':['__Host-olivia_session=opaque; Secure; HttpOnly; Path=/','olivia_csrf=csrf; Secure; Path=/']}});
  if(url.endsWith('/api/me'))return Response.json({authenticated:true,user:{email:'artist@example.test'}});
  return Response.json({id:'smtp-id',status:'sent'});
 }});
 return {mail,rows,calls,contacts,offline(){offline=true;}};
}
test('drafts work without mailbox connection, sanitize rich text and remain scoped to their owner',async()=>{
 const {mail,calls}=setup(),s={email:'artist@example.test'};
 const draft=await mail.save(s,'crm-tenant',{contactIds:['ana'],subject:'Recital',html:'<p>Hola <b>Ana</b></p><script>secret()</script><a href="javascript:alert(1)" onclick="x()">link</a>'});
 assert.equal(calls.length,0);assert.doesNotMatch(draft.html,/script|onclick|javascript/);assert.match(draft.html,/<b>Ana<\/b>/);
 assert.equal((await mail.list(s)).length,1);assert.deepEqual(await mail.list({email:'other@example.test'}),[]);
 await assert.rejects(()=>mail.save({email:'other@example.test'},'crm-tenant',{id:draft.id,revision:1,contactIds:[],subject:'Attack',html:'x'}),{status:404});
 await assert.rejects(()=>mail.send(s,'crm-tenant',draft.id,{revision:1,contactId:'ana'}),{status:409});assert.equal(calls.length,0);
 await assert.rejects(()=>mail.save(s,'crm-tenant',{id:draft.id,revision:0,contactIds:[],subject:'Stale',html:'x'}),{status:409});
 const updated=await mail.save(s,'crm-tenant',{id:draft.id,revision:1,contactIds:['ana'],subject:'Updated',html:'<p>Texto</p>'});assert.equal(updated.revision,2);
 assert.equal(cleanMailHtml('<svg><script>x()</script></svg>').html,'');
});
test('sending uses individual verified CRM addresses, CSRF, persisted receipts and prevents retries after uncertain SMTP',async()=>{
 const fixture=setup(),{mail,calls}=fixture,s={email:'artist@example.test',olivia:{cookie:'opaque',csrf:'csrf',email:'artist@example.test'}};
 const draft=await mail.save(s,'crm-tenant',{contactIds:['ana','ben'],subject:'Concierto',html:'<p>Invitación</p>'});
 await assert.rejects(()=>mail.send(s,'crm-tenant',draft.id,{revision:1,contactId:'foreign'}));assert.equal(calls.length,0);
 await mail.send(s,'crm-tenant',draft.id,{revision:1,contactId:'ana'});
 const sent=JSON.parse(calls[0].options.body);assert.equal(sent.to,'ana@example.test');assert.equal(sent.bcc,'');assert.equal(calls[0].options.headers['x-olivia-csrf'],'csrf');
 await assert.rejects(()=>mail.send(s,'crm-tenant',draft.id,{revision:1,contactId:'ana'}),{status:409});assert.equal(calls.length,1);
 fixture.offline();await assert.rejects(()=>mail.send(s,'crm-tenant',draft.id,{revision:1,contactId:'ben'}),{status:502});
 const saved=(await mail.list(s))[0];assert.equal(saved.deliveries.ana.status,'sent');assert.equal(saved.deliveries.ben.status,'unknown');
 await assert.rejects(()=>mail.send(s,'crm-tenant',draft.id,{revision:1,contactId:'ben'}),{status:409});assert.equal(calls.length,2);
 await assert.rejects(()=>mail.save(s,'crm-tenant',{id:draft.id,revision:1,contactIds:['ana'],subject:'Changed',html:'x'}),{status:409});
});
test('changed recipient email is rejected after review and HTML links cannot carry credentials',async()=>{
 const {mail,calls,contacts}=setup(),s={email:'artist@example.test',olivia:{cookie:'opaque',csrf:'csrf'}};
 const draft=await mail.save(s,'crm-tenant',{contactIds:['ana'],subject:'Review',html:'<p>Hi</p>'});contacts[0].email='changed@example.test';
 await assert.rejects(()=>mail.send(s,'crm-tenant',draft.id,{revision:1,contactId:'ana'}),{status:409});assert.equal(calls.length,0);
 assert.equal(cleanMailHtml('<a href="https://user:pass@example.test" style="position:fixed">Hi</a>').html,'<a>Hi</a>');
});
