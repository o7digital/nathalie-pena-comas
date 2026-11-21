import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {parse} from 'parse5';
import {annotatePreview,previewDocument,previewPath,assetPath,proxyCss} from './preview.mjs';
import {createStudioServer} from './server.mjs';
const nodes=html=>{const result=[];const walk=n=>{result.push(n);for(const child of n.childNodes||[])walk(child);};walk(parse(html));return result;};
const attribute=(node,key)=>node.attrs?.find(a=>a.name===key)?.value;

test('visual bundles map rich copy and reused images to their correct section and stable CMS identity',()=>{
 const original='<html><head><title>Nathalie</title></head><body><section id="home"><h1>Una voz<br><em>sin fronteras.</em></h1><a>Conocer a Nathalie <span>↓</span></a><img src="/_cms/shared.webp"></section><section id="gallery"><img src="/_cms/shared.webp"><p>Mi recital</p></section></body></html>';
 const html=annotatePreview(original,{sections:[{id:'home',anchor:'home'},{id:'gallery',anchor:'gallery'}],texts:[{section:'home',value:'Una voz<br/><em>sin fronteras.</em>',target:{key:'translation:heading'}},{section:'home',value:'Conocer a Nathalie',target:{key:'copy:Discover'}},{section:'gallery',value:'Mi recital',target:{collection:'gallery',id:'photo-1',field:'title'}}],images:[{src:'/_cms/shared.webp',section:'home',collection:'site_images',id:'hero-1'},{src:'/_cms/shared.webp',section:'gallery',collection:'gallery',id:'photo-1'}]});
 const all=nodes(html),edits=all.filter(node=>attribute(node,'data-studio-text'));
 assert.equal(edits.length,3);
 assert.equal(edits[0].tagName,'h1');assert.deepEqual(JSON.parse(attribute(edits[0],'data-studio-text')),{key:'translation:heading'});
 assert.equal(edits[1].tagName,'npc-edit');assert.deepEqual(JSON.parse(attribute(edits[2],'data-studio-text')),{collection:'gallery',id:'photo-1',field:'title'});
 assert.deepEqual(all.filter(node=>attribute(node,'data-studio-image')).map(node=>JSON.parse(attribute(node,'data-studio-image')).collection),['site_images','gallery']);
 assert(!original.includes('data-studio-'));
 // Saving different copy does not change the marker bound to the built document.
 assert(html.includes('translation:heading'));
 const privacy=annotatePreview('<p>Privacidad</p>',{initialSection:'privacy',texts:[{section:'privacy',value:'Privacidad',target:{key:'privacy'}}]});assert(privacy.includes('data-studio-text'));
});

test('preview retains design resources, strips executable content, navigation side effects and indexing',()=>{
 const html='<html><head><base href="https://other.test"><meta http-equiv="refresh" content="0;url=https://other.test"><link rel="stylesheet" href="/_astro/site.css"><script>bad()</script></head><body onload="bad()"><img src="/photo.webp" onerror="bad()"><form action="https://other.test"><button formaction="https://other.test">Send</button></form><iframe srcdoc="bad"></iframe><a href="javascript:bad()" target="_top" ping="https://other.test">Link</a></body></html>';
 const all=nodes(previewDocument({page:'/es/',html},'/es/','https://preview.test/es/'));
 assert(!all.some(node=>['script','iframe','object','embed','template','noscript'].includes(node.tagName)));
 assert(!all.some(node=>node.attrs?.some(a=>/^on/i.test(a.name)||['srcdoc','action','formaction','target','ping'].includes(a.name))));
 assert.equal(all.find(node=>node.tagName==='base').attrs[0].value,'https://preview.test/es/');
 assert(all.some(node=>node.tagName==='link'&&attribute(node,'href')==='/_astro/site.css'));
 assert(all.some(node=>node.tagName==='meta'&&attribute(node,'name')==='nathalie-preview'));
 for(const page of ['https://other.test','//other.test','/../secret','/es/../api/','/en/%2e%2e/','/admin/','/es/?token=x',null])assert.throws(()=>previewPath(page));
 assert.equal(previewPath('/fr/privacy/'),'/_studio/pages/fr__privacy.json');
 assert.throws(()=>previewDocument({page:'/en/',html},'/es/','https://preview.test'));
});

test('visual preview requires a session and never forwards CMS credentials to the site',async t=>{
 let requests=0;
 const upstream=http.createServer((req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/auth/login')return res.end(JSON.stringify({data:{access_token:'private-access',refresh_token:'private-refresh',expires:900000}}));
  if(req.url.startsWith('/users/me'))return res.end(JSON.stringify({data:{id:'editor',email:'editor@example.test'}}));
  if(req.url===previewPath('/es/')){requests++;assert.equal(req.headers.authorization,undefined);assert.equal(req.headers.cookie,undefined);assert.equal(req.headers['x-vercel-protection-bypass'],'private-preview-bypass');return res.end(JSON.stringify({page:'/es/',html:'<html><head><link rel="stylesheet" href="/_astro/site.css"></head><body><h1>Nathalie</h1><script>bad()</script></body></html>'}));}
  if(req.url==='/_astro/site.css'){assert.equal(req.headers.authorization,undefined);assert.equal(req.headers.cookie,undefined);assert.equal(req.headers['x-vercel-protection-bypass'],'private-preview-bypass');res.setHeader('Content-Type','text/css');return res.end('@font-face{src:url(/fonts/manrope.ttf)}');}
  res.statusCode=404;res.end('{}');
 });
 upstream.listen(0,'127.0.0.1');await once(upstream,'listening');const site=`http://127.0.0.1:${upstream.address().port}`;
 const server=createStudioServer({cms:site,preview:site,previewBypass:'private-preview-bypass',secret:'visual-preview-private-test-secret-32-characters',secure:false});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.closeAllConnections();server.close();upstream.closeAllConnections();upstream.close();});
 const origin=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await fetch(origin+'/api/preview?page=/es/')).status,401);assert.equal(requests,0);
 assert.equal((await fetch(origin+'/api/preview-asset?path=/_astro/site.css')).status,401);
 const login=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:'editor@example.test',password:'private-password'})});
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const response=await fetch(origin+'/api/preview?page=/es/',{headers:{Cookie:cookie}});
 assert.equal(response.status,200);assert.equal(response.headers.get('x-frame-options'),'SAMEORIGIN');
 assert.match(response.headers.get('content-security-policy'),/script-src 'none'/);assert.match(response.headers.get('content-security-policy'),/sandbox allow-same-origin/);
 assert.equal(response.headers.get('cache-control'),'private, no-store');const html=await response.text();assert(!html.includes('private-access'));assert(!html.includes('<script'));
 assert(!html.includes('private-preview-bypass'));assert(html.includes(origin+'/api/preview-asset?path=%2F_astro%2Fsite.css'));
 const css=await fetch(origin+'/api/preview-asset?path=/_astro/site.css',{headers:{Cookie:cookie}});assert.equal(css.status,200);assert((await css.text()).includes(origin+'/api/preview-asset?path=%2Ffonts%2Fmanrope.ttf'));
 assert.equal((await fetch(origin+'/api/preview-asset?path=/_astro/private.js',{headers:{Cookie:cookie}})).status,400);
 assert.equal((await fetch(origin+'/api/preview?page=https://other.test',{headers:{Cookie:cookie}})).status,400);assert.equal(requests,1);
});

test('asset proxy permits only published design assets and rewrites CSS fonts without exposing protection secrets',()=>{
 for(const path of ['/_astro/site.css','/_cms/photo-hash.webp','/fonts/manrope.ttf','/logo-npc.png'])assert.equal(assetPath(path),path);
 for(const path of ['/api/secret','//evil.test/x.css','/_astro/../secret.css','/_cms/secret.json','/fonts/x.js','https://evil.test/x.css','/_cms/%2e%2e/secret.css'])assert.throws(()=>assetPath(path));
 const css=proxyCss('a{background:url(data:image/png;base64,abc)}@font-face{src:url("/fonts/manrope.ttf")}','/_astro/site.css','https://preview.test','https://studio.test');
 assert(css.includes('url("data:image/png;base64,abc")'));assert(css.includes('https://studio.test/api/preview-asset?path=%2Ffonts%2Fmanrope.ttf'));
});
