import {test, expect} from '@playwright/test';
const ids=['home','about','schedule','news','press','media','spirituosi','gallery','contact'];
const labels={es:['Inicio','La artista','Agenda','Noticias','Prensa','Videos','Spirituosi','Galería','Contacto'],en:['Home','About','Schedule','News','Press','Media','Spirituosi','Gallery','Contact']};
for(const lang of ['es','en'] as const)for(const world of ['classical','popular'])for(const width of [390,1440]) {
 test(`${lang}/${world} full source menu and internal content at ${width}`,async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width,height:900});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`/${lang}/${world}/`);
  await expect(page.locator('#navlinks a')).toHaveText(labels[lang]);
  await expect(page.locator('.footer-navigation a')).toHaveText(labels[lang]);
  for(const group of ['#navlinks','.footer-navigation'])for(const id of ids){
   if(group==='#navlinks'&&width<1251)await page.locator('#menu-btn').click();
   await page.locator(`${group} a[href="#${id}"]`).click();
   await expect(page).toHaveURL(new RegExp(`/${lang}/${world}/#${id}$`));
   await expect(page.locator(`#${id}`)).toHaveCount(1);
   await expect(page.locator(`#${id}`)).toBeInViewport();
  }
  const broken=await page.locator('a[href]').evaluateAll(links=>links.flatMap(el=>{
   const a=el as HTMLAnchorElement;const url=new URL(a.href);
   if(/nathaliepenacomas\.net$/.test(url.hostname))return [a.href];
   if(url.origin===location.origin&&url.pathname===location.pathname&&url.hash&&!document.getElementById(decodeURIComponent(url.hash.slice(1))))return [a.href];
   return [];
  }));expect(broken).toEqual([]);
  await expect(page.locator('#contact a[href="mailto:office@buchmann.at"]')).toBeVisible();
  await expect(page.locator('#contact a[href="mailto:info@opera-connection.com"]')).toBeVisible();
  await expect(page.locator('#spirituosi')).toContainText('Souvenir Latino');
  await expect(page.locator('#press')).toContainText('Oh! Magazine');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.goto(`/${lang}/${world}/`);await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`test-results/full-${lang}-${world}-${width}.png`});
 });
}
for(const world of ['classical','popular'])test(`${world} videos retain real playback, confirmation and keyboard focus`,async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('https://www.youtube-nocookie.com/**',route=>route.fulfill({body:'<html>Video</html>',contentType:'text/html'}));
 await page.goto(`/en/${world}/`);
 const buttons=page.locator('[data-video]');expect(await buttons.count()).toBe(world==='classical'?5:4);
 for(const button of await buttons.all()){
  const id=await button.getAttribute('data-video');await button.click();
  await expect(page.locator('#video-modal')).toBeVisible();await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('#video-fallback')).toHaveAttribute('href',`https://www.youtube.com/watch?v=${id}`);
  await page.locator('#load-video').click();await expect(page.locator('iframe')).toHaveAttribute('src',new RegExp(`/embed/${id}\\?`));
  await page.keyboard.press('Escape');await expect(page.locator('#video-modal')).not.toBeVisible();await expect(button).toBeFocused();
 }
});
test('repertoire, images, projects and press are rendered within the correct journey',async({page})=>{
 await page.goto('/es/classical/');
 await expect(page.locator('#collection')).toContainText('Alta Gracia');await expect(page.locator('#collection')).toContainText('Souvenir Latino');
 await expect(page.locator('#media')).toContainText('In trutina');await expect(page.locator('#media')).not.toContainText('Esclavo y Amo');
 await expect(page.locator('#news')).toContainText('Don Giovanni');
 await expect(page.locator('#home img')).toHaveAttribute('alt',/Nathalie/);
 await page.goto('/es/popular/');
 await expect(page.locator('#collection')).toContainText('Una Mujer');await expect(page.locator('#collection')).not.toContainText('Alta Gracia');
 await expect(page.locator('#media')).toContainText('Esclavo y Amo');await expect(page.locator('#media')).toContainText('Sombras Nada Más');
 await expect(page.locator('#media')).not.toContainText('In trutina');await expect(page.locator('#news')).toContainText('Quinto Elemento');
});

for(const world of ['classical','popular'])test(`${world} initial page remains local without automatic media`,async({page})=>{
 const external:string[]=[];page.on('request',r=>{if(new URL(r.url()).origin!==new URL(process.env.TEST_BASE_URL||'http://localhost:4322').origin)external.push(r.url());});
 await page.goto(`/es/${world}/`);await expect(page.locator('iframe')).toHaveCount(0);expect(external).toEqual([]);
 await page.setViewportSize({width:390,height:900});
 const switcher=await page.locator('.universe-nav').boundingBox();const assistant=await page.locator('.olivia-launcher').boundingBox();
 expect(assistant!.y+assistant!.height).toBeLessThan(switcher!.y);
 expect(await page.locator('.universe-nav a').first().evaluate(el=>getComputedStyle(el).color)).toBe('rgb(229, 217, 200)');
});
