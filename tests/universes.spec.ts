import { test, expect } from '@playwright/test';
for (const lang of ['es', 'en']) {
 for (const width of [390, 768, 1440]) test(`${lang} entrance and both worlds at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/${lang}/`);
  await expect(page.locator('.entry-panel')).toHaveCount(2);
  const panels = await page.locator('.entry-panel').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
  expect(width < 700 ? panels[1].y > panels[0].y : panels[1].x > panels[0].x).toBe(true);
  for (const panel of panels) expect(panel.height).toBeGreaterThan(300);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.screenshot({ path: `test-results/entry-${lang}-${width}.png`, fullPage: true });
  await page.locator('.entry-classical').click();
  await expect(page).toHaveURL(new RegExp(`/${lang}/classical/$`));
  await expect(page.locator('.hero h1')).toHaveText('NathaliePeña-Comas');
  await page.goBack(); await expect(page.locator('.entry')).toBeVisible();
  await page.locator('.entry-popular').click();
  await expect(page).toHaveURL(new RegExp(`/${lang}/popular/$`));
  await expect(page.locator('.popular-hero h1')).toBeVisible();
  await expect(page.locator('.song-card')).toHaveCount(2);
  await expect(page.locator('#story')).toHaveCount(1);
  await expect(page.locator('.universe-nav')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const image of await page.locator('img').all()) {
   await image.scrollIntoViewIfNeeded();
   await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: `test-results/popular-${lang}-${width}.png`, fullPage: true });
  const other = lang === 'es' ? 'en' : 'es';
  await page.locator(`.language-switch a[lang="${other}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/${other}/popular/$`));
  await page.locator(`.universe-nav a[href="/${other}/classical/"]`).click();
  await expect(page.locator('.hero')).toBeVisible();
  await page.locator(`.universe-nav a[href="/${other}/"]`).click();
  await expect(page.locator('.entry')).toBeVisible();
 });
}
test('all routes have distinct canonical, localized alternates and sitemap entries', async ({ request }) => {
 const sitemap = await (await request.get('/sitemap.xml')).text();
 for (const lang of ['es', 'en']) for (const path of ['', 'classical/', 'popular/', 'privacy/']) {
  const response = await request.get(`/${lang}/${path}`); expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain(`rel="canonical" href="https://nathalie-pena-comas.vercel.app/${lang}/${path}"`);
  for (const locale of ['es', 'en']) expect(body).toContain(`hreflang="${locale}" href="https://nathalie-pena-comas.vercel.app/${locale}/${path}"`);
  expect(sitemap).toContain(`<loc>https://nathalie-pena-comas.vercel.app/${lang}/${path}</loc>`);
 }
});
test('keyboard and no-JavaScript entry links work, direct pages retain their universe', async ({ browser }) => {
 const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce' });
 const page = await context.newPage();
 await page.goto('/en/');
 await page.locator('.entry-popular').focus(); await page.keyboard.press('Enter');
 await expect(page).toHaveURL(/\/en\/popular\/$/);
 await page.locator('.language-switch a[lang="es"]').click();
 await expect(page).toHaveURL(/\/es\/popular\/$/);
 await page.goto('/es/classical/'); await expect(page.locator('.hero h1')).toBeVisible();
 await page.locator('.universe-nav a[href="/es/"]').click();
 expect(await page.locator('.entry-panel img').first().evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
 await context.close();
});
test('previous shared section URLs reach the preserved content', async ({ page }) => {
 await page.goto('/es/#story');
 await expect(page).toHaveURL(/\/es\/classical\/#story$/);
 await expect(page.locator('#story')).toBeInViewport();
});

for (const lang of ['es', 'en']) test(`${lang} repertoire and media stay with their world`, async ({ page }) => {
 await page.goto(`/${lang}/classical/`);
 await expect(page.locator('.song-card, .video, [data-video], img')).toHaveCount(0);
 await expect(page.locator('a[href*="4BE0KqF21ot4HCBzuWR6aA"], a[href*="OLAK5uy"], a[href*="HbRmwVkSP8Q"]')).toHaveCount(0);
 await expect(page.locator('.announcement')).not.toContainText('2026');
 await expect(page.locator('[data-classical-album]')).toContainText('Alta Gracia');
 await expect(page.locator('[data-classical-album] a')).toHaveAttribute('href', /latingrammy.com/);
 const classicalGraph = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() || '{}');
 expect(classicalGraph['@graph'].filter((item: { '@type': string }) => item['@type'] === 'MusicRecording')).toHaveLength(0);
 const biography = await page.locator('.story-copy').textContent();
 // Every in-page navigation link resolves to a real section.
 for (const href of await page.locator('.navlinks a').evaluateAll(els => els.map(el => el.getAttribute('href')!))) await expect(page.locator(href)).toHaveCount(1);
 await page.screenshot({ path: `test-results/classical-curated-${lang}.png`, fullPage: true });
 await page.goto(`/${lang}/popular/`);
 await expect(page.locator('.song-card')).toHaveCount(2);
 await expect(page.locator('.video')).toHaveCount(2);
 await expect(page.locator('.release-feature')).toContainText('Quinto Elemento:');
 expect(await page.locator('.story-copy').textContent()).toBe(biography);
 const popularGraph = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() || '{}');
 expect(popularGraph['@graph'].filter((item: { '@type': string }) => item['@type'] === 'MusicRecording')).toHaveLength(2);
 await page.goto(`/${lang}/#music`); await expect(page).toHaveURL(new RegExp(`/${lang}/popular/#music$`));
 await page.goto(`/${lang}/classical/#videos`); await expect(page).toHaveURL(new RegExp(`/${lang}/popular/#videos$`));
});
