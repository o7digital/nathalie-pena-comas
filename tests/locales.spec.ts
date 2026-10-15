import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const localized = JSON.parse(readFileSync(new URL('../src/data/localized.json', import.meta.url), 'utf8')) as Record<string, Record<string,string>>;
const locales = ['es','en','de','fr','it','sv','hu','hr','ru','zh-TW','ja'].map(code=>({code}));

for (const {code} of locales) {
 test(`${code}: translated routes, mobile selector and SEO`, async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(`/${code}/#about`);
  await expect(page.locator('html')).toHaveAttribute('lang',code);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',new RegExp(`/${code}/$`));
  await expect(page.locator('link[hreflang]')).toHaveCount(12);
  await page.locator('.language-switch summary').click();
  const languageLinks=page.locator('.language-options a');
  await expect(languageLinks).toHaveCount(11);
  for (const {code:target} of locales) {
   const link=page.locator(`.language-options a[lang="${target}"]`);
   await expect(link).toHaveAttribute('href',`/${target}/#about`);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const target=code==='fr'?'ja':'fr';
  await page.locator(`.language-options a[lang="${target}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/${target}/#about$`));
  await page.setViewportSize({width:1440,height:900});
  await page.locator('.language-switch summary').click();
  await expect(page.locator('.language-options')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.language-options')).not.toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.goto(`/${code}/privacy/`);
  await expect(page.locator('html')).toHaveAttribute('lang',code);
  await page.locator('.language-switch summary').click();
  await expect(page.locator(`.language-options a[lang="${target}"]`)).toHaveAttribute('href',`/${target}/privacy/`);
  await page.goto(`/${code}/`);
  if(code!=='en'&&code!=='es') {
   const copy=localized[code];
   await expect(page.locator('#navlinks a').first()).toHaveText(copy.Home);
   await expect(page.locator('#hero-title')).toHaveText(/Nathalie/);
   await expect(page.locator('.hero-ctas a').first()).toContainText(copy['Discover Nathalie']);
   await expect(page.locator('#consent-modal [data-consent="accept"]')).toHaveText(copy['Accept all']);
   expect(await page.locator('main').innerText()).not.toContain('Conocer a Nathalie');
  }
 });
}

test('all translation catalogs cover the English source strings',()=>{
 const reference=Object.keys(localized.fr).sort();
 for (const copy of Object.values(localized)) {
  expect(Object.keys(copy).sort()).toEqual(reference);
  expect(Object.values(copy).every(value=>value.trim().length>0)).toBe(true);
 }
});
