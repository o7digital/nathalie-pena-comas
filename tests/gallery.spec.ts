import {test,expect} from '@playwright/test';
for(const lang of ['es','en'])for(const width of [390,1440]){
 test(`${lang} gallery carousel and lightbox at ${width}px`,async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width,height:900});await page.goto(`/${lang}/#gallery`);
  await expect(page.locator('[data-gallery-pause]')).toBeDisabled();
  await page.locator('[data-gallery-next]').click();await expect(page.locator('[data-gallery-count]')).toHaveText('02 / 03');
  await page.locator('[data-gallery-prev]').click();await expect(page.locator('[data-gallery-count]')).toHaveText('01 / 03');
  await page.locator('#gallery-track').focus();await page.keyboard.press('ArrowLeft');await expect(page.locator('[data-gallery-count]')).toHaveText('03 / 03');
  await page.keyboard.press('ArrowRight');await expect(page.locator('[data-gallery-count]')).toHaveText('01 / 03');
  const photos=page.locator('[data-gallery-photo]');
  for(let i=0;i<3;i++){
   const trigger=photos.nth(i);await trigger.click();
   await expect(page.locator('#gallery-lightbox')).toBeVisible();
   await expect(page.locator('[data-gallery-image] img')).toHaveAttribute('src',await trigger.evaluate((a:HTMLAnchorElement)=>a.href));
   await expect.poll(()=>page.locator('[data-gallery-image] img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
   await expect(page.locator('#gallery-lightbox-caption')).toContainText(await trigger.getAttribute('data-credit')||'');
   await expect(page.locator('[data-lightbox-count]')).toHaveText(`0${i+1} / 03`);
   expect(await page.evaluate(()=>document.body.style.overflow)).toBe('hidden');
   await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('#gallery-lightbox'))).toBe(true);
   await page.locator('[data-lightbox-next]').click();await expect(page.locator('[data-lightbox-count]')).toHaveText(`0${(i+1)%3+1} / 03`);
   await page.keyboard.press('ArrowLeft');await expect(page.locator('[data-lightbox-count]')).toHaveText(`0${i+1} / 03`);
   if(i===1)await page.locator('[data-gallery-close]').click();else await page.keyboard.press('Escape');
   await expect(page.locator('#gallery-lightbox')).not.toBeVisible();await expect(trigger).toBeFocused();
   await expect(page.locator('[data-gallery-image] img')).toHaveCount(0);expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
test('gallery autoplay keeps moving on hover and focus, and respects pause and reduced motion',async({page})=>{
 test.setTimeout(45000);
 await page.goto('/en/#gallery');await page.locator('#gallery-track').scrollIntoViewIfNeeded();await page.mouse.move(0,0);
 const count=page.locator('[data-gallery-count]');
 await expect(count).toHaveText('02 / 03',{timeout:8000});
 // Wait until smooth scrolling has actually reached the second image.
 await expect.poll(()=>page.locator('#gallery-track').evaluate(el=>Math.abs(el.querySelectorAll('figure:not([data-gallery-clone])')[1].getBoundingClientRect().left-el.getBoundingClientRect().left))).toBeLessThan(3);
 await page.locator('#gallery-track').hover();await page.locator('#gallery-track').focus();
 await expect(count).toHaveText('03 / 03',{timeout:5000});
 await expect.poll(()=>page.locator('#gallery-track').evaluate(el=>Math.abs(el.querySelectorAll('figure:not([data-gallery-clone])')[2].getBoundingClientRect().left-el.getBoundingClientRect().left))).toBeLessThan(3);
 await page.locator('[data-gallery-pause]').click();await expect(page.locator('[data-gallery-pause]')).toHaveAttribute('aria-pressed','true');
 await page.mouse.move(0,0);await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();});await page.locator('#gallery-track').scrollIntoViewIfNeeded();await page.waitForTimeout(3500);await expect(count).toHaveText('03 / 03');
 await page.locator('[data-gallery-pause]').click();await page.mouse.move(0,0);await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();});await page.locator('#gallery-track').scrollIntoViewIfNeeded();
 await expect(count).toHaveText('01 / 03',{timeout:5000});
 await expect.poll(()=>page.locator('#gallery-track').evaluate(el=>Math.abs(el.querySelectorAll('figure:not([data-gallery-clone])')[0].getBoundingClientRect().left-el.getBoundingClientRect().left))).toBeLessThan(3);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('[data-gallery-pause]')).toBeDisabled();await page.waitForTimeout(3500);await expect(count).toHaveText('01 / 03');
});

for(const width of [390,1440])test(`gallery wraps forward seamlessly at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/es/#gallery');
 await page.locator('#gallery-track').scrollIntoViewIfNeeded();
 await page.locator('[data-gallery-pause]').click();
 const next=page.locator('[data-gallery-next]');
 for(let cycle=0;cycle<2;cycle++)for(const label of ['02 / 03','03 / 03','01 / 03']){
  const before=await page.locator('#gallery-track').evaluate(el=>el.scrollLeft);
  const positions:number[]=[];
  await page.exposeFunction(`record${cycle}${label.slice(0,2)}`, (x:number)=>positions.push(x));
  const name=`record${cycle}${label.slice(0,2)}`;
  await page.locator('#gallery-track').evaluate((el,name)=>{
   const record=()=>{(window as any)[name](el.scrollLeft);};
   el.addEventListener('scroll',record);setTimeout(()=>el.removeEventListener('scroll',record),1000);
  },name);
  await next.click();await expect(page.locator('[data-gallery-count]')).toHaveText(label);
  await page.waitForTimeout(1100);
  // The animated part advances right, including the transition from the last to first photo.
  expect(positions.some(x=>x>before+20)).toBe(true);
  const index=Number(label.slice(0,2))-1;
  await expect.poll(()=>page.locator('#gallery-track').evaluate((el,index)=>Math.abs(el.querySelectorAll('figure:not([data-gallery-clone])')[index].getBoundingClientRect().left-el.getBoundingClientRect().left),index)).toBeLessThan(3);
 }
});
