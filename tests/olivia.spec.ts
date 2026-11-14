import { test,expect } from '@playwright/test';
const languages=['es','en','de','fr','it','sv','hu','hr','ru','zh-TW','ja'];
const host='**/api/nath-ai';
test.beforeEach(async ({page})=>{await page.route('**/api/nath-ai/health',route=>route.fulfill({json:{available:true,version:'3.6.0',name:'Nath AI'}}));});
// Exercise the assistant independently of the timed full-screen introduction.
test.beforeEach(async ({page}) => { await page.emulateMedia({reducedMotion:'reduce'}); });
for(const lang of languages){
 test(`Nath AI ${lang}: localized UI and authenticated v3.6 request`,async({page})=>{
  const calls: {url:string;data:any}[]=[];
  await page.route(host+'/**',async route=>{
   const request=route.request();const url=new URL(request.url());
   if(request.url().endsWith('/health'))return route.fulfill({json:{available:true,version:'3.6.0'}});
   const headers={'access-control-allow-origin':'*','access-control-allow-headers':'Content-Type,X-Olivia-Widget-Identity','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(url.pathname==='/api/nath-ai/identity')return route.fulfill({json:{version:'3.6.0',clientCode:'nathalie',identity:'test-signed-identity'},headers});
   const data=request.method()==='GET'?null:request.postDataJSON();calls.push({url:url.pathname,data});
   if(url.pathname==='/api/nath-ai/conversations')return route.fulfill({json:{conversation:{status:'ai'},messages:[]},headers});
   expect(request.headers()['x-olivia-widget-identity']).toBe('test-signed-identity');
   return route.fulfill({json:{version:'3.6.0',clientCode:'nathalie',language:lang,reply:`Nathalie · ${lang} <script>alert(1)</script>`,model:'test-model'},headers});
  });
  await page.setViewportSize({width:390,height:844});await page.goto(`/${lang}/`);
  expect(calls).toHaveLength(0);
  await page.locator('[data-olivia-open]').click();
  await expect(page.locator('#olivia-dialog')).toBeVisible();
  await expect(page.locator('[data-olivia-messages]')).not.toBeEmpty();
  await page.locator('#olivia-message').fill('Tell me about Nathalie.');
  await page.locator('[data-olivia-form] [type=submit]').click();
  expect(calls).toHaveLength(0);
  await page.locator('[data-olivia-consent]').check();
  await page.locator('[data-olivia-form] [type=submit]').click();
  await expect(page.locator('[data-role=assistant]').last()).toHaveText(`Nathalie · ${lang} <script>alert(1)</script>`);
  await expect(page.locator('[data-olivia-messages] script')).toHaveCount(0);
  const sent=calls.find(call=>call.url==='/api/nath-ai/chat')!.data;
  expect(sent.clientCode).toBe('nathalie');expect(sent.language).toBe(lang);expect(sent.metadata.language).toBe(lang);
  expect(sent.metadata.dataConsent).toBe(true);expect(sent.metadata.pageUrl).toContain(`/${lang}/`);
  expect(await page.locator('#olivia-dialog').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})).toBe(true);
  await page.keyboard.press('Escape');await expect(page.locator('#olivia-dialog')).not.toBeVisible();
 });
}
test('Nath AI keeps context and visitor identity after changing site language',async({page})=>{
 const bodies:any[]=[];
 await page.route(host+'/**',async route=>{
  if(route.request().url().endsWith('/health'))return route.fulfill({json:{available:true,version:'3.6.0'}});
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'Content-Type,X-Olivia-Widget-Identity','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
  const r=route.request();if(r.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(r.url().endsWith('/identity'))return route.fulfill({headers,json:{version:'3.6.0',clientCode:'nathalie',identity:'signed'}});
  const d=r.method()==='GET'?{}:r.postDataJSON();
  if(r.url().endsWith('/chat')){bodies.push(d);return route.fulfill({headers,json:{version:'3.6.0',clientCode:'nathalie',language:d.language,reply:'Response '+d.language,model:'test'}});}
  return route.fulfill({headers,json:{conversation:{status:'ai'},messages:[]}});
 });
 await page.goto('/fr/');await page.locator('[data-olivia-open]').click();await page.locator('[data-olivia-consent]').check();await page.locator('#olivia-message').fill('Son parcours ?');await page.locator('[type=submit]').click();await expect(page.locator('[data-role=assistant]').last()).toHaveText('Response fr');
 await page.locator('[data-olivia-close]').click();await page.locator('.language-switch summary').click();await page.locator('.language-options a[lang=ja]').click();
 await page.locator('[data-olivia-open]').click();await expect(page.locator('[data-olivia-consent]')).toBeChecked();
 await expect(page.locator('[data-role=assistant]').first()).toContainText('こんにちは');await expect(page.locator('[data-role=assistant]').last()).toHaveText('Response fr');
 await page.locator('#olivia-message').fill('音楽作品は？');await page.locator('[type=submit]').click();await expect(page.locator('[data-role=assistant]').last()).toHaveText('Response ja');
 expect(bodies[1].visitorId).toBe(bodies[0].visitorId);expect(bodies[1].history).toEqual([{role:'user',content:'Son parcours ?'},{role:'assistant',content:'Response fr'}]);
 await page.locator('[data-olivia-reset]').click();await expect(page.locator('[data-role=user]')).toHaveCount(0);await expect(page.locator('[data-olivia-consent]')).not.toBeChecked();
});
test('a Spanish interface accepts French and Arabic replies without replacing its labels',async({page})=>{
 const answers=['Oui, Nathalie est une soprano dominicaine.','ناتالي مغنية سوبرانو من جمهورية الدومينيكان.'];let count=0;
 await page.route(host+'/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/health'))return route.fulfill({json:{available:true,version:'3.6.0'}});
  if(path.endsWith('/identity'))return route.fulfill({json:{clientCode:'nathalie',version:'3.6.0',identity:'fixture'}});
  if(path.endsWith('/conversations'))return route.fulfill({json:{conversation:{status:'ai'},messages:[]}});
  const data=route.request().postDataJSON();expect(data.language).toBe('es');
  return route.fulfill({json:{clientCode:'nathalie',version:'3.6.0',language:'es',reply:answers[count++],model:'fixture'}});
 });
 await page.goto('/es/#repertorio');await page.locator('[data-olivia-open]').click();await page.locator('[data-olivia-consent]').check();
 for(const [index,message]of ['as tu des info sur l artiste','من هي ناتالي؟'].entries()){
  await page.locator('#olivia-message').fill(message);await page.locator('[data-olivia-form] [type=submit]').click();
  await expect(page.locator('[data-role=assistant]').last()).toHaveText(answers[index]);await expect(page.locator('[data-olivia-form] [type=submit]')).toBeEnabled();
 }
 await expect(page.locator('[data-role=assistant]').last()).toHaveAttribute('dir','auto');
 expect(await page.locator('[data-role=assistant]').last().evaluate(element=>getComputedStyle(element).direction)).toBe('rtl');
 await expect(page.locator('#olivia-subtitle')).toHaveText('Asistente artística de Nathalie');await expect(page.locator('[data-olivia-form] [type=submit]')).toHaveText('Enviar ↗');
});

test('Nath AI displays a localized error when the service fails',async({page})=>{
 await page.route(host+'/**',route=>route.abort());await page.goto('/fr/');await page.locator('[data-olivia-open]').click();await page.locator('[data-olivia-consent]').check();await page.locator('#olivia-message').fill('Bonjour');await page.locator('[type=submit]').click();
 await expect(page.locator('[data-olivia-status]')).toContainText('momentanément indisponible');await expect(page.locator('#olivia-message')).toHaveValue('Bonjour');await expect(page.locator('[type=submit]')).toBeEnabled();
});
test('manual takeover pauses AI replies and receives operator messages',async({page})=>{
 let aiCalls=0;
 await page.clock.install();
 await page.route(host+'/**',async route=>{
  const r=route.request();if(r.url().endsWith('/health'))return route.fulfill({json:{available:true,version:'3.6.0'}});const headers={'access-control-allow-origin':'*','access-control-allow-headers':'Content-Type,X-Olivia-Widget-Identity','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
  if(r.method()==='OPTIONS')return route.fulfill({headers,status:204});
  if(r.url().endsWith('/identity'))return route.fulfill({headers,json:{version:'3.6.0',clientCode:'nathalie',identity:'signed'}});
  if(r.url().endsWith('/chat'))aiCalls++;
  if(r.method()==='GET')return route.fulfill({headers,json:{status:'manual',messages:[{id:'operator-1',role:'operator',content:'Bonjour, comment puis-je vous aider ?'}]}});
  return route.fulfill({headers,json:{conversation:{status:'manual'}}});
 });
 await page.goto('/fr/');await page.locator('[data-olivia-open]').click();await page.locator('[data-olivia-consent]').check();await page.locator('#olivia-message').fill('Je souhaite parler à votre équipe.');await page.locator('[type=submit]').click();
 await expect(page.locator('[data-olivia-status]')).toContainText('L’équipe a pris le relais');expect(aiCalls).toBe(0);
 await page.clock.fastForward(8500);await expect(page.locator('[data-role=operator]')).toHaveText('Bonjour, comment puis-je vous aider ?');
});
