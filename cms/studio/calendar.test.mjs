import test from 'node:test';
import assert from 'node:assert/strict';
import {validDate,dateFromParts,moveMonth,monthDays} from './public/calendar.js';

test('manual calendar dates reject impossible days and preserve leap years',()=>{
 for(const invalid of ['2027-02-29','2028-02-30','2027-04-31','2027-13-01','2027-00-10','2027-1-1','',null])assert.equal(validDate(invalid),false,String(invalid));
 assert.equal(dateFromParts('29','2','2028'),'2028-02-29');
 assert.equal(dateFromParts('31','4','2027'),'');
 assert.equal(dateFromParts('1','1','2027'),'2027-01-01');
 assert.equal(dateFromParts('1.5','1','2027'),'');
 assert.equal(dateFromParts('','1','2027'),'');
});
test('month navigation crosses years without changing dates through local timezones',()=>{
 assert.equal(moveMonth('2026-12',1),'2027-01');assert.equal(moveMonth('2027-01',-1),'2026-12');
 const november=monthDays('2026-11');assert.equal(november.length,42);assert.equal(november[0],'2026-10-26');assert.equal(november[6],'2026-11-01');
 assert(monthDays('2028-02').includes('2028-02-29'));assert(!monthDays('2027-02').includes('2027-02-29'));
 assert.equal(new Set(november).size,42);
});
