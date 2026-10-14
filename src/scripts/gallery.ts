export {};
const gallery=document.querySelector<HTMLElement>('[data-gallery]');
if(gallery){
 const track=gallery.querySelector<HTMLElement>('#gallery-track')!;
 const photos=[...gallery.querySelectorAll<HTMLAnchorElement>('[data-gallery-photo]')];
 const slides=photos.map(photo=>photo.closest('figure')!);
 const dialog=gallery.querySelector<HTMLDialogElement>('#gallery-lightbox')!;
 const imageContainer=gallery.querySelector<HTMLElement>('[data-gallery-image]')!;
 const caption=gallery.querySelector<HTMLElement>('#gallery-lightbox-caption')!;
 const pause=gallery.querySelector<HTMLButtonElement>('[data-gallery-pause]')!;
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let active=0,expanded=0,paused=false,touching=false,inView=false;
 let timer:ReturnType<typeof setTimeout>|undefined,trigger:HTMLElement|null=null,previousOverflow='';
 const count=(index:number)=>`${String(index+1).padStart(2,'0')} / ${String(photos.length).padStart(2,'0')}`;
 const offset=(index:number)=>slides[index].getBoundingClientRect().left-track.getBoundingClientRect().left+track.scrollLeft;
 function schedule(){
  clearTimeout(timer);
  if(paused||touching||!inView||document.hidden||motion.matches||dialog.open)return;
  timer=setTimeout(()=>{move(active+1);schedule();},3000);
 }
 function move(index:number){
  active=(index+photos.length)%photos.length;
  track.scrollTo({left:offset(active),behavior:motion.matches?'instant':'smooth'});
  gallery!.querySelector('[data-gallery-count]')!.textContent=count(active);
 }
 gallery.querySelector('.gallery-controls')?.removeAttribute('hidden');
 gallery.querySelector('[data-gallery-prev]')?.addEventListener('click',()=>{move(active-1);schedule();});
 gallery.querySelector('[data-gallery-next]')?.addEventListener('click',()=>{move(active+1);schedule();});
 function updateMotion(){
  pause.disabled=motion.matches;pause.textContent=motion.matches?gallery!.dataset.reducedShort!:paused?gallery!.dataset.resume!:gallery!.dataset.pause!;
  pause.setAttribute('aria-label',motion.matches?gallery!.dataset.reduced!:pause.textContent!);
  pause.setAttribute('aria-pressed',String(paused||motion.matches));schedule();
 }
 pause.addEventListener('click',()=>{paused=!paused;updateMotion();});
 motion.addEventListener('change',updateMotion);updateMotion();
 let scrollFrame=false;
 track.addEventListener('scroll',()=>{
  if(scrollFrame)return;scrollFrame=true;
  requestAnimationFrame(()=>{
   active=slides.reduce((closest,_,i)=>Math.abs(offset(i)-track.scrollLeft)<Math.abs(offset(closest)-track.scrollLeft)?i:closest,0);
   gallery!.querySelector('[data-gallery-count]')!.textContent=count(active);scrollFrame=false;
  });
 },{passive:true});
 track.addEventListener('keydown',event=>{
  if(event.target!==track)return;
  if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();move(active+(event.key==='ArrowRight'?1:-1));schedule();}
 });
 track.addEventListener('pointerdown',()=>{touching=true;schedule();});
 window.addEventListener('pointerup',()=>{if(touching){touching=false;schedule();}});
 window.addEventListener('pointercancel',()=>{touching=false;schedule();});
 document.addEventListener('visibilitychange',schedule);
 if('IntersectionObserver' in window)new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;schedule();},{threshold:.2}).observe(track);
 function showImage(index:number){
  expanded=(index+photos.length)%photos.length;
  const photo=photos[expanded],img=document.createElement('img');
  img.src=photo.href;img.alt=photo.querySelector('img')?.alt??photo.dataset.title!;img.decoding='async';
  imageContainer.replaceChildren(img);caption.textContent=`${photo.dataset.title} · ${photo.dataset.credit}`;
  gallery!.querySelector('[data-lightbox-count]')!.textContent=count(expanded);
 }
 photos.forEach((photo,index)=>photo.addEventListener('click',event=>{
  if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();trigger=photo;showImage(index);previousOverflow=document.body.style.overflow;
  dialog.showModal();document.body.style.overflow='hidden';schedule();
 }));
 gallery.querySelector('[data-gallery-close]')?.addEventListener('click',()=>dialog.close());
 gallery.querySelector('[data-lightbox-prev]')?.addEventListener('click',()=>showImage(expanded-1));
 gallery.querySelector('[data-lightbox-next]')?.addEventListener('click',()=>showImage(expanded+1));
 dialog.addEventListener('keydown',event=>{
  if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();showImage(expanded+(event.key==='ArrowRight'?1:-1));}
 });
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 dialog.addEventListener('close',()=>{imageContainer.replaceChildren();document.body.style.overflow=previousOverflow;trigger?.focus({preventScroll:true});schedule();});
 window.addEventListener('resize',()=>{track.scrollTo({left:offset(active),behavior:'instant'});});
}
