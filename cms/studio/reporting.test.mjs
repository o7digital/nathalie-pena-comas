import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createReporting,createReportingConnectors,dateRange,importRows,toCsv} from './reporting.mjs';

const csv='date,channel,metric,value,currency\r\n2026-11-01,Apple Music,royalties,12.345,USD\r\n2026-11-01,Apple Music,streams,100,\r\n';
test('CSV import preserves royalty currencies and stable IDs; duplicate or invalid daily metrics are rejected',()=>{
 const rows=importRows('apple-music',csv,'Distributor November');
 assert.equal(rows[0].payload.value,12.345);assert.equal(rows[0].payload.currency,'USD');
 assert.equal(rows[1].payload.currency,null);
 assert.equal(rows[0].id,importRows('apple-music',csv.replace('12.345','15'),'Updated')[0].id);
 assert.throws(()=>importRows('instagram',csv,'Wrong source'));
 assert.throws(()=>importRows('apple-music',csv+'2026-11-01,Apple Music,royalties,20,USD','Duplicate'));
 assert.throws(()=>importRows('apple-music',csv.replace('2026-11-01','2026-02-30'),'Invalid'));
 assert.throws(()=>importRows('apple-music',csv.replace('100,','-1,'),'Invalid'));
 assert.throws(()=>importRows('apple-music',csv.replace('100,','0.5,'),'Invalid'));
 assert.throws(()=>importRows('apple-music',csv.replace('USD',''),'Missing currency'));
 assert.equal(importRows('apple-music',csv.replace('12.345','-1.2'),'Refund')[0].payload.value,-1.2);
});
test('quoted CSV handles commas and rejects trailing injected columns; exports neutralize formula text',()=>{
 const rows=importRows('apple-music',csv.replace('Apple Music','"Apple, Music"'),'=FORMULA');
 assert.equal(rows[0].payload.channel,'Apple, Music');
 assert.match(toCsv(rows.map(r=>r.payload)),/"'=FORMULA"/);
 assert.throws(()=>importRows('apple-music',csv.replace('Apple Music','"Unclosed'),'Invalid'));
 assert.throws(()=>importRows('apple-music',csv.replace('USD','USD,tenant-other'),'Invalid'));
 assert.throws(()=>dateRange('2026-11-02','2026-11-01'));
 assert.throws(()=>dateRange('2024-01-01','2026-11-01'));
});
test('reports never fabricate data for unconnected providers and isolate provider failures',async()=>{
 let persisted=[];
 const reporting=createReporting({read:async()=>persisted,write:async rows=>{persisted=rows;},connectors:{configured:{ga4:true},ga4:async()=>{throw new Error('secret-access-token');}}});
 const empty=await reporting.report('2026-11-01','2026-11-02');
 assert.equal(empty.rows.length,0);assert.equal(empty.sources.find(s=>s.provider==='ga4').status,'error');
 assert(!JSON.stringify(empty).includes('secret-access-token'));
 assert.equal(empty.sources.find(s=>s.provider==='shopify').status,'pending');
 await reporting.import({provider:'apple-music',csv,source:'Distributor'});
 const report=await reporting.report('2026-11-01','2026-11-02');
 assert.equal(report.rows.length,2);assert.equal(report.sources.find(s=>s.provider==='apple-music').status,'imported');
 assert(!report.rows.some(r=>r.metric==='net_payments'));
});
test('GA4 signs a scoped service token and distinguishes social referral sessions from page views',async()=>{
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});const calls=[];
 const connector=createReportingConnectors({GA4_PROPERTY_ID:'123',GA4_SERVICE_ACCOUNT_JSON:JSON.stringify({client_email:'studio@project.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})})},async(url,options)=>{
  calls.push({url,options});
  return {ok:true,json:async()=>url.includes('oauth2')?{access_token:'private-google-token',expires_in:3600}:{rowCount:2,rows:[{dimensionValues:[{value:'20261101'},{value:'instagram'},{value:'Organic Social'}],metricValues:[{value:'12'},{value:'40'}]},{dimensionValues:[{value:'20261101'},{value:'google'},{value:'Organic Search'}],metricValues:[{value:'20'},{value:'50'}]}]}};
 });
 const rows=await connector.ga4('2026-11-01','2026-11-02');
 assert.equal(rows.filter(r=>r.metric==='social_sessions').length,1);assert.equal(rows.find(r=>r.metric==='social_sessions').value,12);
 assert.equal(rows.filter(r=>r.metric==='sessions').reduce((a,r)=>a+r.value,0),32);
 assert.equal(calls.length,2);assert.equal(calls[1].options.headers.Authorization,'Bearer private-google-token');
 const jwt=calls[0].options.body.get('assertion');assert.equal(JSON.parse(Buffer.from(jwt.split('.')[1],'base64url')).scope,'https://www.googleapis.com/auth/analytics.readonly');
 assert(!JSON.stringify(rows).includes('private-google-token'));
});
test('Shopify follows pagination, excludes test orders and rejects silently incomplete historical access',async()=>{
 const calls=[];let page=0;
 const connector=createReportingConnectors({SHOPIFY_STORE_DOMAIN:'artist.myshopify.com',SHOPIFY_ADMIN_TOKEN:'shopify-secret'},async(url,options)=>{
  calls.push({url,options});
  return {ok:true,json:async()=>url.includes('access_scopes')?{access_scopes:[{handle:'read_orders'},{handle:'read_all_orders'}]}:{data:{orders:{nodes:[{createdAt:'2026-11-01T10:00:00Z',test:page===1,netPaymentSet:{shopMoney:{amount:'20.50',currencyCode:page===0?'EUR':'USD'}}}],pageInfo:{hasNextPage:page++===0,endCursor:'next'}}}}};
 });
 const rows=await connector.shopify('2026-01-01','2026-11-02');
 assert.equal(calls.length,3);assert.equal(rows.length,2);assert.equal(rows[1].value,20.5);assert.equal(rows[1].currency,'EUR');
 assert.equal(JSON.parse(calls[2].options.body).variables.after,'next');
 assert.match(JSON.parse(calls[1].options.body).variables.query,/created_at:<2026-11-03T00:00:00Z/);
 assert(!calls.some(c=>c.options.body?.includes('customer{')));
 const limited=createReportingConnectors({SHOPIFY_STORE_DOMAIN:'artist.myshopify.com',SHOPIFY_ADMIN_TOKEN:'secret'},async()=>({ok:true,json:async()=>({access_scopes:[{handle:'read_orders'}]})}));
 await assert.rejects(()=>limited.shopify('2020-01-01','2020-01-02'),/60 días/);
 const malicious=createReportingConnectors({SHOPIFY_STORE_DOMAIN:'127.0.0.1',SHOPIFY_ADMIN_TOKEN:'secret'},async()=>{assert.fail('SSRF');});
 await assert.rejects(()=>malicious.shopify('2026-11-01','2026-11-02'),/myshopify/);
});
