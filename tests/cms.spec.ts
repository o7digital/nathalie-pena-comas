import { test, expect } from '@playwright/test';

test('a newly configured YouTube video opens with consent and an exact safe destination', async ({page}) => {
 await page.route('**/en/', async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replaceAll('otT5_7vJYv4', 'abcdefghijk') });
 });
 await page.goto('/en/');
 await page.locator('.video [data-video="abcdefghijk"]').click();
 await expect(page.locator('#video-modal')).toBeVisible();
 await expect(page.locator('iframe')).toHaveCount(0);
 await expect(page.locator('#video-fallback')).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abcdefghijk');
});

test('CMS data and images require authentication; the build identity cannot edit content', async ({request}) => {
 const url = process.env.PUBLIC_URL;
 const token = process.env.WEBSITE_READ_TOKEN;
 test.skip(url !== 'https://directus-dev-9ae1.up.railway.app' || !token, 'Requires the Nathalie Railway dev environment.');
 expect([401,403]).toContain((await request.get(`${url}/items/gallery`)).status());
 const headers = { Authorization: `Bearer ${token}` };
 const response = await request.get(`${url}/items/gallery?fields=id,image&filter[status][_eq]=published`, {headers});
 expect(response.ok()).toBe(true);
 const rows = (await response.json()).data;
 expect(rows.length).toBeGreaterThan(0);
 expect([401,403]).toContain((await request.get(`${url}/assets/${rows[0].image}`)).status());
 const id = `readonly-probe-${Date.now()}`;
 const mutation = await request.post(`${url}/items/site_texts`, {headers, data: {id, key:'security probe', locale:'en', value:'must not be created', status:'draft'}});
 if (mutation.ok() && process.env.ADMIN_TOKEN) await request.delete(`${url}/items/site_texts/${id}`, {headers:{Authorization:`Bearer ${process.env.ADMIN_TOKEN}`}});
 expect(mutation.status()).toBe(403);
});
