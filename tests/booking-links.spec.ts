import {test,expect} from '@playwright/test';

const booking='https://www.tuboleta.com.do/nathaliepe%C3%B1a-comas';
for(const lang of ['es','en','fr','de','it','sv','hu','hr','ru','zh-TW','ja']){
 test(`${lang} ticket booking stays reachable from the biography on a small screen`,async({page})=>{
  await page.setViewportSize({width:320,height:850});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route(booking,route=>route.fulfill({body:'<title>Quinto Elemento — TuBoleta</title>'}));
  await page.goto(`/${lang}/#about-collaborations`);
  await expect(page.locator('#about-collaborations')).toBeVisible();
  const link=page.locator('#site-header .booking-link');
  await expect(link).toBeVisible();await expect(link).toHaveAttribute('href',booking);
  const [tickets]=await Promise.all([page.waitForEvent('popup'),link.click()]);
  await expect(tickets).toHaveURL(booking);
  await tickets.close();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}

test('original performance, album and news destinations are available without JavaScript',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false,baseURL:process.env.TEST_BASE_URL||'http://localhost:4322'});
 const page=await context.newPage();await page.goto('/es/');
 const media=page.locator('[data-official-links="videos"]');await media.locator('summary').click();
 await expect(media.locator('a[href="https://www.youtube.com/watch?v=ep8oTorhG5E"]')).toContainText('Andrea Bocelli');
 await expect(media.locator('a[href*="B07YQFLTTR"]')).toContainText('Ha llegado la Navidad');
 const news=page.locator('[data-official-links="news"]');await news.locator('summary').click();
 await expect(news.locator('a[href="https://www.opernsommer.at/"]')).toContainText('Don Giovanni');
 await expect(news.locator('a[href*="concert-in-the-gallery"]')).toContainText('Armen Guzelimian');
 const past=page.locator('[data-official-links="concerts"]');await past.locator('summary').click();
 await expect(past.locator('a[href*="carmina-burana"]')).toContainText('Carmina Burana');
 await context.close();
});
