import {test,expect} from '@playwright/test';
import official from '../cms/schedule-official-2026-11-08.json' with {type:'json'};
test.use({javaScriptEnabled:false});

for(const lang of ['es','en'] as const)for(const width of [390,1440]){
 test(`${lang} official agenda follows the hero and works without JavaScript at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:950});await page.goto(`/${lang}/`);
  const order=await page.locator('main>section').evaluateAll(rows=>rows.slice(0,3).map(row=>row.id));
  expect(order).toEqual(['home','schedule','about']);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const upcoming=official.events.filter(row=>row.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
  const agenda=page.locator('#schedule'),rows=agenda.locator('.concert');
  expect(await rows.evaluateAll(items=>items.map(row=>row.getAttribute('data-concert-date')))).toEqual(upcoming.map(row=>row.date));
  await expect(agenda.locator('>.concert-list>.concert')).toHaveCount(Math.min(4,upcoming.length));
  if(upcoming.length>4){
   const more=agenda.locator('.concert-more');await expect(more).not.toHaveAttribute('open','');await more.locator('summary').click();await expect(more).toHaveAttribute('open','');
   await expect(rows.filter({visible:true})).toHaveCount(upcoming.length);
   await expect(agenda.locator('[data-concert-date="2026-12-20"] .concert-ticket-note')).toContainText(lang==='es'?'Entrada libre':'Free admission');
   await expect(agenda.locator('[data-concert-date="2026-12-20"] .concert-tickets a')).toHaveCount(0);
   await expect(agenda.locator('[data-concert-date="2027-04-07"] .concert-ticket-note')).toContainText(lang==='es'?'Entradas próximamente':'Tickets coming soon');
   await expect(agenda.locator('[data-concert-date="2027-04-07"] .concert-tickets a')).toHaveCount(0);
   await more.locator('summary').click();await expect(more).not.toHaveAttribute('open','');
  }
  const first=agenda.locator('.concert-tickets a').first();await expect(first).toHaveAttribute('href',upcoming.find(row=>row.url&&row.ticket_status==='available')!.url);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await agenda.screenshot({path:`test-results/agenda-${lang}-${width}.png`});
 });
}
