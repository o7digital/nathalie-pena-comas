import { test, expect } from '@playwright/test';

test('home alternates portrait and album every five seconds and supports pause and selection', async ({ page }) => {
 const now = new Date();
 await page.clock.install({ time: now });
 await page.clock.pauseAt(now);
 await page.goto('/es/');
 await expect(page.locator('.hero-biography')).toContainText('Alta Gracia');
 const slides = page.locator('[data-hero-slide]');
 await expect(slides.nth(0)).toHaveClass(/is-active/);
 await page.clock.fastForward(4900);
 await expect(slides.nth(0)).toHaveClass(/is-active/);
 await page.clock.fastForward(100);
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

test('home keeps manual slides available with reduced motion', async ({ page }) => {
 await page.emulateMedia({ reducedMotion: 'reduce' });
 const now = new Date();
 await page.clock.install({ time: now });
 await page.clock.pauseAt(now);
 await page.goto('/fr/');
 await page.clock.fastForward(10000);
 await expect(page.locator('[data-hero-slide]').nth(0)).toHaveClass(/is-active/);
 await expect(page.locator('[data-hero-pause]')).toHaveAttribute('aria-pressed', 'true');
 await page.locator('[data-hero-select="1"]').click();
 await expect(page.locator('[data-hero-slide]').nth(1)).toHaveClass(/is-active/);
});
