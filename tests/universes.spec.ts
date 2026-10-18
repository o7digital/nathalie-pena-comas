import {test, expect} from '@playwright/test';
const languages=['es','en','de','fr','it','sv','hu','hr','ru','zh-TW','ja'];
for(const width of [390,768,1440])test(`entrance connects both internal journeys at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/es/');await page.evaluate(()=>document.fonts.ready);
 await expect(page.locator('.entry-panel')).toHaveCount(2);await expect(page.locator('.entry-panel img')).toHaveCount(2);
 await page.screenshot({path:`test-results/entrance-${width}.png`});
 await page.locator('.entry-classical').click();await expect(page).toHaveURL(/\/es\/classical\/$/);await expect(page.locator('#navlinks a')).toHaveCount(9);
 await page.goBack();await expect(page.locator('.entry')).toBeVisible();
 await page.locator('.entry-popular').click();await expect(page).toHaveURL(/\/es\/popular\/$/);await expect(page.locator('#navlinks a')).toHaveCount(9);
 await page.locator('.universe-nav a[href="/es/"]').click();await expect(page.locator('.entry')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('all eleven source languages preserve both journeys, metadata and sitemap',async({request})=>{
 const sitemap=await(await request.get('/sitemap.xml')).text();
 for(const lang of languages)for(const path of ['','classical/','popular/','privacy/']){
  const url=`/${lang}/${path}`;const response=await request.get(url);expect(response.status(),url).toBe(200);const html=await response.text();
  expect(html).toContain(`lang="${lang}"`);expect(html).toContain(`rel="canonical" href="https://nathalie-pena-comas.vercel.app${url}"`);
  expect(sitemap).toContain(`<loc>https://nathalie-pena-comas.vercel.app${url}</loc>`);
  expect((html.match(/rel="alternate" hreflang=/g)||[]).length).toBe(12);
  expect(html).not.toContain('nathaliepenacomas.net');
 }
});
for(const world of ['classical','popular'])test(`${world} language switches preserve current section and universe`,async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(`/es/${world}/#gallery`);
 await expect(page.locator('.language-switch a[lang="en"]')).toHaveAttribute('href',`/en/${world}/#gallery`);
 await page.locator('.language-switch summary').click();await page.locator('.language-options a[lang="en"]').click();
 await expect(page).toHaveURL(new RegExp(`/en/${world}/#gallery$`));
 await page.locator('.universe-nav a').first().click();await expect(page).toHaveURL(/\/en\/$/);
});
test('keyboard and no-JavaScript links reach complete content directly',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();
 await page.goto('/es/');await page.locator('.entry-classical').focus();await page.keyboard.press('Enter');
 await expect(page).toHaveURL(/\/es\/classical\/$/);await page.locator('#navlinks a[href="#press"]').click();await expect(page.locator('#press')).toBeInViewport();
 await page.locator('.universe-nav a[href="/es/popular/"]').click();await expect(page.locator('#schedule')).toHaveCount(1);
 await page.locator('.language-switch summary').click();await page.locator('.language-options a[lang="fr"]').click();await expect(page).toHaveURL(/\/fr\/popular\/$/);
 await context.close();
});
