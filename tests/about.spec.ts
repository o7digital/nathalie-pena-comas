import { test, expect } from '@playwright/test';

const facts = [
 'Latin Grammy', 'Santo Domingo', '2019',
 'Helena Lazarska', 'Annamaria Rott', 'Manfred Wagner-Artzt', 'Mariella Devia', 'Michael Recchiuti', 'Kamal Khan', 'Irina Gavrilovici', '2018',
 'Zerlina', 'Donna Anna', 'Pamina', 'Lucia', 'Queen of trolls', 'Gabi', 'Musetta', 'Contessa', 'Micaëla', 'Violetta',
 'Nightingale', 'Ghost Waltz', 'Los Angeles Theater Center', '2023', '64',
 'Emilia Romagna Festival', 'Montecatini Opera Festival', 'Taranto Opera Festival', 'Wiener Festwochen', 'Vienna Opera Summer Festival', 'Sommerfestival Kittsee', 'Kültür Yolu Festivali', 'IMAGO Sloveniae',
 'Musikverein', 'Konzerthaus', 'Santa Cecilia', 'Santa Maria Maggiore', 'Miguel Delibes', 'Tchaikovsky', 'CSO ADA Ankara', 'National Concert Hall Taipei', 'Gran Teatro Nacional', 'Palacio de Bellas Artes', 'Eduardo Brito',
 'Russian State Philharmonic', 'Vienna Chamber Orchestra', 'Vienna Concert–Verein', 'Strauss Festival', 'Taiwan Philharmonic', 'Radio Symphony Orchestra of Belarus', 'Târgu Mures', 'Györ Philharmonic', 'National Symphony Orchestra of Peru', 'National Symphony Orchestra of the Dominican Republic',
 'Eugene Kohn', 'Valery Polyansky', 'Martin Sieghart', 'José Antonio Molina', 'Francisco Navarro Lara', 'Yao-Yu Wu', 'Ernst Kovacic', 'Joji Hattori', 'Ola Rudner', 'Ferenc Gábor', 'Harald Krumpöck',
 'Andrea Bocelli', 'KS Ramón Vargas', 'Gregory Kunde', 'Joyce DiDonato', 'Aquiles Machado', 'Stephen Costello', 'Morris Robinson', 'Tuomas Katajala', 'Johnny Ventura', 'Danny Rivera', 'Plácido Domingo Jr.',
 'Souvenir Latino', 'Global Music Awards', 'BBC Radio 3', '2015', 'Rai 3', 'Belarusian Broadcasting Company', 'Slovenian National Radio', 'Dominican State Radio and Television Corporation',
 'Ebe Stignani', 'Montecatini', 'Osaka', 'Ada Sari', '2014', '2015', '2016', '2020', '2021', '2022', '2026',
];

for (const [lang,width] of [['es',1440],['en',390],['fr',390],['fr',320],['de',768],['ru',390],['zh-TW',390],['ja',390]] as const) {
 test(`${lang} complete About biography is visible and readable at ${width}px`, async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width,height:900});
  await page.goto(`/${lang}/#about`);
  const about=page.locator('#about');
  await expect(about.locator('.story-visual img')).toHaveCount(1);
  await expect(about.locator('.biography-portrait')).toHaveCount(0);
  await expect(about.locator('.biography-prose>p')).toHaveCount(12);
  await expect(about.locator('.biography-prose>p:visible')).toHaveCount(12);
  await expect(about.locator('[role=tab],.biography-index,.biography-chapter')).toHaveCount(0);
  const text=await about.textContent()??'';
  for(const fact of facts) {
   // Cities in editorial prose are translated; their international proper names remain in the institution lists.
   if(fact==='Latin Grammy'&&['zh-TW','ja'].includes(lang)) continue;
   if(fact==='Santo Domingo'&&lang!=='es'&&lang!=='en') continue;
   if(fact==='Los Angeles Theater Center'&&lang==='zh-TW') { expect(text).toContain('洛杉磯劇院中心'); continue; }
   if(fact==='Irina Gavrilovici'&&lang==='ru') continue;
   expect(text).toContain(fact);
  }
  if(lang==='fr') {
   await expect(about).toContainText('Saint-Domingue');
   await expect(about).toContainText('deuxième prix');
   await expect(about).toContainText('composition polonaise');
   expect(text).not.toContain('Her acting debut');
  }
  if(width===1440) {
   const reading=await about.locator('.biography-prose').boundingBox();
   expect(reading!.width).toBeGreaterThan(600);
   expect(reading!.width).toBeLessThan(880);
  }
  for(const paragraph of await about.locator('.biography-prose>p').all()) {
   expect(await paragraph.evaluate(el=>Number.parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}

test('the full biography remains readable without JavaScript',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false,baseURL:process.env.TEST_BASE_URL||'http://localhost:4322'});
 const page=await context.newPage();await page.goto('/fr/#about');
 await expect(page.locator('#about .biography-prose>p')).toHaveCount(12);
 await expect(page.locator('#about')).toContainText('Joyce DiDonato');
 await expect(page.locator('#about')).toContainText('Manfred Wagner-Artzt');
 await expect(page.locator('#about')).toContainText('Osaka');
 await expect(page.locator('#about .biography-prose>p:visible')).toHaveCount(12);
 await context.close();
});

test('biography passages remain directly addressable without hiding the surrounding text',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const id of ['about-stage','about-collaborations','about-training']) {
  await page.goto(`/fr/#${id}`);
  await expect(page.locator(`#${id}`)).toBeVisible();
  await expect(page.locator('#about .biography-prose>p:visible')).toHaveCount(12);
  await expect(page.locator('#about [role=tab]')).toHaveCount(0);
 }
});

for(const lang of ['es','en','fr','de','it','sv','hu','hr','ru','zh-TW','ja']) {
 test(`${lang} PDF edition retains the full CV and opens the print dialog`,async({page})=>{
  await page.addInitScript(()=>{
   (window as unknown as Window & {printCount:number}).printCount=0;
   window.print=()=>{(window as unknown as Window & {printCount:number}).printCount++;};
  });
  await page.goto(`/${lang}/cv/?print`);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect.poll(()=>page.evaluate(()=>(window as unknown as Window & {printCount:number}).printCount)).toBe(1);
  await expect(page.locator('[data-biography]')).toHaveCount(6);
  for(const fact of ['Helena Lazarska','Violetta','Souvenir Latino','Andrea Bocelli','Osaka'])await expect(page.locator('main')).toContainText(fact);
  await expect(page.locator('iframe,.olivia-widget,#site-header,dialog')).toHaveCount(0);
  await page.locator('[data-print-cv]').click();
  await expect.poll(()=>page.evaluate(()=>(window as unknown as Window & {printCount:number}).printCount)).toBe(2);
  await page.emulateMedia({media:'print'});
  await expect(page.locator('.story-actions')).toBeHidden();
  await expect(page.locator('.biography-index')).toBeHidden();
  await expect(page.locator('.cv-return')).toBeHidden();
  for(const chapter of await page.locator('[data-biography]').all())await expect(chapter).toBeVisible();
 });
}

test('French PDF button opens its localized print edition and the return link works',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/fr/#about');
 const exportLink=page.locator('#about .cv-button');
 await expect(exportLink).toHaveText('Enregistrer le CV en PDF');
 await expect(exportLink).toHaveAttribute('href','/fr/cv/?print');
 await page.context().addInitScript(()=>{window.print=()=>{};});
 const [cv]=await Promise.all([page.waitForEvent('popup'),exportLink.click()]);
 await cv.waitForLoadState();
 await expect(cv).toHaveURL(/\/fr\/cv\/\?print$/);
 await expect(cv.locator('[data-print-cv]')).toHaveText('Enregistrer le CV en PDF');
 await cv.locator('.cv-return').click();
 await expect(cv).toHaveURL(/\/fr\/#about$/);
});

test('the print edition works as a readable document without JavaScript',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false,baseURL:process.env.TEST_BASE_URL||'http://localhost:4322'});
 const page=await context.newPage();
 await page.goto('/fr/cv/');
 await expect(page.locator('[data-biography]')).toHaveCount(6);
 await expect(page.locator('main')).toContainText('Joyce DiDonato');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await context.close();
});
