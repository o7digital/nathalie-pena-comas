import {test,expect} from '@playwright/test';
import {browserMediaFixture} from '../cms/studio/browser-media-fixture.mjs';

for(const width of [390,1440])test(`uploaded video plays only after confirmation and closes cleanly at ${width}px`,async({page,browser})=>{
 const fixture=await browserMediaFixture(browser),path='/site-videos/studio-qa/00000000-0000-4000-a000-000000000001';let mediaRequests=0;
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/en/',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('data-video="pG7lJPLcO-g"',`data-native-video="${path}"`)});});
 await page.route('**'+path,route=>{mediaRequests++;return route.fulfill({contentType:'video/webm',body:fixture.video,headers:{'Accept-Ranges':'bytes'}});});
 await page.goto('/en/');const trigger=page.locator('[data-native-video]');await trigger.click();
 await expect(page.locator('#video-modal')).toBeVisible();await expect(page.locator('#video-container video, #video-container iframe')).toHaveCount(0);expect(mediaRequests).toBe(0);await expect(page.locator('#video-external-notice')).toBeHidden();
 await expect(page.locator('#video-fallback')).toHaveAttribute('href',new RegExp(path+'$'));
 await page.locator('#load-video').click();await expect(page.locator('#video-container video')).toHaveCount(1);await expect.poll(()=>page.locator('#video-container video').evaluate((video:HTMLVideoElement)=>video.readyState)).toBeGreaterThanOrEqual(2);
 await expect(page.locator('#video-container iframe')).toHaveCount(0);expect(mediaRequests).toBeGreaterThan(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('#video-modal')).toBeHidden();await expect(page.locator('#video-container video')).toHaveCount(0);await expect(trigger).toBeFocused();
 await page.locator('.video [data-video="NrGZajhOGAc"]').click();await expect(page.locator('#video-external-notice')).toBeVisible();await expect(page.locator('#video-fallback')).toHaveAttribute('href','https://www.youtube.com/watch?v=NrGZajhOGAc');
});
