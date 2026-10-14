import { test, expect } from '@playwright/test';
for (const lang of ['es', 'en']) for (const width of [390, 768, 1440]) {
 test(`${lang} responsive at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const errors: string[] = []; const thirdParty: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (new URL(r.url()).origin !== new URL(process.env.TEST_BASE_URL || 'http://localhost:4322').origin) thirdParty.push(r.url()); });
  await page.goto(`/${lang}/`); await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  await expect(page.locator('h1')).toHaveText('NathaliePeña-Comas');
  await expect(page.locator('.release-feature h3')).toContainText('Quinto Elemento:');
  await expect(page.locator('.language-switch a[aria-current="page"]')).toHaveText(lang.toUpperCase());
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const image of await page.locator('img').all()) { await image.scrollIntoViewIfNeeded(); await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true); }
  await page.evaluate(() => window.scrollTo(0,0));
  expect(await page.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(e => e.id)); expect(new Set(ids).size).toBe(ids.length);
  expect(thirdParty).toEqual([]); expect(errors).toEqual([]);
  if (width < 780) {
   await page.locator('#menu-btn').click(); await expect(page.locator('#menu-btn')).toHaveAttribute('aria-expanded', 'true');
   await page.locator('#navlinks a[href="#music"]').click(); await expect(page.locator('#menu-btn')).toHaveAttribute('aria-expanded', 'false');
   await expect(page.locator('.nav')).toHaveClass(/scrolled/);
  }
  await page.screenshot({ path: `test-results/${lang}-${width}.png` });
 });
}
test('video loads on confirmation, traps focus, and restores focus on Escape', async ({ page }) => {
 await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({ body: '<html><body>Video embed</body></html>', contentType: 'text/html' }));
 await page.goto('/en/'); const trigger = page.locator('.hero [data-video]'); await trigger.click();
 await expect(page.locator('#video-modal')).toBeVisible(); await expect(page.locator('iframe')).toHaveCount(0);
 await page.keyboard.press('Shift+Tab');
 expect(await page.evaluate(() => !!document.activeElement?.closest('#video-modal'))).toBe(true);
 await page.locator('#load-video').click();
 await expect(page.locator('iframe')).toHaveAttribute('src', /youtube-nocookie.com\/embed\/HbRmwVkSP8Q/);
 await page.keyboard.press('Escape'); await expect(page.locator('#video-modal')).not.toBeVisible();
 await expect(page.locator('iframe')).toHaveCount(0); await expect(trigger).toBeFocused();
 await page.locator('.video [data-video="otT5_7vJYv4"]').click();
 await expect(page.locator('#video-title')).toHaveText('Esclavo y Amo');
 await expect(page.locator('#video-fallback')).toHaveAttribute('href', /otT5_7vJYv4/);
});
test('language routes work without JavaScript; localized SEO and sitemap exist', async ({ browser, request }) => {
 const context = await browser.newContext({ javaScriptEnabled: false, baseURL: process.env.TEST_BASE_URL || "http://localhost:4322" }); const page = await context.newPage();
 await page.goto('/es/'); await page.locator('.language-switch a[lang="en"]').click();
 await expect(page).toHaveURL(/\/en\/$/); await expect(page.locator('.hero-ctas a').first()).toContainText('Discover the artist');
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
 await page.goto('/en/'); await expect(page.locator('#consent-modal')).toBeVisible(); expect(gaEvents).toHaveLength(0); expect(pixelEvents).toHaveLength(0);
 await page.locator('[data-consent="reject"]').click(); await page.reload(); await expect(page.locator('#consent-modal')).not.toBeVisible(); expect(gaEvents).toHaveLength(0);
 await page.locator('footer [data-preferences]').click(); await page.locator('#consent-analytics').check(); await page.locator('[data-consent="save"]').click();
 await expect.poll(() => gaEvents.length).toBe(1); expect(pixelEvents).toHaveLength(0);
 await page.locator('.platform[href*="spotify"]').evaluate((el: HTMLAnchorElement) => { el.addEventListener('click', e => e.preventDefault()); el.click(); });
 const events = await page.evaluate(() => (window as unknown as { dataLayer: unknown[][] }).dataLayer);
 expect(events.some(item => item[0] === 'event' && item[1] === 'music_platform_click')).toBe(true);
 await page.locator('footer [data-preferences]').click(); await page.locator('[data-consent="reject"]').click(); await page.waitForLoadState('networkidle');
 expect(await page.evaluate(() => JSON.parse(localStorage.getItem('npc-consent-v1') || '{}').analytics)).toBe(false);
 expect(gaEvents).toHaveLength(1);
});
test('reduced motion keeps content visible', async ({ page }) => {
 await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/es/');
 expect(await page.locator('.story-copy').evaluate(el => getComputedStyle(el).opacity)).toBe('1');
 expect(await page.locator('html').evaluate(el => getComputedStyle(el).scrollBehavior)).toBe('auto');
});

test('official album gallery and opera performances open the correct destinations', async ({page}) => {
 await page.goto('/en/');
 await expect(page.locator('.album')).toHaveCount(4);
 await expect(page.locator('.release-feature a')).toHaveAttribute('href','https://orcd.co/quintoelemento');
 for (const [id,title] of [['pG7lJPLcO-g','Song to the Moon'],['NrGZajhOGAc','O soave fanciulla']]) {
  await page.locator(`[data-video="${id}"]`).click();
  await expect(page.locator('#video-title')).toHaveText(title);
  await expect(page.locator('#video-fallback')).toHaveAttribute('href',`https://www.youtube.com/watch?v=${id}`);
  await page.keyboard.press('Escape');
 }
});
