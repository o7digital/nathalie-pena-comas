import {test,expect,type Page} from '@playwright/test';
test.beforeEach(async({page})=>{await page.emulateMedia({reducedMotion:'reduce'});});
async function ready(page:Page,available=true){await page.route('**/api/nath-ai/health',route=>route.fulfill({status:available?200:503,json:{available,version:'3.6.0'}}));}
for(const width of [390,1440])test(`Nath AI floats with a shadow and a real green presence at ${width}px`,async({page})=>{
 await ready(page);await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/fr/#about');
 const launcher=page.locator('.olivia-launcher');await expect(launcher).toContainText('Nath AI');await expect(launcher.locator('[data-presence]')).toHaveAttribute('data-presence','online');
 expect(await launcher.evaluate(el=>getComputedStyle(el).animationName)).toBe('nath-launcher-float');
 expect(await launcher.evaluate(el=>getComputedStyle(el).boxShadow)).not.toBe('none');
 expect(await launcher.locator('.olivia-presence-dot').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(34, 197, 94)');
 const a=await launcher.boundingBox();await page.waitForTimeout(1000);const b=await launcher.boundingBox();expect(Math.abs(a!.y-b!.y)).toBeGreaterThan(.1);
 await launcher.click({force:true});const dialog=page.locator('#olivia-dialog');await expect(dialog).toBeVisible();await expect(dialog.locator('[data-presence-label]')).toHaveText('En ligne');
 await expect(page.locator('#olivia-title')).toHaveText('Nath AI');expect(await dialog.evaluate(el=>getComputedStyle(el).animationName)).toBe('nath-panel-float');
 const box=await dialog.boundingBox();expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width);expect(box!.y+box!.height).toBeLessThanOrEqual(900);
 await page.screenshot({path:`test-results/nath-ai-${width}.png`});await page.keyboard.press('Escape');await expect(launcher).toBeFocused();
});
test('reduced motion keeps the shadow and presence without motion',async({page})=>{
 await ready(page);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/es/#about');const launcher=page.locator('.olivia-launcher');await expect(launcher.locator('[data-presence]')).toHaveAttribute('data-presence','online');
 expect(await launcher.evaluate(el=>getComputedStyle(el).animationName)).toBe('none');await launcher.click();expect(await page.locator('#olivia-dialog').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});
test('a failed backend never claims to be online',async({page})=>{
 await ready(page,false);await page.goto('/fr/#about');await expect(page.locator('.olivia-launcher [data-presence-label]')).toHaveText('Indisponible');await expect(page.locator('.olivia-launcher [data-presence]')).toHaveAttribute('data-presence','offline');
});
test('the typing animation appears only while a real request is pending',async({page})=>{
 await ready(page);await page.route('**/api/nath-ai/identity',r=>r.fulfill({json:{clientCode:'nathalie',version:'3.6.0',identity:'fixture'}}));
 await page.route('**/api/nath-ai/conversations',r=>r.fulfill({json:{conversation:{status:'ai'}}}));
 let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
 await page.route('**/api/nath-ai/chat',async route=>{await gate;await route.fulfill({json:{clientCode:'nathalie',version:'3.6.0',reply:'Bonjour, je suis Nath AI.',language:'fr',model:'fixture'}});});
 await page.goto('/fr/#about');await page.locator('[data-olivia-open]').click();await page.locator('[data-olivia-consent]').check();await page.locator('#olivia-message').fill('Bonjour');await page.locator('[data-olivia-form] [type=submit]').click();await expect(page.locator('[data-olivia-typing]')).toBeVisible();release();await expect(page.locator('[data-olivia-typing]')).toBeHidden();
});
