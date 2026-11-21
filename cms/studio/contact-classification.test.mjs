import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesFacets,validateClassifications,facetValues} from './public/contact-classification.js';
import {validateContact,parseContactsCsv,contactsCsv} from './public/arm-data.js';
import {createArm} from './arm.mjs';

test('facets combine OR choices within a field and AND across country, language, role and gender',()=>{
 const row={countries:['Japón','Austria'],languages:['Japonés','Español'],roles:['Director/a de teatro','Agente / Representante'],musicGenres:['Ópera'],gender:'female'};
 assert(matchesFacets(row,{countries:['Rusia','Japon'],languages:['espanol'],roles:['Director/a de teatro'],gender:['female']}));
 assert(!matchesFacets(row,{countries:['Japón'],musicGenres:['Música sacra']}));
 assert(!matchesFacets({}, {gender:['female']}));
 assert.deepEqual(facetValues({companySector:'Festival'},'relationshipTypes'),['Festival']);
 assert.deepEqual(facetValues({companySector:'Festival',relationshipTypes:[]},'relationshipTypes'),[]);
});
test('classification values are explicit, bounded, deduplicated and round-trip through CSV',()=>{
 const contact=validateContact({name:'Director',roles:[' Director/a de teatro ','Director/a de teatro','Promotor/a'],countries:['Japón','Austria'],gender:'female',campaignTags:['Día de las Madres']});
 assert.equal(contact.roles.length,2);
 const [parsed]=parseContactsCsv(contactsCsv([contact]));assert(!parsed.error);assert.deepEqual(parsed.contact.roles,contact.roles);assert.deepEqual(parsed.contact.countries,contact.countries);assert.equal(parsed.contact.gender,'female');
 assert.throws(()=>validateClassifications({roles:'Director'}));assert.throws(()=>validateClassifications({gender:'guessed'}));assert.throws(()=>validateClassifications({roles:['Bad|Tag']}));assert.throws(()=>validateContact({name:'Test',tenantId:'foreign'}));
});
test('extended profiles persist separately from native CRM, support clearing and recover partial writes by ID',async()=>{
 const rows=[],profileRows=new Map();let fail=false;
 const arm=createArm({profiles:{ready:async()=>{},list:async()=>[...profileRows].map(([id,values])=>({id,...values})),save:async(id,data)=>{if(fail)throw Error('Storage unavailable');const merged={...profileRows.get(id),...data};profileRows.set(id,merged);return merged;}},request:async(path,token,method='GET',data)=>{
  assert.equal(token,'scoped');assert(!Object.keys(data||{}).some(key=>['countries','roles','gender'].includes(key)));
  if(path==='/clients'&&method==='POST'){const row={id:'contact-'+rows.length,...data};rows.push(row);return {...row};}
  if(path==='/clients')return structuredClone(rows);
  const row=rows.find(row=>path==='/clients/'+row.id);assert(row);if(method==='PATCH')Object.assign(row,data);return {...row};
 }});
 const saved=await arm.execute('scoped','clients',null,'POST',{name:'Test',countries:['Japón'],roles:['Director/a de teatro','Promotor/a'],gender:'female'});
 assert.deepEqual((await arm.execute('scoped','clients',null,'GET'))[0].countries,['Japón']);
 await arm.execute('scoped','clients',saved.id,'PATCH',{countries:[],roles:[],gender:''});
 assert.deepEqual((await arm.execute('scoped','clients',saved.id,'GET')).roles,[]);
 fail=true;let partial;try{await arm.execute('scoped','clients',null,'POST',{name:'Second',countries:['Rusia']});}catch(error){partial=error;}
 assert.equal(partial.savedContactId,'contact-1');fail=false;
 await arm.execute('scoped','clients',partial.savedContactId,'PATCH',{countries:['Rusia']});assert.equal(rows.length,2);assert.deepEqual(profileRows.get('contact-1').countries,['Rusia']);
});
