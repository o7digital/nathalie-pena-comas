const browser = document.querySelector<HTMLElement>('[data-repertoire-browser]');
if (browser) {
 const tabs = [...browser.querySelectorAll<HTMLButtonElement>('[data-repertoire-tab]')];
 const panels = [...browser.querySelectorAll<HTMLElement>('[data-repertoire-panel]')];
 const motion = matchMedia('(prefers-reduced-motion: reduce)');
 const seen = new Set<Element>();
 const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) {
   entry.target.classList.add('is-revealed');
   seen.add(entry.target);
   observer?.unobserve(entry.target);
  }
 }, { threshold:0.05 }) : undefined;
 function revealPanel(panel: HTMLElement) {
  panel.querySelectorAll<HTMLElement>('[data-repertoire-composer]').forEach((group,index) => {
   if (motion.matches || !observer || seen.has(group)) group.classList.add('is-revealed');
   else {
    group.classList.add('will-reveal');
    group.style.setProperty('--reveal-delay', `${Math.min(index % 4,3) * 55}ms`);
    observer.observe(group);
   }
  });
 }
 function selectTab(index: number, focus = false) {
  const selected = tabs[index];
  if (!selected) return;
  const switching = browser!.dataset.programme !== undefined;
  browser!.dataset.programme = selected.dataset.repertoireTab;
  tabs.forEach((tab,i) => { tab.setAttribute('aria-selected',String(i===index)); tab.tabIndex=i===index?0:-1; });
  panels.forEach((panel,i) => {
   panel.hidden = i!==index;
   panel.setAttribute('role','tabpanel');
   panel.setAttribute('aria-labelledby',tabs[i].id);
   panel.tabIndex=0;
   if (i===index) revealPanel(panel);
  });
  const number = browser!.querySelector('[data-repertoire-number]');
  if (number) number.textContent=String(index+1).padStart(2,'0');
  if (focus) selected.focus({preventScroll:true});
  // A sticky mobile tab always returns to the beginning of its new programme.
  const programme = browser!.querySelector<HTMLElement>('.repertoire-programme');
  const headerHeight = document.querySelector('#site-header')?.getBoundingClientRect().height ?? 104;
  if (switching && programme && programme.getBoundingClientRect().top < headerHeight) {
   window.scrollTo({top:window.scrollY + programme.getBoundingClientRect().top - headerHeight - 12,behavior:motion.matches?'instant':'smooth'});
  }
 }
 tabs.forEach((tab,index) => {
  tab.addEventListener('click',() => selectTab(index));
  tab.addEventListener('keydown',event => {
   const target = event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:undefined;
   if (target!==undefined) { event.preventDefault(); selectTab(target,true); }
  });
 });
 browser.querySelector<HTMLElement>('[data-repertoire-tabs]')!.hidden=false;
 selectTab(0);
 motion.addEventListener('change',() => {
  if (motion.matches) { browser.querySelectorAll('.will-reveal').forEach(group => group.classList.add('is-revealed')); observer?.disconnect(); }
 });
}
