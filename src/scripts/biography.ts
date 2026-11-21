const dossier=document.querySelector<HTMLElement>('[data-biography-tabs]');
if(dossier) {
 const index=dossier.querySelector<HTMLElement>('.biography-index');
 const tabs=[...dossier.querySelectorAll<HTMLAnchorElement>('.biography-index a')];
 const panels=[...dossier.querySelectorAll<HTMLElement>('[data-biography]')];
 function selectTab(tab:HTMLAnchorElement,focus=false) {
  const panelId=tab.hash.slice(1);
  tabs.forEach(item=>{
   const selected=item===tab;
   item.setAttribute('aria-selected',String(selected));
   item.tabIndex=selected?0:-1;
  });
  panels.forEach(panel=>{panel.hidden=panel.id!==panelId;});
  if(focus)tab.focus();
 }
 index?.setAttribute('role','tablist');
 tabs.forEach((tab,i)=>{
  tab.id=`biography-tab-${i}`;
  tab.setAttribute('role','tab');
  tab.setAttribute('aria-controls',tab.hash.slice(1));
  const panel=panels.find(panel=>panel.id===tab.hash.slice(1));
  panel?.setAttribute('role','tabpanel');
  panel?.setAttribute('aria-labelledby',tab.id);
  if(panel)panel.tabIndex=0;
  tab.addEventListener('click',event=>{
   event.preventDefault();
   selectTab(tab);
   history.replaceState(null,'',tab.hash);
  });
  tab.addEventListener('keydown',event=>{
   const target=event.key==='Home'?0:event.key==='End'?tabs.length-1:event.key==='ArrowRight'?(i+1)%tabs.length:event.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:undefined;
   if(target===undefined)return;
   event.preventDefault();
   selectTab(tabs[target],true);
   history.replaceState(null,'',tabs[target].hash);
  });
 });
 const fromHash=()=>tabs.find(tab=>tab.hash===location.hash);
 selectTab(fromHash()??tabs[0]);
 dossier.classList.add('biography-tabs-ready');
 window.addEventListener('hashchange',()=>{const tab=fromHash();if(tab)selectTab(tab);});
}
