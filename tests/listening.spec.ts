import {test,expect} from '@playwright/test';
import {musicEmbed,musicIdentity} from '../src/lib/music-players';

test('only supported official URLs can become music players, with the right album or song identity',()=>{
 expect(musicEmbed('https://open.spotify.com/album/6vlLonr2byiZjhEHqLpOgT')?.src).toContain('/embed/album/6vlLonr2byiZjhEHqLpOgT');
 expect(musicEmbed('https://open.spotify.com/track/4BE0KqF21ot4HCBzuWR6aA')?.height).toBe(152);
 expect(musicEmbed('https://music.apple.com/ca/album/souvenir-latino/1268832661')?.src).toBe('https://embed.music.apple.com/ca/album/souvenir-latino/1268832661');
 expect(musicEmbed('https://www.deezer.com/album/45944422')?.src).toContain('/album/45944422');
 for(const url of ['javascript:alert(1)','https://open.spotify.com.evil.test/album/6vlLonr2byiZjhEHqLpOgT','https://user:secret@open.spotify.com/album/6vlLonr2byiZjhEHqLpOgT','http://open.spotify.com/album/6vlLonr2byiZjhEHqLpOgT','https://music.apple.com/us/artist/nathalie/1223241299'])expect(musicEmbed(url)).toBeUndefined();
 expect(musicIdentity('https://music.apple.com/ca/album/souvenir-latino/1268832661')).toBe(musicIdentity('https://music.apple.com/us/album/souvenir-latino/1268832661'));
});

test('album chooser shows every official Quinto platform, loads only on selection and stops when closed',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 const embeds:string[]=[];
 await page.route('https://open.spotify.com/embed/**',route=>{embeds.push(route.request().url());return route.fulfill({contentType:'text/html',body:'<html><button>Play</button><ol><li>Bésame Mucho</li><li>Esclavo y Amo</li></ol></html>'});});
 await page.goto('/es/#music');const trigger=page.locator('.release-feature [data-listen]');await trigger.click();
 const dialog=page.locator('#music-modal'),panel=dialog.locator('[data-listening-panel="quinto-elemento-tierra"]');
 await expect(dialog).toBeVisible();await expect(panel).toBeVisible();await expect(page).toHaveURL(/#listen-quinto-elemento-tierra$/);
 await expect(panel.locator('.music-service')).toHaveCount(6);await expect(panel.locator('.music-download a')).toHaveCount(1);
 for(const name of ['Spotify','Apple Music','YouTube','Deezer','Amazon Music','TIDAL','iTunes'])await expect(panel).toContainText(name);
 await expect(panel.locator('.music-tracklist li')).toHaveCount(5);await expect(panel).toContainText('Secreto de Amor');await expect(panel).toContainText('3:24');
 expect(embeds).toEqual([]);await expect(dialog.locator('iframe')).toHaveCount(0);
 await panel.locator('[data-music-service=spotify]').click();await expect(dialog.locator('iframe')).toHaveAttribute('src',/\/embed\/album\/6vlLonr2byiZjhEHqLpOgT\?/);
 await expect(dialog.frameLocator('iframe').getByRole('button',{name:'Play',exact:true})).toBeVisible();
 await expect(panel.locator('[data-music-external]')).toHaveAttribute('href','https://open.spotify.com/album/6vlLonr2byiZjhEHqLpOgT');
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(dialog.locator('iframe')).toHaveCount(0);await expect(trigger).toBeFocused();await expect(page).toHaveURL(/#music$/);
});

test('classical, Spirituosi and singles open their own recordings, with player switching and no automatic playback',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('https://open.spotify.com/embed/**',route=>route.fulfill({contentType:'text/html',body:'<html>Spotify player</html>'}));
 await page.route('https://embed.music.apple.com/**',route=>route.fulfill({contentType:'text/html',body:'<html>Apple player</html>'}));
 await page.route('https://widget.deezer.com/**',route=>route.fulfill({contentType:'text/html',body:'<html>Deezer player</html>'}));
 await page.goto('/fr/#repertorio');await page.locator('#repertorio [data-listen=alta-gracia]').click();
 let panel=page.locator('[data-listening-panel=alta-gracia]');await expect(panel.locator('.music-tracklist li')).toHaveCount(9);await panel.locator('[data-music-service=spotify]').click();await expect(panel.locator('iframe')).toHaveAttribute('src',/album\/186pleEY4aQjMXNuA8Z7xZ/);
 await page.keyboard.press('Escape');await page.locator('#spirituosi [data-listen=souvenir-latino]').click();panel=page.locator('[data-listening-panel=souvenir-latino]');await expect(panel.locator('.music-tracklist li')).toHaveCount(17);await panel.locator('[data-music-service=apple]').click();await expect(panel.locator('iframe')).toHaveAttribute('src','https://embed.music.apple.com/ca/album/souvenir-latino/1268832661');
 await panel.locator('[data-music-service=deezer]').click();await expect(page.locator('#music-modal iframe')).toHaveCount(1);await expect(panel.locator('iframe')).toHaveAttribute('src',/album\/45944422$/);await page.keyboard.press('Escape');
 await page.locator('#contemporain [data-listen=esclavo-y-amo]').click();panel=page.locator('[data-listening-panel=esclavo-y-amo]');await expect(panel.locator('.music-tracklist li')).toHaveCount(1);await panel.locator('[data-music-service=spotify]').click();await expect(panel.locator('iframe')).toHaveAttribute('src',/track\/4BE0KqF21ot4HCBzuWR6aA/);await expect(panel.locator('iframe')).toHaveAttribute('height','152');
 expect(await panel.locator('iframe').getAttribute('src')).not.toContain('autoplay=1');await page.keyboard.press('Escape');
 await page.locator('#contemporain [data-listen=sombras-nada-mas]').click();panel=page.locator('[data-listening-panel=sombras-nada-mas]');await panel.locator('[data-music-service=spotify]').click();await expect(panel.locator('iframe')).toHaveAttribute('src',/track\/7g4bOGhlkoNXggEI2EHEKQ/);
});

for(const [lang,width]of [['es',1440],['fr',320],['en',390],['de',390],['it',390],['sv',390],['hu',390],['hr',390],['ru',390],['zh-TW',390],['ja',390]] as const){
 test(`${lang} listening chooser is localized, shareable and usable at ${width}px`,async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width,height:844});
  const thirdParty:string[]=[];page.on('request',request=>{if(new URL(request.url()).origin!==new URL(process.env.TEST_BASE_URL||'http://localhost:4322').origin)thirdParty.push(request.url());});
  await page.goto(`/${lang}/#listen-quinto-elemento-tierra`);const dialog=page.locator('#music-modal'),panel=dialog.locator('[data-listening-panel=quinto-elemento-tierra]');await expect(dialog).toBeVisible();await expect(panel).toBeVisible();await expect(dialog.locator('iframe')).toHaveCount(0);expect(thirdParty).toEqual([]);
  await expect.poll(()=>panel.locator('.music-release-art img').evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true);
  if(!['en','es'].includes(lang)){expect(await panel.locator('.music-release-heading>p').innerText()).not.toContain('Choose your platform');expect(await panel.locator('.music-tracklist h4').innerText()).not.toBe('Track list');}
  if(width===320){await page.route('https://open.spotify.com/embed/**',route=>route.fulfill({contentType:'text/html',body:'<html>Player</html>'}));await panel.locator('[data-music-service=spotify]').click();await expect(panel.locator('iframe')).toHaveAttribute('height','352');expect((await panel.locator('iframe').boundingBox())!.width).toBeGreaterThanOrEqual(280);expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);}
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await panel.locator('[data-listening-switch=nathalie]').click();await expect(dialog.locator('[data-listening-panel=nathalie]')).toBeVisible();await expect(dialog.locator('.music-discography button')).toHaveCount(6);
  await dialog.locator('[data-listening-switch=una-mujer]').click();await expect(dialog.locator('[data-listening-panel=una-mujer] .music-tracklist li')).toHaveCount(9);await expect(page).toHaveURL(/#listen-una-mujer$/);
  await dialog.locator('[data-music-close]').click();await expect(dialog).not.toBeVisible();
 });
}

test('browser Back dismisses the player, Forward restores the chooser without a player',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/es/#collection');await page.locator('#collection [data-listen=una-mujer]').click();await expect(page.locator('#music-modal')).toBeVisible();await page.goBack();await expect(page.locator('#music-modal')).not.toBeVisible();await expect(page).toHaveURL(/#collection$/);await page.goForward();await expect(page.locator('#music-modal')).toBeVisible();await expect(page.locator('#music-modal iframe')).toHaveCount(0);
});

test('external destinations still work without JavaScript and booking links do not enter the listening chooser',async({browser,page})=>{
 const context=await browser.newContext({javaScriptEnabled:false,baseURL:process.env.TEST_BASE_URL||'http://localhost:4322'});const plain=await context.newPage();await plain.goto('/es/#music');await expect(plain.locator('.release-feature [data-listen]')).toHaveAttribute('href','https://orcd.co/quintoelemento');await expect(plain.locator('#music-modal')).not.toBeVisible();await context.close();
 await page.goto('/es/');for(const link of await page.locator('a[href*="tuboleta.com.do"]').all())await expect(link).not.toHaveAttribute('data-listen');
});
