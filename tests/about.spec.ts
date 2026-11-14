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
 'Ebe Stignani', 'Montecatini', 'Osaka', 'Ada Sari', '2014 · 2015 · 2016 · 2018 · 2019 · 2020 · 2021 · 2022 · 2026',
];

for (const [lang,width] of [['es',1440],['en',390],['fr',390],['fr',320],['de',768],['ru',390],['zh-TW',390],['ja',390]] as const) {
 test(`${lang} complete About biography is visible and readable at ${width}px`, async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width,height:900});
  await page.goto(`/${lang}/#about`);
  const about=page.locator('#about');
  await expect(about.locator('[data-biography]')).toHaveCount(6);
  await expect(about.locator('.biography-roles li')).toHaveCount(10);
  await expect(about.locator('[data-biography="international"] .biography-countries li')).toHaveCount(25);
  await expect(about.locator('[data-biography="spirituosi"] .biography-countries li')).toHaveCount(5);
  await expect(about.locator('[data-biography="collaborations"] .biography-names li')).toHaveCount(32);
  const text=await about.innerText();
  for(const fact of facts) {
   // Cities in editorial prose are translated; their international proper names remain in the institution lists.
   if(fact==='Latin Grammy'&&['zh-TW','ja'].includes(lang)) continue;
   if(fact==='Santo Domingo'&&lang!=='es'&&lang!=='en') continue;
   if(fact==='Los Angeles Theater Center'&&lang==='zh-TW') { expect(text).toContain('洛杉磯劇院中心'); continue; }
   if(fact==='Irina Gavrilovici'&&lang==='ru') continue;
   expect(text).toContain(fact);
  }
  if(lang==='fr') {
   await expect(about).toContainText('Formation et vocation');
   await expect(about).toContainText('Saint-Domingue');
   await expect(about).toContainText('deuxième prix');
   await expect(about).toContainText('composition polonaise');
   expect(text).not.toContain('Her acting debut');
  }
  // All details are available without opening panels or loading another page.
  await expect(about.locator('details,[hidden]')).toHaveCount(0);
  await about.locator('[data-biography="awards"]').scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const awards=await about.locator('[data-biography="awards"]').boundingBox();
  const photo=await about.locator('.story-visual').boundingBox();
  expect(photo!.y+photo!.height).toBeLessThan(awards!.y);
 });
}

test('the full biography remains readable without JavaScript',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false,baseURL:process.env.TEST_BASE_URL||'http://localhost:4322'});
 const page=await context.newPage();await page.goto('/fr/#about');
 await expect(page.locator('#about [data-biography]')).toHaveCount(6);
 await expect(page.locator('#about')).toContainText('Joyce DiDonato');
 await expect(page.locator('#about')).toContainText('Manfred Wagner-Artzt');
 await expect(page.locator('#about')).toContainText('Osaka');
 await context.close();
});
