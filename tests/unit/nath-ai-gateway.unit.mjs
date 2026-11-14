import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {publishedKnowledge} from '../../lib/nath-ai-knowledge.mjs';
const manifest=await publishedKnowledge();
const knowledge={version:'3.6.0',revision:manifest.revision,publishedAt:manifest.publishedAt,stats:manifest.stats};
import {handle} from '../../lib/nath-ai-gateway.mjs';
const originalFetch=globalThis.fetch;
let calls=[];
beforeEach(()=>{
 process.env.NATH_AI_GATEWAY_KEY='unit-test-secret-only';process.env.NATH_AI_GATEWAY_URL='https://gateway.example/nathalie-preview';calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return {status:200,json:async()=>url.endsWith('/knowledge/status')?knowledge:({clientCode:'nathalie',version:'3.6.0',reply:'Bonjour, je suis Nath AI.',language:'fr',model:'test-model'})};};
});
afterEach(()=>{globalThis.fetch=originalFetch;delete process.env.NATH_AI_GATEWAY_KEY;delete process.env.NATH_AI_GATEWAY_URL;});
function request(method='POST',body={}){return {method,url:'/api/nath-ai/chat',headers:{host:'preview.example',origin:'https://preview.example','sec-fetch-site':'same-origin'},body};}
function response(){return {headers:{},code:0,body:null,setHeader(k,v){this.headers[k.toLowerCase()]=v;},status(n){this.code=n;return this;},json(body){this.body=body;return this;}};}
async function authenticated(body){
 const res=response();await handle(request('GET'),res,'identity');
 const req=request('POST',body);req.headers.cookie=res.headers['set-cookie'].split(';')[0];req.headers['x-olivia-widget-identity']=res.body.identity;return req;
}
const body=()=>({clientCode:'nathalie',visitorId:randomUUID(),language:'fr',message:'Qui est Nathalie ?',metadata:{dataConsent:true}});

test('the browser gets a scoped HttpOnly cookie and a public identity, never the gateway secret',async()=>{
 const res=response();await handle(request('GET'),res,'identity');assert.equal(res.code,200);assert.equal(res.body.version,'3.6.0');
 assert.match(res.headers['set-cookie'],/HttpOnly; Secure; SameSite=Strict/);assert.match(res.headers['set-cookie'],/Path=\/api\/nath-ai/);
 assert(!JSON.stringify(res.body).includes(process.env.NATH_AI_GATEWAY_KEY));assert.equal(calls.length,0);
});
test('a valid message is bound to this browser and fixed tenant before reaching Olivia 3.6',async()=>{
 const req=await authenticated(body()),res=response();await handle(req,res,'chat');assert.equal(res.code,200);assert.equal(calls.length,2);
 const upstream=JSON.parse(calls.find(call=>call.url.endsWith('/chat')).options.body);assert.match(upstream.conversation_id,/^[a-f0-9]{48}$/);assert.equal(upstream.language,'fr');
 assert.equal(upstream.consent,true);assert(!Object.hasOwn(upstream,'clientCode'));assert(!Object.hasOwn(upstream,'metadata'));assert.equal(calls[1].options.redirect,'error');
});
for(const [name,mutate,code] of [
 ['another site',r=>r.headers.origin='https://attacker.example',403],
 ['cross-site fetch',r=>r.headers['sec-fetch-site']='cross-site',403],
 ['missing signed browser identity',r=>delete r.headers['x-olivia-widget-identity'],401],
 ['forged session',r=>r.headers.cookie='nath_ai_session=bad.cookie.signature',401],
 ['another tenant',r=>r.body.clientCode='vialterna3-demo',400],
 ['missing agreement',r=>r.body.metadata.dataConsent=false,400],
 ['unsupported language',r=>r.body.language='invalid',400],
 ['invalid visitor',r=>r.body.visitorId='not-a-uuid',400],
 ['oversized input',r=>r.body.message='x'.repeat(24001),413],
 ['empty input',r=>r.body.message='   ',400],
])test(`${name} cannot reach the engine`,async()=>{
 const req=await authenticated(body());mutate(req);const res=response();await handle(req,res,'chat');assert.equal(res.code,code);assert.equal(calls.length,0);
});
test('a response for another tenant is never exposed',async()=>{
 globalThis.fetch=async url=>({status:200,json:async()=>url.endsWith('/knowledge/status')?knowledge:({clientCode:'someone-else',version:'3.6.0',reply:'private'})});const res=response();await handle(await authenticated(body()),res,'chat');assert.equal(res.code,502);assert(!JSON.stringify(res.body).includes('private'));
});
test('the online dot requires the correct live 3.6 backend and configured provider',async()=>{
 for(const [health,code,available]of [
  [{version:'3.5.0',site:'nathalie-dev',provider_configured:true},503,false],
  [{version:'3.6.0',site:'another-client',provider_configured:true},503,false],
  [{version:'3.6.0',site:'nathalie-dev',provider_configured:false},503,false],
  [{version:'3.6.0',site:'nathalie-dev',provider_configured:true},200,true],
 ]){globalThis.fetch=async url=>({status:200,json:async()=>url.endsWith('/knowledge/status')?knowledge:health});const res=response();await handle(request('GET'),res,'health');assert.equal(res.code,code);assert.equal(res.body.available,available);}
});
test('two browser sessions cannot resolve to the same conversation',async()=>{
 const shared=body();for(let i=0;i<2;i++){const res=response();await handle(await authenticated(shared),res,'chat');assert.equal(res.code,200);}
 const messages=calls.filter(call=>call.url.endsWith('/chat'));assert.notEqual(JSON.parse(messages[0].options.body).conversation_id,JSON.parse(messages[1].options.body).conversation_id);
});
test('provider errors do not disclose internal details or fall back to v2',async()=>{
 globalThis.fetch=async()=>{throw Error('private internal details');};const res=response();await handle(await authenticated(body()),res,'chat');assert.equal(res.code,502);assert(!JSON.stringify(res.body).includes('private'));
});
