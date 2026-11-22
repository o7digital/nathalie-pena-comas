import { test, expect } from '@playwright/test';
for (const lang of ['es', 'en']) for (const width of [390, 768, 1024, 1280, 1440]) {
 test(`${lang} responsive at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = []; const thirdParty: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (new URL(r.url()).origin !== new URL(process.env.TEST_BASE_URL || 'http://localhost:4322').origin) thirdParty.push(r.url()); });
  await page.goto(`/${lang}/`); await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  await expect(page.locator('h1')).toHaveText('NathaliePeña-Comas');
  await expect(page.locator('.release-feature h3')).toContainText('Quinto Elemento:');
  await expect(page.locator('.language-switch a[aria-current="page"]')).toHaveText(lang === 'es' ? 'Español' : 'English');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Closed listening panels deliberately keep their images unloaded until opened.
  for (const image of await page.locator('img:visible').all()) { await image.scrollIntoViewIfNeeded(); await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true); }
  await page.evaluate(() => window.scrollTo(0,0));
  expect(await page.locator('img:visible').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(e => e.id)); expect(new Set(ids).size).toBe(ids.length);
  expect(thirdParty).toEqual([]); expect(errors).toEqual([]);
  if (width <= 1250) {
   await page.locator('#menu-btn').click(); await expect(page.locator('#menu-btn')).toHaveAttribute('aria-expanded', 'true');
   const about = page.locator('#navlinks a[href="#about"]');
   await about.click(); await expect(page.locator('#menu-btn')).toHaveAttribute('aria-expanded', 'false');
   await expect(page.locator('.nav .official-brand img')).toBeVisible();
  }
  await page.screenshot({ path: `test-results/${lang}-${width}.png` });
 });
}
test('video loads on confirmation, traps focus, and restores focus on Escape', async ({ page }) => {
 await page.emulateMedia({ reducedMotion: 'reduce' });
 await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({ body: '<html><body>Video embed</body></html>', contentType: 'text/html' }));
 await page.goto('/en/'); const trigger = page.locator('.hero [data-video]'); await trigger.click();
 await expect(page.locator('#video-modal')).toBeVisible(); await expect(page.locator('iframe')).toHaveCount(0);
 await page.keyboard.press('Shift+Tab');
 expect(await page.evaluate(() => !!document.activeElement?.closest('#video-modal'))).toBe(true);
 await page.locator('#load-video').click();
 await expect(page.locator('iframe')).toHaveAttribute('src', /youtube-nocookie.com\/embed\/kglZQlwuAqU/);
 await page.keyboard.press('Escape'); await expect(page.locator('#video-modal')).not.toBeVisible();
 await expect(page.locator('iframe')).toHaveCount(0); await expect(trigger).toBeFocused();
 await page.locator('.video [data-video="otT5_7vJYv4"]').click();
 await expect(page.locator('#video-title')).toHaveText('Esclavo y Amo');
 await expect(page.locator('#video-fallback')).toHaveAttribute('href', /otT5_7vJYv4/);
});
test('language routes work without JavaScript; localized SEO and sitemap exist', async ({ browser, request }) => {
 const context = await browser.newContext({ javaScriptEnabled: false, baseURL: process.env.TEST_BASE_URL || "http://localhost:4322" }); const page = await context.newPage();
 await page.goto('/es/'); await page.locator('.language-switch summary').click(); await page.locator('.language-switch a[lang="en"]').click();
 await expect(page).toHaveURL(/\/en\/$/); await expect(page.locator('.hero-ctas a').first()).toContainText('Discover Nathalie');
 await expect(page.locator('link[hreflang="es"]')).toHaveCount(1);
 const graph = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() || '{}');
 expect(graph['@graph'].filter((item: { '@type': string }) => item['@type'] === 'MusicRecording')).toHaveLength(2);
 for (const path of ['/es/privacy/', '/en/privacy/', '/robots.txt', '/sitemap.xml']) expect((await request.get(path)).ok()).toBe(true);
 await context.close();
});
test('analytics and advertising require separate consent; withdrawal persists', async ({ page }) => {
 const gaEvents: string[] = []; const pixelEvents: string[] = [];
 await page.route('**/en/', async route => {
  const response = await route.fetch(); const body = (await response.text()).replace(/data-ga(?:="")?(?=[ >])/, 'data-ga="G-TEST123"').replace(/data-pixel(?:="")?(?=[ >])/, 'data-pixel="123456"');
  await route.fulfill({ response, body });
 });
 await page.route('https://www.googletagmanager.com/**', route => { gaEvents.push(route.request().url()); return route.fulfill({body:'',contentType:'text/javascript'}); });
 await page.route('https://connect.facebook.net/**', route => { pixelEvents.push(route.request().url()); return route.fulfill({body:'',contentType:'text/javascript'}); });
 await page.route('https://open.spotify.com/embed/**',route=>route.fulfill({contentType:'text/html',body:'<html>Music player</html>'}));
 await page.goto('/en/'); await expect(page.locator('#consent-modal')).toBeVisible(); expect(gaEvents).toHaveLength(0); expect(pixelEvents).toHaveLength(0);
 await page.locator('[data-consent="reject"]').click(); await page.reload(); await expect(page.locator('#consent-modal')).not.toBeVisible(); expect(gaEvents).toHaveLength(0);
 await page.locator('footer [data-preferences]').click(); await page.locator('#consent-analytics').check(); await page.locator('[data-consent="save"]').click();
 await expect.poll(() => gaEvents.length).toBe(1); expect(pixelEvents).toHaveLength(0);
 await page.locator('.footer-social .platform').click();
 expect(await page.evaluate(()=>(window as unknown as {dataLayer:unknown[][]}).dataLayer.some(item=>item[1]==='music_platform_click'))).toBe(false);
 await page.locator('#music-modal [data-listening-panel=nathalie] [data-music-service=spotify]').click();
 const events = await page.evaluate(() => (window as unknown as { dataLayer: unknown[][] }).dataLayer);
 expect(events.some(item => item[0] === 'event' && item[1] === 'music_platform_click')).toBe(true);
 const event=events.find(item=>item[1]==='music_platform_click')?.[2] as {section:string};expect(event.section).toBe('footer');
 await page.locator('[data-music-close]').click();await expect(page.locator('#music-modal')).not.toBeVisible();
 await page.locator('footer [data-preferences]').click(); await page.locator('[data-consent="reject"]').click(); await page.waitForLoadState('networkidle');
 expect(await page.evaluate(() => JSON.parse(localStorage.getItem('npc-consent-v1') || '{}').analytics)).toBe(false);
 expect(gaEvents).toHaveLength(1);
});
test('reduced motion keeps content visible', async ({ page }) => {
 await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/es/');
 expect(await page.locator('.biography-prose').evaluate(el => getComputedStyle(el).opacity)).toBe('1');
 expect(await page.locator('html').evaluate(el => getComputedStyle(el).scrollBehavior)).toBe('auto');
});

test('official album gallery and opera performances open the correct destinations', async ({page}) => {
 await page.goto('/en/');
 await expect(page.locator('.album')).toHaveCount(4);
 await expect(page.locator('.release-feature .btn-gold')).toHaveAttribute('href','https://orcd.co/quintoelemento');
 await expect(page.locator('.release-feature .concert-reservation')).toHaveAttribute('href','https://www.tuboleta.com.do/nathaliepe%C3%B1a-comas');
 for (const [id,title] of [['pG7lJPLcO-g','Song to the Moon'],['NrGZajhOGAc','O soave fanciulla']]) {
  await page.locator(`.video [data-video="${id}"]`).click();
  await expect(page.locator('#video-title')).toHaveText(title);
  await expect(page.locator('#video-fallback')).toHaveAttribute('href',`https://www.youtube.com/watch?v=${id}`);
  await page.keyboard.press('Escape');
 }
});

test('official NPC identity, complete navigation and editorial sections are retained', async ({page}) => {
 await page.goto('/en/');
 const nav=page.locator('#navlinks a');
 await expect(nav).toHaveText(['Home','About','Schedule','Repertoire','News','Press','Media','Spirituosi','Gallery','Contact']);
 const paths=['#home','#about','#schedule','#repertorio','#news','#press','#media','#spirituosi','#gallery','#contact'];
 for(let i=0;i<paths.length;i++) await expect(nav.nth(i)).toHaveAttribute('href', paths[i]);
 await expect(page.locator('.nav .brand img')).toHaveAttribute('src','/logo-npc.png');
 await expect(page.locator('footer .brand img')).toHaveAttribute('src','/logo-npc.png');
 const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const concertDates = await page.locator('.concert time').evaluateAll(nodes => nodes.map(node => node.getAttribute('datetime') || ''));
 expect(concertDates.every(date => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today)).toBe(true);
 expect(concertDates).toEqual([...concertDates].sort());
 await expect(page.locator('#spirituosi')).toContainText('Ensemble');
  await expect(page.locator('.biography-prose')).toContainText('Violetta');
 await expect(page.locator('#gallery figure:not([data-gallery-clone])')).toHaveCount(3);
 await expect(page.locator('#newsletter a, #newsletter button, #newsletter form')).toHaveCount(0);
 await expect(page.locator('#newsletter')).toContainText('unavailable in this demonstration');
 await expect(page.locator('.classical-grid [data-video]')).toHaveCount(4);
 await expect(page.locator('.classical-grid [data-video]').first()).toHaveAttribute('data-video','pG7lJPLcO-g');
 for(const [id,title] of [['U1QDrRtdnAI','Addio del passato'],['Ept9wg2IlDo','In trutina']]) {
  await page.locator(`.video [data-video="${id}"]`).click();
  await expect(page.locator('#video-title')).toHaveText(title);
  await page.keyboard.press('Escape');
 }
});
