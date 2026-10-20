import {test,expect} from '@playwright/test';
const ids=['home','about','schedule','repertorio','news','press','media','spirituosi','gallery','contact'];
const labels={en:['Home','About','Schedule','Repertoire','News','Press','Media','Spirituosi','Gallery','Contact'],es:['Inicio','La artista','Agenda','Repertorio','Noticias','Prensa','Videos','Spirituosi','Galería','Contacto']};
for(const lang of ['es','en'] as const) for(const width of [390,1440]) {
 test(`${lang} all menu and footer entries stay inside Astro at ${width}px`,async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width,height:900});await page.goto(`/${lang}/`);
  await expect(page.locator('#navlinks a')).toHaveText(labels[lang]);
  await expect(page.locator('.footer-navigation a')).toHaveText(labels[lang]);
  const classical = page.locator('[data-repertoire="classical"]');
  const contemporary = page.locator('[data-repertoire="contemporary"]');
  await expect(classical).toContainText('Alta Gracia');
  await expect(classical.locator('a[href^="https://www.youtube.com/watch"]')).toHaveCount(4);
  await expect(contemporary).toContainText('Quinto Elemento: Tierra');
  await expect(contemporary.locator('a[href="https://orcd.co/quintoelemento"]')).toHaveCount(1);
  const left = await classical.boundingBox(), right = await contemporary.boundingBox();
  expect(left).not.toBeNull(); expect(right).not.toBeNull();
  if(width > 780) { expect(right!.x).toBeGreaterThan(left!.x); expect(right!.y).toBe(left!.y); }
  else expect(right!.y).toBeGreaterThan(left!.y + left!.height);
  for(const group of ['#navlinks','.footer-navigation'])for(const id of ids){
   if(group==='#navlinks'&&width<1251)await page.locator('#menu-btn').click();
   const link=page.locator(`${group} a[href="#${id}"]`);await link.click();
   await expect(page).toHaveURL(new RegExp(`/${lang}/#${id}$`));
   const target=page.locator(`#${id}`);await expect(target).toHaveCount(1);
   await expect.poll(async()=>target.evaluate(el=>{
    const rect=el.getBoundingClientRect();const header=document.querySelector('#site-header')!.getBoundingClientRect();
    return el.id==='home'?window.scrollY<2:rect.top>=header.bottom-2&&rect.top<innerHeight;
   })).toBe(true);
   if(group==='#navlinks'&&width<1251)await expect(page.locator('#menu-btn')).toHaveAttribute('aria-expanded','false');
  }
  const broken=await page.locator('a[href]').evaluateAll(links=>links.flatMap(el=>{
   const a=el as HTMLAnchorElement;const url=new URL(a.href);
   if(/(^|\.)nathaliepenacomas\.net$/.test(url.hostname))return ['Wix destination: '+a.href];
   if(url.origin===location.origin&&url.pathname===location.pathname&&url.hash&&!document.getElementById(decodeURIComponent(url.hash.slice(1))))return ['Missing target: '+a.href];
   return [];
  }));expect(broken).toEqual([]);
  await expect(page.locator('#contact a[href="mailto:office@buchmann.at"]')).toBeVisible();
  await expect(page.locator('#contact a[href="mailto:info@opera-connection.com"]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
for(const lang of ['es','en'] as const){
 test(`${lang} discovery links and every video button have a real destination`,async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(`/${lang}/`);
  const hrefs=await page.locator('main a[href^="#"]').evaluateAll(links=>[...new Set(links.map(el=>el.getAttribute('href')!))]);
  for(const href of hrefs){await page.locator(`main a[href="${href}"]`).first().click();await expect(page).toHaveURL(new RegExp(`${href}$`));await expect(page.locator(href)).toHaveCount(1);}
  await page.route('https://www.youtube-nocookie.com/**',route=>route.fulfill({body:'<html>Video</html>',contentType:'text/html'}));
  for(const button of await page.locator('[data-video]').all()){
   const id=await button.getAttribute('data-video');await button.click();await expect(page.locator('#video-modal')).toBeVisible();
   await expect(page.locator('#video-fallback')).toHaveAttribute('href',`https://www.youtube.com/watch?v=${id}`);
   await expect(page.locator('iframe')).toHaveCount(0);await page.locator('#load-video').click();
   await expect(page.locator('iframe')).toHaveAttribute('src',new RegExp(`/embed/${id}\\?`));
   await page.locator('[data-close-video]').click();await expect(page.locator('#video-modal')).not.toBeVisible();
  }
  await expect(page.locator('#newsletter a,#newsletter button,#newsletter input')).toHaveCount(0);
 });
}
test('language switching retains every section and follows manual scrolling',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const id of [...ids,'voice','music','collection','music-films','newsletter']){
  await page.goto(`/es/#${id}`);
  await expect(page.locator('.language-switch a[lang="en"]')).toHaveAttribute('href',`/en/#${id}`);
  await page.locator('.language-switch summary').click();await page.locator('.language-switch a[lang="en"]').click();await expect(page).toHaveURL(new RegExp(`/en/#${id}$`));
  await expect(page.locator('.language-switch a[lang="es"]')).toHaveAttribute('href',`/es/#${id}`);
 }
 await page.goto('/en/#about');await page.locator('#gallery').scrollIntoViewIfNeeded();
 await expect(page.locator('.language-switch a[lang="es"]')).toHaveAttribute('href','/es/#gallery');
 await page.locator('.language-switch summary').click();await page.locator('.language-switch a[lang="es"]').click();await expect(page).toHaveURL(/\/es\/#gallery$/);
});
