import test from 'node:test';
import assert from 'node:assert/strict';
import {parseContactsCsv,contactsCsv,validateContact,contactKeys} from './public/arm-data.js';

test('CSV preserves international names, escaped quotes, commas and multiline private notes',()=>{
 const contact={firstName:'Éléonore',name:'Peña-Comas',email:'Artist@example.test',company:'Théâtre, "Vienna"',notes:'Première rencontre\nProgramme latin'};
 const parsed=parseContactsCsv(contactsCsv([contact]));
 assert.equal(parsed.length,1);assert(!parsed[0].error);
 for(const key of ['firstName','name','company','notes'])assert.equal(parsed[0].contact[key],contact[key]);
 assert.equal(parsed[0].contact.email,'artist@example.test');
});
test('Spanish/French headers and semicolon exports work, invalid rows remain visible for correction',()=>{
 const rows=parseContactsCsv('Prénom;Nom;Organización;Correo;Estado\r\nAna;López;Ópera;ana@example.test;Relación activa\r\nJean;;Paris;wrong;PROSPECT');
 assert.equal(rows[0].contact.firstName,'Ana');assert.equal(rows[0].contact.clientStatus,'CLIENT');
 assert.match(rows[1].error,/nombre profesional/);assert.equal(rows[1].line,3);
 assert.throws(()=>parseContactsCsv('name,name\nA,B'),/dos columnas/);
 assert.throws(()=>parseContactsCsv('name,notes\nA,"unfinished'),/sin cerrar/);
 assert.throws(()=>parseContactsCsv('name,notes\nA,"closed"oops'),/comillas/);
 assert.throws(()=>parseContactsCsv('name\n'+Array(501).fill('A').join('\n')),/500 contactos/);
});
test('unsafe CSV formulas are neutralized and injected fields, bad URLs and invalid states are rejected',()=>{
 assert.match(contactsCsv([{name:'=HYPERLINK("bad")',phone:'+331234'}]),/"'=HYPERLINK/);
 for(const input of [{name:'A',tenantId:'other'},{name:'A',website:'javascript:alert(1)'},{name:'A',website:'https://user:secret@example.test'},{name:'A',clientStatus:'ADMIN'},{name:'A',email:'bad'},{name:'A',notes:{x:1}}])assert.throws(()=>validateContact(input));
 assert.deepEqual(contactKeys({firstName:'ANA',name:'López',company:'Ópera',email:'ANA@EXAMPLE.TEST'}),['email:ana@example.test','name:ana lopez|opera']);
});
