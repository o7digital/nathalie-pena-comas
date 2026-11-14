import { test, expect, type Page } from '@playwright/test';

async function mockYouTube(page: Page, autoplay = true) {
 await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({ contentType:'text/html', body:'<html style="background:#151515"><body style="color:white">Ave Maria</body></html>' }));
 await page.route('https://www.youtube.com/iframe_api', route => route.fulfill({ contentType:'text/javascript', body:`
 window.YT = { Player: class {
  constructor(frame, { events }) {
   this.frame = frame; this.events = events; this.state = -1;
   window.heroVideoTest = { state: n => this.update(n), error: () => events.onError(), blocked: () => events.onAutoplayBlocked(), pauses: 0 };
   queueMicrotask(() => events.onReady({ target:this }));
  }
  update(n) { this.state = n; this.events.onStateChange({ data:n }); }
  mute() { this.frame.dataset.muted = 'true'; }
  playVideo() { if (${autoplay} && this.state !== 1) { this.state = 1; queueMicrotask(() => this.events.onStateChange({ data:1 })); } }
  pauseVideo() { window.heroVideoTest.pauses++; if (this.state === 1) { this.state = 2; queueMicrotask(() => this.events.onStateChange({ data:2 })); } }
  destroy() { this.frame.remove(); }
 } };
 window.onYouTubeIframeAPIReady();
 ` }));
}

async function freezeClock(page: Page) {
 const now = new Date();
 await page.clock.install({ time:now });
 await page.clock.pauseAt(now);
}

function signal(page: Page, event: 'error' | 'blocked') {
 return page.evaluate(event => (window as unknown as { heroVideoTest: { error():void; blocked():void } }).heroVideoTest[event](), event);
}

function state(page: Page, value: number) {
 return page.evaluate(value => (window as unknown as { heroVideoTest: { state(value:number):void } }).heroVideoTest.state(value), value);
}

test('silent intro plays once for eighteen seconds, then portrait and album alternate every five seconds', async ({ page }) => {
 await mockYouTube(page);
 await freezeClock(page);
 await page.goto('/es/');
 await expect(page.locator('.signature-hero')).toHaveClass(/is-video-intro/);
 const frame = page.locator('[data-hero-player] iframe');
 await expect(frame).toHaveAttribute('src', /kglZQlwuAqU\?autoplay=1&mute=1&playsinline=1/);
 await expect(frame).toHaveAttribute('data-muted', 'true');
 await expect(page.locator('.hero-biography')).toContainText('Alta Gracia');
 await page.clock.fastForward(17900);
 await expect(page.locator('[data-hero-video]')).toHaveClass(/is-active/);
 await page.clock.fastForward(100);
 await expect(page.locator('.signature-hero')).not.toHaveClass(/is-video-intro/);
 const slides = page.locator('[data-hero-slide]');
 await expect(slides.nth(0)).toHaveClass(/is-active/);
 await page.clock.fastForward(5000);
 await expect(frame).toHaveCount(0);
 await expect(slides.nth(1)).toHaveClass(/is-active/);
 await expect(slides.nth(1).locator('a')).toHaveAttribute('href', 'https://orcd.co/quintoelemento');
 await page.clock.fastForward(5000);
 await expect(slides.nth(0)).toHaveClass(/is-active/);
 await page.locator('[data-hero-pause]').click();
 await page.locator('[data-hero-pause]').blur();
 await page.clock.fastForward(10000);
 await expect(slides.nth(0)).toHaveClass(/is-active/);
 await page.locator('[data-hero-select="1"]').click();
 await expect(slides.nth(1)).toHaveAttribute('aria-hidden', 'false');
 await expect(slides.nth(0)).toHaveAttribute('inert', '');
});

test('intro can be paused, skipped with keyboard focus retained, and replayed', async ({ page }) => {
 await mockYouTube(page);
 await freezeClock(page);
 await page.goto('/fr/');
 await expect(page.locator('[data-hero-video]')).toHaveClass(/is-active/);
 await page.locator('[data-hero-pause]').click();
 await page.clock.fastForward(20000);
 await expect(page.locator('[data-hero-video]')).toHaveClass(/is-active/);
 await page.locator('[data-hero-pause]').click();
 await page.clock.fastForward(1000);
 await page.locator('[data-hero-skip]').click();
 await expect(page.locator('[data-hero-select="0"]')).toBeFocused();
 await expect(page.locator('[data-hero-skip]')).toBeHidden();
 await page.clock.fastForward(1000);
 await page.locator('[data-hero-replay]').click();
 await expect(page.locator('[data-hero-video]')).toHaveClass(/is-active/);
 await expect(page.locator('[data-hero-player] iframe')).toHaveCount(1);
});

test('the intro pauses during the complete video dialog and full playback still requires confirmation', async ({ page }) => {
 await mockYouTube(page);
 await freezeClock(page);
 await page.goto('/en/');
 await expect(page.locator('[data-hero-video]')).toHaveClass(/is-active/);
 await page.clock.fastForward(5000);
 await page.locator('.hero [data-video]').click();
 await expect(page.locator('#video-fallback')).toHaveAttribute('href', 'https://www.youtube.com/watch?v=kglZQlwuAqU');
 await expect(page.locator('#video-container iframe')).toHaveCount(0);
 await page.clock.fastForward(20000);
 await expect(page.locator('[data-hero-video]')).toHaveClass(/is-active/);
 await page.locator('#load-video').click();
 await expect(page.locator('#video-container iframe')).toHaveAttribute('src', /kglZQlwuAqU\?autoplay=1&rel=0$/);
 await page.keyboard.press('Escape');
 await page.clock.fastForward(13000);
 await expect(page.locator('[data-hero-slide]').nth(0)).toHaveClass(/is-active/);
});

test('buffering and a hidden tab do not consume the eighteen seconds of playback', async ({ page }) => {
 await mockYouTube(page);
 await freezeClock(page);
 await page.goto('/en/');
 await expect(page.locator('[data-hero-video]')).toHaveClass(/is-active/);
 await page.clock.fastForward(5000);
 await state(page, 3);
 await page.clock.fastForward(4000);
 await state(page, 1);
 await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', {configurable:true,value:true});
  document.dispatchEvent(new Event('visibilitychange'));
 });
 await page.clock.fastForward(20000);
 await expect(page.locator('[data-hero-video]')).toHaveClass(/is-active/);
 await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', {configurable:true,value:false});
  document.dispatchEvent(new Event('visibilitychange'));
 });
 await page.clock.fastForward(12900);
 await expect(page.locator('[data-hero-video]')).toHaveClass(/is-active/);
 await page.clock.fastForward(100);
 await expect(page.locator('[data-hero-slide]').nth(0)).toHaveClass(/is-active/);
});

for (const failure of ['error','blocked','timeout'] as const) {
 test(`YouTube ${failure} falls back to the photo slideshow`, async ({ page }) => {
  await mockYouTube(page, failure !== 'timeout');
  await freezeClock(page);
  await page.goto('/en/');
  await expect(page.locator('[data-hero-player] iframe')).toHaveCount(1);
  if (failure === 'timeout') await page.clock.fastForward(8000);
  else {
   await expect(page.locator('[data-hero-video]')).toHaveClass(/is-active/);
   await signal(page, failure);
  }
  await expect(page.locator('[data-hero-slide]').nth(0)).toHaveClass(/is-active/);
  await page.clock.fastForward(5000);
  await expect(page.locator('[data-hero-slide]').nth(1)).toHaveClass(/is-active/);
  await expect(page.locator('[data-hero-player] iframe')).toHaveCount(0);
 });
}

test('a blocked API keeps the intro screen until the fallback after eight seconds', async ({ page }) => {
 await page.route('https://www.youtube.com/iframe_api', route => route.fulfill({contentType:'text/javascript',body:''}));
 await freezeClock(page);
 await page.goto('/en/');
 await expect(page.locator('[data-hero-slide]').nth(0)).not.toHaveClass(/is-active/);
 await expect(page.locator('.hero-inner')).toBeHidden();
 await page.clock.fastForward(8000);
 await expect(page.locator('[data-hero-slide]').nth(0)).toHaveClass(/is-active/);
 await expect(page.locator('[data-hero-skip]')).toBeHidden();
 await page.clock.fastForward(5000);
 await expect(page.locator('[data-hero-slide]').nth(1)).toHaveClass(/is-active/);
});

for (const reason of ['reduced motion','save data','section link'] as const) {
 test(`home skips automatic YouTube loading for ${reason}`, async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (/youtube/.test(request.url())) requests.push(request.url()); });
  if (reason === 'reduced motion') await page.emulateMedia({ reducedMotion:'reduce' });
  if (reason === 'save data') await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value:{saveData:true} }));
  await freezeClock(page);
  await page.goto(`/fr/${reason === 'section link' ? '#about' : ''}`);
  await page.clock.fastForward(10000);
  expect(requests).toEqual([]);
  await expect(page.locator('[data-hero-player] iframe')).toHaveCount(0);
  if (reason === 'reduced motion') {
   await expect(page.locator('[data-hero-pause]')).toHaveAttribute('aria-pressed', 'true');
   await expect(page.locator('[data-hero-slide]').nth(0)).toHaveClass(/is-active/);
  }
  await page.locator('[data-hero-select="1"]').click();
  await expect(page.locator('[data-hero-slide]').nth(1)).toHaveClass(/is-active/);
 });
}

for (const [width,height] of [[390,844],[768,900],[1024,900],[1440,900],[844,390],[1920,1080]]) {
 test(`film fills the entire ${width}×${height} viewport and keeps controls visible`, async ({ page }) => {
  await mockYouTube(page);
  await page.setViewportSize({width,height});
  await freezeClock(page);
  await page.goto('/fr/');
  await expect(page.locator('.signature-hero')).toHaveClass(/is-video-intro/);
  await page.clock.runFor(1000);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const hero = await page.locator('.signature-hero').boundingBox();
  const stage = await page.locator('[data-hero-player]').boundingBox();
  const frame = await page.locator('[data-hero-player] iframe').boundingBox();
  const skip = await page.locator('[data-hero-skip]').boundingBox();
  const controls = await page.locator('.hero-slider-controls').boundingBox();
  const caption = await page.locator('.hero-video-caption').boundingBox();
  expect(hero).toEqual({x:0,y:0,width,height});
  expect(stage).toEqual(hero);
  expect(frame!.x).toBeLessThanOrEqual(0);
  expect(frame!.y).toBeLessThanOrEqual(0);
  expect(frame!.x + frame!.width).toBeGreaterThanOrEqual(width - 1);
  expect(frame!.y + frame!.height).toBeGreaterThanOrEqual(height - 1);
  expect(frame!.width / frame!.height).toBeCloseTo(16 / 9, 4);
  expect(skip!.x + skip!.width).toBeLessThanOrEqual(controls!.x);
  expect(controls!.y + controls!.height).toBeLessThanOrEqual(height);
  expect(caption!.y).toBeGreaterThanOrEqual(0);
  expect(caption!.y + caption!.height).toBeLessThan(skip!.y);
  await expect(page.locator('.hero-inner')).toBeHidden();
  await expect(page.locator('#site-header')).toBeHidden();
  await expect(page.locator('[data-hero-select="0"]')).toBeHidden();
  await expect(page.locator('.hero [data-video]')).toBeVisible();
  const assistant = await page.locator('.olivia-launcher').boundingBox();
  expect(skip!.x + skip!.width).toBeLessThan(assistant!.x);
  expect(controls!.y + controls!.height).toBeLessThan(assistant!.y);
  await page.screenshot({path:`test-results/hero-film-${width}-${height}.png`});
  // Resizing (including device rotation) must preserve the full-screen cover.
  await page.setViewportSize({width:height,height:width});
  expect(await page.locator('[data-hero-player]').boundingBox()).toEqual({x:0,y:0,width:height,height:width});
 });
}

test('the first paint reserves the film before the application script or YouTube loads', async ({ page }) => {
 let releaseScripts!: () => void;
 const scriptsReady = new Promise<void>(resolve => { releaseScripts = resolve; });
 await page.route('**/_astro/*.js', async route => { await scriptsReady; await route.continue(); });
 await page.route('https://www.youtube.com/iframe_api', route => route.fulfill({contentType:'text/javascript',body:''}));
 await page.setViewportSize({width:390,height:844});
 await page.goto('/en/', {waitUntil:'commit'});
 try {
  await expect(page.locator('.hero-video-caption')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-hero-intro', 'true');
  await expect(page.locator('[data-hero-slide]').nth(0)).toBeHidden();
  await expect(page.locator('.hero-inner')).toBeHidden();
  expect(await page.locator('[data-hero-player]').boundingBox()).toEqual({x:0,y:0,width:390,height:844});
 } finally { releaseScripts(); }
 await expect(page.locator('.signature-hero')).toHaveClass(/is-video-intro/);
 await expect(page.locator('[data-hero-slide]').nth(0)).toBeHidden();
 await page.locator('[data-hero-skip]').click();
 await expect(page.locator('html')).not.toHaveAttribute('data-hero-intro');
 await expect(page.locator('#site-header')).toBeVisible();
 await expect(page.locator('.hero-inner')).toBeVisible();
});
