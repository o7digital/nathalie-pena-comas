import { test,expect } from '@playwright/test';
const languages=['es','en','de','fr','it','sv','hu','hr','ru','zh-TW','ja'];
const host='https://suitesmine-bot.vercel.app';
for(const lang of languages){
 test(`Olivia ${lang}: localized UI and authenticated v2 request`,async({page})=>{
  const calls: {url:string;data:any}[]=[];
  await page.route(host+'/**',async route=>{
   const request=route.request();const url=new URL(request.url());
   const headers={'access-control-allow-origin':'*','access-control-allow-headers':'Content-Type,X-Olivia-Widget-Identity','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
   if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
   if(url.pathname==='/api/widget/identity')return route.fulfill({json:{clientCode:'nathalie',identity:'test-signed-identity'},headers});
   const data=request.method()==='GET'?null:request.postDataJSON();calls.push({url:url.pathname,data});
   if(url.pathname==='/api/widget/conversations')return route.fulfill({json:{conversation:{status:'ai'},messages:[]},headers});
   expect(request.headers()['x-olivia-widget-identity']).toBe('test-signed-identity');
   return route.fulfill({json:{clientCode:'nathalie',language:lang,reply:`Nathalie · ${lang} <script>alert(1)</script>`,model:'test-model'},headers});
  });
  await page.setViewportSize({width:390,height:844});await page.goto(`/${lang}/classical/`);
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
  const sent=calls.find(call=>call.url==='/api/olivia/chat')!.data;
  expect(sent.clientCode).toBe('nathalie');expect(sent.language).toBe(lang);expect(sent.metadata.language).toBe(lang);
  expect(sent.metadata.dataConsent).toBe(true);expect(sent.metadata.pageUrl).toContain(`/${lang}/classical/`);
  expect(await page.locator('#olivia-dialog').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})).toBe(true);
  await page.keyboard.press('Escape');await expect(page.locator('#olivia-dialog')).not.toBeVisible();
 });
}
test('Olivia keeps context and visitor identity after changing site language',async({page})=>{
 const bodies:any[]=[];
 await page.route(host+'/**',async route=>{
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'Content-Type,X-Olivia-Widget-Identity','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
  const r=route.request();if(r.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(r.url().endsWith('/identity'))return route.fulfill({headers,json:{clientCode:'nathalie',identity:'signed'}});
  const d=r.method()==='GET'?{}:r.postDataJSON();
  if(r.url().endsWith('/chat')){bodies.push(d);return route.fulfill({headers,json:{clientCode:'nathalie',language:d.language,reply:'Response '+d.language,model:'test'}});}
  return route.fulfill({headers,json:{conversation:{status:'ai'},messages:[]}});
 });
 await page.goto('/fr/classical/');await page.locator('[data-olivia-open]').click();await page.locator('[data-olivia-consent]').check();await page.locator('#olivia-message').fill('Son parcours ?');await page.locator('[type=submit]').click();await expect(page.locator('[data-role=assistant]').last()).toHaveText('Response fr');
 await page.locator('[data-olivia-close]').click();await page.locator('.language-switch summary').click();await page.locator('.language-options a[lang=ja]').click();
 await page.locator('[data-olivia-open]').click();await expect(page.locator('[data-olivia-consent]')).toBeChecked();
 await expect(page.locator('[data-role=assistant]').first()).toContainText('こんにちは');await expect(page.locator('[data-role=assistant]').last()).toHaveText('Response fr');
 await page.locator('#olivia-message').fill('音楽作品は？');await page.locator('[type=submit]').click();await expect(page.locator('[data-role=assistant]').last()).toHaveText('Response ja');
 expect(bodies[1].visitorId).toBe(bodies[0].visitorId);expect(bodies[1].history).toEqual([{role:'user',content:'Son parcours ?'},{role:'assistant',content:'Response fr'}]);
 await page.locator('[data-olivia-reset]').click();await expect(page.locator('[data-role=user]')).toHaveCount(0);await expect(page.locator('[data-olivia-consent]')).not.toBeChecked();
});
test('Olivia displays a localized error when the service fails',async({page})=>{
 await page.route(host+'/**',route=>route.abort());await page.goto('/fr/classical/');await page.locator('[data-olivia-open]').click();await page.locator('[data-olivia-consent]').check();await page.locator('#olivia-message').fill('Bonjour');await page.locator('[type=submit]').click();
 await expect(page.locator('[data-olivia-status]')).toContainText('momentanément indisponible');await expect(page.locator('#olivia-message')).toHaveValue('Bonjour');await expect(page.locator('[type=submit]')).toBeEnabled();
});
test('manual takeover pauses AI replies and receives operator messages',async({page})=>{
 let aiCalls=0;
 await page.clock.install();
 await page.route(host+'/**',async route=>{
  const r=route.request();const headers={'access-control-allow-origin':'*','access-control-allow-headers':'Content-Type,X-Olivia-Widget-Identity','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'};
  if(r.method()==='OPTIONS')return route.fulfill({headers,status:204});
  if(r.url().endsWith('/identity'))return route.fulfill({headers,json:{clientCode:'nathalie',identity:'signed'}});
  if(r.url().endsWith('/chat'))aiCalls++;
  if(r.method()==='GET')return route.fulfill({headers,json:{status:'manual',messages:[{id:'operator-1',role:'operator',content:'Bonjour, comment puis-je vous aider ?'}]}});
  return route.fulfill({headers,json:{conversation:{status:'manual'}}});
 });
 await page.goto('/fr/classical/');await page.locator('[data-olivia-open]').click();await page.locator('[data-olivia-consent]').check();await page.locator('#olivia-message').fill('Je souhaite parler à votre équipe.');await page.locator('[type=submit]').click();
 await expect(page.locator('[data-olivia-status]')).toContainText('L’équipe a pris le relais');expect(aiCalls).toBe(0);
 await page.clock.fastForward(8500);await expect(page.locator('[data-role=operator]')).toHaveText('Bonjour, comment puis-je vous aider ?');
});
