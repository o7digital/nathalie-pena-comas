import {musicEmbed} from '../lib/music-players';
const modal=document.querySelector<HTMLDialogElement>('#music-modal');
if(modal){
 const panels=[...modal.querySelectorAll<HTMLElement>('[data-listening-panel]')];
 document.querySelectorAll<HTMLAnchorElement>('a[data-listen]').forEach(link=>{if(panels.some(panel=>panel.dataset.listeningPanel===link.dataset.listen))link.setAttribute('aria-haspopup','dialog');});
 let trigger:HTMLElement|null=null,previousOverflow='',returnUrl='',ownsHistory=false,closingFromHistory=false,focusAfterHistory=false;
 const hashFor=(key:string)=>'#listen-'+key;
 const active=()=>panels.find(panel=>!panel.hidden);
 function stopPlayers(){
  for(const panel of panels){panel.querySelector('[data-music-player]')?.replaceChildren();const region=panel.querySelector<HTMLElement>('[data-music-player-region]');if(region)region.hidden=true;panel.querySelectorAll('[aria-current]').forEach(el=>el.removeAttribute('aria-current'));}
 }
 function choose(key:string,source?:HTMLElement,historyMode:'push'|'replace'|'none'='push'){
  const panel=panels.find(panel=>panel.dataset.listeningPanel===key);if(!panel)return false;
  if(!modal!.open){trigger=source||document.activeElement as HTMLElement;modal!.dataset.sourceSection=source?(source.closest('section')?.id||'footer'):'music';previousOverflow=document.body.style.overflow;returnUrl=location.pathname+location.search+location.hash;document.querySelector<HTMLDialogElement>('#video-modal[open]')?.close();document.querySelectorAll('audio,video').forEach(player=>(player as HTMLMediaElement).pause());modal!.showModal();document.body.style.overflow='hidden';}
  stopPlayers();panels.forEach(item=>item.hidden=item!==panel);modal!.querySelector('#music-modal-title')!.textContent=panel.dataset.title||'';
  modal!.scrollTop=0;
  if(historyMode==='push'){history.pushState({...history.state,npcListening:true},'',hashFor(key));ownsHistory=true;}
  else if(historyMode==='replace')history.replaceState(history.state,'',hashFor(key));
  return true;
 }
 function loadPlayer(link:HTMLAnchorElement){
  const panel=active();if(!panel)return;
  const embed=musicEmbed(link.href);if(!embed||embed.src!==link.dataset.musicEmbed)return;
  stopPlayers();const region=panel.querySelector<HTMLElement>('[data-music-player-region]')!,container=panel.querySelector('[data-music-player]')!;
  const external=panel.querySelector<HTMLAnchorElement>('[data-music-external]')!,status=panel.querySelector<HTMLElement>('[data-music-player-status]')!;
  panel.querySelector('[data-music-provider]')!.textContent=embed.provider;external.href=link.href;status.textContent=modal!.dataset.playerLoading||'';
  const frame=document.createElement('iframe');frame.title=embed.provider+' · '+(panel.dataset.title||modal!.dataset.playerTitle);frame.height=String(embed.height);frame.allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allowFullscreen=true;frame.addEventListener('load',()=>status.textContent='',{once:true});frame.src=embed.src;
  region.hidden=false;container.replaceChildren(frame);link.setAttribute('aria-current','true');
  requestAnimationFrame(()=>region.scrollIntoView({block:'nearest',behavior:'instant'}));
 }
 document.addEventListener('click',event=>{
  const click=event as MouseEvent;if(click.button!==0||click.ctrlKey||click.metaKey||click.shiftKey||click.altKey||event.defaultPrevented)return;
  const element=event.target as HTMLElement,link=element.closest<HTMLAnchorElement>('a[data-listen]');
  if(link&&choose(link.dataset.listen!,link)){event.preventDefault();return;}
  const next=element.closest<HTMLButtonElement>('[data-listening-switch]');if(next){choose(next.dataset.listeningSwitch!,next,'replace');return;}
  const provider=element.closest<HTMLAnchorElement>('[data-music-embed]');if(provider&&modal!.contains(provider)){event.preventDefault();loadPlayer(provider);return;}
  if(element.closest('[data-music-close]'))modal!.close();
 });
 modal.addEventListener('click',event=>{if(event.target!==modal)return;const box=modal.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)modal.close();});
 modal.addEventListener('close',()=>{
  stopPlayers();document.body.style.overflow=previousOverflow;trigger?.focus({preventScroll:true});
  if(!closingFromHistory&&location.hash.startsWith('#listen-')){
   if(ownsHistory){focusAfterHistory=true;history.back();}else history.replaceState(history.state,'',returnUrl.includes('#listen-')?location.pathname+location.search+'#music':returnUrl);
  }
  ownsHistory=false;closingFromHistory=false;
 });
 window.addEventListener('popstate',()=>{
  const key=location.hash.startsWith('#listen-')?location.hash.slice(8):'';
  if(key){choose(key,undefined,'none');return;}
  if(modal!.open){closingFromHistory=true;modal!.close();}
  if(focusAfterHistory){focusAfterHistory=false;requestAnimationFrame(()=>trigger?.focus({preventScroll:true}));}
 });
 // Shared links open the release chooser; external players still wait for a click.
 if(location.hash.startsWith('#listen-'))choose(location.hash.slice(8),undefined,'none');
}
