import { test, expect } from '@playwright/test';

for (const [lang,width] of [['fr',390],['es',1440],['en',768],['de',320],['ru',390],['ja',390],['zh-TW',390]] as const) {
 test(`${lang} complete classical programme and separate contemporary section at ${width}px`, async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width,height:900});
  await page.goto(`/${lang}/#repertorio`);
  const opera=page.locator('#repertoire-opera'), concert=page.locator('#repertoire-concert');
  await expect(opera).toBeVisible(); await expect(concert).toBeHidden();
  await expect(opera.locator('[data-opera-role]')).toHaveCount(18);
  // The official list has four preparation markers, never four performed-role claims.
  await expect(opera.locator('[data-opera-role] sup')).toHaveCount(4);
  await expect(opera).toContainText('Queen of trolls');
  await expect(opera).toContainText('Agleia Federweiss');
  await expect(opera).toContainText('Violetta Valéry');
  await page.locator('[data-repertoire-tab="concert"]').click();
  await expect(concert).toBeVisible(); await expect(opera).toBeHidden();
  await expect(concert.locator('[data-concert-work]')).toHaveCount(40);
  await expect(concert.locator('[data-repertoire-composer]')).toHaveCount(26);
  for(const title of ['Magnificat BWV 243','Requiem KV 626','Cancionero de ausencias','Musikalische Exequien SWV 279–281 (op. 7)','Gloria in D RV 589']) await expect(concert).toContainText(title);
  await page.locator('[data-repertoire-tab="concert"]').press('ArrowLeft');
  await expect(page.locator('[data-repertoire-tab="opera"]')).toBeFocused();
  await expect(opera).toBeVisible();
  await page.keyboard.press('End'); await expect(concert).toBeVisible();
  await page.keyboard.press('Home'); await expect(opera).toBeVisible();
  await expect(page.locator('#repertorio [data-repertoire="contemporary"]')).toHaveCount(0);
  await expect(page.locator('#repertorio a[href="https://orcd.co/quintoelemento"]')).toHaveCount(0);
  await expect(page.locator('#contemporain .contemporary-release')).toHaveCount(4);
  await page.locator('.repertoire-next').click();
  await expect(page).toHaveURL(/#contemporain$/);
  await expect(page.locator('.language-switch a[lang="fr"]')).toHaveAttribute('href','/fr/#contemporain');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}

test('all 58 official entries remain readable without JavaScript', async ({browser}) => {
 const context=await browser.newContext({javaScriptEnabled:false,baseURL:process.env.TEST_BASE_URL||'http://localhost:4322'});
 const page=await context.newPage(); await page.goto('/fr/#repertorio');
 await expect(page.locator('[data-repertoire-tabs]')).toBeHidden();
 await expect(page.locator('#repertoire-opera')).toBeVisible();
 await expect(page.locator('#repertoire-concert')).toBeVisible();
 await expect(page.locator('[data-opera-role]')).toHaveCount(18);
 await expect(page.locator('[data-concert-work]')).toHaveCount(40);
 await context.close();
});

test('composer entrances work on scroll and respect a change to reduced motion', async ({page}) => {
 await page.goto('/fr/#repertorio');
 await page.locator('[data-repertoire-tab="opera"]').scrollIntoViewIfNeeded();
 const group=page.locator('#repertoire-opera [data-repertoire-composer]').first();
 await group.scrollIntoViewIfNeeded();
 await expect(group).toHaveClass(/is-revealed/);
 await expect.poll(()=>group.evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
 await page.emulateMedia({reducedMotion:'reduce'});
 expect(await page.locator('.repertoire-title-star').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await page.locator('[data-repertoire-tab="concert"]').click();
 for(const group of await page.locator('#repertoire-concert [data-repertoire-composer]').all()) expect(await group.evaluate(el=>getComputedStyle(el).opacity)).toBe('1');
});

test('sticky mobile tabs return to the start of the selected programme', async ({page}) => {
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:390,height:844});
 await page.goto('/fr/#repertorio');
 await page.locator('#repertoire-opera [data-opera-role]').last().scrollIntoViewIfNeeded();
 await page.locator('[data-repertoire-tab="concert"]').click();
 const first=await page.locator('#repertoire-concert [data-concert-work]').first().boundingBox();
 expect(first!.y).toBeGreaterThan(96);
 expect(first!.y).toBeLessThan(700);
});
