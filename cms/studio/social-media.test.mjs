import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaSignature,verifyMediaLease,mediaFingerprint} from './social-media.mjs';
import {zonedDate} from './public/social.js';
const secret='private-media-test-secret-32-characters',id='00000000-0000-4000-a000-000000000001';
test('media leases bind file/version/time, expire, and cannot expose another file',()=>{
 const now=Date.parse('2026-11-08T18:00:00Z'),nbf=Math.floor(now/1000)-30,exp=nbf+3600,v='v'.repeat(43),sig=mediaSignature(secret,id,nbf,exp,v);
 const url=new URL(`https://studio.test/social-media/${id}?nbf=${nbf}&exp=${exp}&v=${v}&sig=${sig}`);
 assert.deepEqual(verifyMediaLease(secret,url,now),{id,version:v});
 assert.throws(()=>verifyMediaLease(secret,url,now-60000));assert.throws(()=>verifyMediaLease(secret,url,now+3600000));
 assert.throws(()=>verifyMediaLease('wrong-secret',url,now));
 const altered=new URL(url);altered.pathname=altered.pathname.replace(/1$/,'2');assert.throws(()=>verifyMediaLease(secret,altered,now));
 const modified=new URL(url);modified.searchParams.set('v','z'.repeat(43));assert.throws(()=>verifyMediaLease(secret,modified,now));
 const long=new URL(url);long.searchParams.set('exp',String(nbf+86400));assert.throws(()=>verifyMediaLease(secret,long,now));
});
test('replacing a media file invalidates its approved fingerprint',()=>{
 const file={id,type:'video/mp4',filesize:'100',modified_on:'2026-11-08T18:00:00Z'};
 assert.notEqual(mediaFingerprint(file),mediaFingerprint({...file,filesize:'101'}));
 assert.notEqual(mediaFingerprint(file),mediaFingerprint({...file,modified_on:'2026-11-08T19:00:00Z'}));
});
test('schedule wall times preserve their timezone and reject impossible or ambiguous DST times',()=>{
 assert.equal(zonedDate('2026-11-09T18:30','Europe/Vienna'),'2026-11-09T17:30:00.000Z');
 assert.equal(zonedDate('2026-11-09T18:30','America/Santo_Domingo'),'2026-11-09T22:30:00.000Z');
 assert.throws(()=>zonedDate('2026-03-29T02:30','Europe/Vienna'),/no existe/);
 assert.throws(()=>zonedDate('2026-10-25T02:30','Europe/Vienna'),/se repite/);
 assert.throws(()=>zonedDate('2026-02-30T18:30','UTC'));
});
