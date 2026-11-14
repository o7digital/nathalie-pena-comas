import { test, expect } from '@playwright/test';

for (const [lang,width] of [['fr',390],['es',1440],['en',768],['de',320],['ru',390],['zh-TW',390],['ja',390]] as const) {
 test(`${lang} Spirituosi restores the complete project at ${width}px`,async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width,height:900});
  const thirdParty:string[]=[];page.on('request',r=>{if(new URL(r.url()).origin!==new URL(process.env.TEST_BASE_URL||'http://localhost:4322').origin)thirdParty.push(r.url());});
  await page.goto(`/${lang}/#spirituosi`);
  const section=page.locator('#spirituosi');
  await expect(section.locator('[data-ensemble-story]>p')).toHaveCount(4);
  await expect(section.locator('.ensemble-members dl>div')).toHaveCount(6);
  for(const name of ['Nathalie Peña-Comas','Evelyn Peña-Comas','Nicole Peña-Comas','Damien Lancelle','Gonzalo Manrique','Rubén Sánchez'])await expect(section).toContainText(name);
  await expect(section.locator('.ensemble-countries li')).toHaveCount(5);
  await expect(section.locator('.ensemble-venues li')).toHaveCount(5);
  for(const fact of ['MuTH','Vienna Boys Choir Hall','Teatrino Hall','Liceu','Teatro Nacional Eduardo Brito','Palacio de Bellas Artes','2018','2015','Souvenir Latino','Global Music Awards','Chardonnay','Bernd Kornherr','Sonorwines America','BBC Radio 3','Breakfast']) await expect(section).toContainText(fact);
  await expect(section.locator('[data-ensemble-milestones]>article')).toHaveCount(4);
  await expect(section.locator('a[href="https://www.spirituosi.com/"]')).toHaveCount(1);
  await expect(section.locator('a[href="https://www.sonorwines.com/"]')).toHaveCount(1);
  await expect(section.locator('a[href="https://www.bbc.co.uk/sounds/play/live:bbc_radio_three"]')).toHaveCount(1);
  await expect(section.locator('[data-video]')).toHaveCount(2);
  await expect(section.locator('audio')).toHaveAttribute('preload','none');
  await expect(section.locator('audio')).not.toHaveAttribute('autoplay');
  await expect(section).toContainText('Que Nadie Sepa Mi Sufrir');
  await expect(section.locator('details,[hidden]')).toHaveCount(0);
  if(lang==='fr'){
   const text=await section.innerText();
   for(const fact of ['Esprit, feu, air, souffle et distillat','œuvre originale','expérience musicale interactive','Europe','Caraïbes','novembre 2018','trois médailles','meilleur concert classique','Flûte','Violoncelle','Guitare','Contrebasse'])expect(text).toContain(fact);
  }
  await section.locator('.ensemble-media').scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(thirdParty).toEqual([]);
 });
}

test('both original performances use the confirmed-playback modal',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('https://www.youtube-nocookie.com/**',route=>route.fulfill({contentType:'text/html',body:'<html>Spirituosi</html>'}));
 await page.goto('/fr/#spirituosi');
 for(const id of ['HiZvKI6u3qk','kK6DLIKslYE']){
  await page.locator(`#spirituosi [data-video="${id}"]`).click();
  await expect(page.locator('#video-fallback')).toHaveAttribute('href',`https://www.youtube.com/watch?v=${id}`);
  await expect(page.locator('#video-container iframe')).toHaveCount(0);
  await page.locator('#load-video').click();
  await expect(page.locator('#video-container iframe')).toHaveAttribute('src',new RegExp(`/embed/${id}\\?`));
  await page.keyboard.press('Escape');await expect(page.locator('#video-modal')).not.toBeVisible();
 }
});

test('the restored original audio has playable metadata and loads only on request',async({page})=>{
 const requests:string[]=[];page.on('request',r=>{if(r.url().endsWith('.mp3'))requests.push(r.url());});
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/en/#spirituosi');
 const audio=page.locator('#spirituosi-audio');
 expect(requests).toEqual([]);
 expect(await audio.evaluate((el:HTMLAudioElement)=>el.readyState)).toBe(0);
 await audio.evaluate((el:HTMLAudioElement)=>el.load());
 await expect.poll(()=>audio.evaluate((el:HTMLAudioElement)=>el.duration)).toBeGreaterThan(0);
 expect(await audio.evaluate((el:HTMLAudioElement)=>el.paused)).toBe(true);
});

test('the full Spirituosi text and direct media links work without JavaScript',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false,baseURL:process.env.TEST_BASE_URL||'http://localhost:4322'});
 const page=await context.newPage();await page.goto('/es/#spirituosi');
 await expect(page.locator('#spirituosi [data-ensemble-story]>p')).toHaveCount(4);
 await expect(page.locator('#spirituosi')).toContainText('Bernd Kornherr');
 await expect(page.locator('#spirituosi a[href^="https://www.youtube.com/watch"]')).toHaveCount(2);
 await expect(page.locator('#spirituosi audio')).toHaveAttribute('controls','');
 await context.close();
});
