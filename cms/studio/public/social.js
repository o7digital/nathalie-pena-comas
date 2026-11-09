const names={instagram:'Instagram',facebook:'Facebook',youtube:'YouTube',x:'X / Twitter'};
const glyph={instagram:'◎',facebook:'f',youtube:'▶',x:'𝕏'};
const profiles={instagram:[['@nathaliesoprano','https://www.instagram.com/nathaliesoprano/'],['Otro enlace del sitio','https://www.instagram.com/nathaliepenacomas/']],facebook:[['Nathalie Peña-Comas','https://www.facebook.com/nathalie.penacomas/'],['Otro enlace del sitio','https://www.facebook.com/sopranopenacomas/']],youtube:[['Canal oficial','https://www.youtube.com/channel/UCV9Oc0ONMX89lx1z-4vGZmQ']],x:[['@penacomasoprano','https://twitter.com/penacomasoprano']]};
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusNames={DRAFT:'Borrador',SCHEDULED:'Programada',PUBLISHING:'En proceso',PUBLISHED:'Publicada',PARTIAL:'Publicación parcial',FAILED:'No enviada',NEEDS_REVIEW:'Por verificar',CANCELED:'Cancelada',QUEUED:'En cola',RUNNING:'Enviando',WAITING:'Procesando en la red'};
const badge=status=>`<span class="social-status ${e(status.toLowerCase())}">${e(statusNames[status]||status)}</span>`;
const parts=(date,zone)=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(date)).map(v=>[v.type,v.value]));
export function zonedDate(value,zone){
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))throw new Error('Elige una fecha y una hora.');
 const target=Date.parse(value+'Z'),found=[];
 for(let offset=-14*60;offset<=14*60;offset+=15){const candidate=target-offset*60000,p=parts(candidate,zone);if(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`===value)found.push(candidate);}
 if(found.length!==1)throw new Error(found.length?'Esta hora se repite por el cambio horario. Elige una hora sin ambigüedad.':'Esta hora no existe en el huso seleccionado. Revisa el cambio horario.');
 return new Date(found[0]).toISOString();
}
const displayDate=(value,zone)=>value?new Intl.DateTimeFormat('es',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:zone}).format(new Date(value))+' · '+zone:'Sin fecha';
const dayKey=(value,zone)=>{const p=parts(value,zone);return `${p.year}-${p.month}-${p.day}`;};
const blank=()=>({id:null,clientKey:crypto.randomUUID(),title:'',text:'',media:null,channelIds:[],timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Vienna',options:{youtube:{privacy:'private',madeForKids:false}},plannedLocal:'',version:1});

export function createSocialUI({api,content,isCurrent,toast}){
 let data=null,error='',tab='board',filter='all',draft=null,busy=false,loading=false,generation=0,timer=null,selected=null,pending=null,calendarRows=[],month=new Date().toISOString().slice(0,7),calendarZone=Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Vienna';
 const main=()=>document.querySelector('#main');
 const header=()=>`<header class="page-head social-head"><div><span class="eyebrow">O7 PULSE SOCIAL · TU VOZ, MÁS LEJOS</span><h1>Comparte tu universo.</h1><p>Tus publicaciones, tus cuentas y tu calendario. Todo desde tu Studio O7.</p></div><div class="social-brand"><strong>O7</strong><span>SOCIAL</span></div></header>`;
 const channels=()=>data?.channels||[];
 const connected=()=>channels().filter(c=>c.state==='CONNECTED');
 function render(){
  if(!isCurrent())return;
  main().innerHTML=header()+`<div class="social-toolbar"><div class="tabs" aria-label="O7 Social">${[['board','Publicaciones'],['calendar','Calendario'],['connections','Mis cuentas'],['composer','Crear publicación']].map(([key,label])=>`<button class="tab ${tab===key?'active':''}" data-social-tab="${key}">${label}</button>`).join('')}</div><button class="button quiet" data-social="refresh" ${busy?'disabled':''}>Actualizar ↻</button></div>`+
   (error?`<p class="report-error" role="alert">${e(error)}</p>`:'')+
   (loading&&!data?'<section class="panel report-panel"><p>Consultando tu espacio social…</p></section>':!data?'<section class="panel report-panel"><h2>Conecta tu acceso O7</h2><p>Entra con la cuenta administradora del Studio o conecta tu cuenta ARM para abrir tu espacio social.</p><a class="text-link" href="#arm">Conectar mi ARM ↗</a></section>':pending?candidateView():tab==='connections'?connectionView():tab==='composer'?composer():tab==='calendar'?calendar():board())+
   (selected?detail(selected):'')+
   `<p class="report-footnote social-footer-note">O7 publica mediante las autorizaciones de tus cuentas. Solo una confirmación explícita pone una publicación en la cola. Las conexiones y los borradores no publican contenido.</p>`;
  bind();
 }
 function board(){
  const posts=(data.posts||[]).filter(p=>filter==='all'||p.status===filter);
  const counts=data.counts||{};
  return `<div class="report-kpis social-kpis">${[['Borradores',counts.DRAFT||0,'Tu próximo contenido'],['Programadas',counts.SCHEDULED||0,'Preparadas para su momento'],['Publicadas',counts.PUBLISHED||0,'Confirmadas por las redes'],['Por revisar',(counts.NEEDS_REVIEW||0)+(counts.FAILED||0)+(counts.PARTIAL||0),'Envíos que necesitan tu atención']].map(([title,count,note],i)=>`<article class="panel report-kpi"><span class="eyebrow">0${i+1} / ${title}</span><strong>${count}</strong><p>${note}</p></article>`).join('')}</div>`+
   (!connected().length?`<section class="panel social-onboard"><div><span class="eyebrow">EL PRIMER PASO</span><h2>Tus cuentas, bajo tu control.</h2><p>Prepara tus publicaciones y conecta las cuentas que quieres gestionar desde O7. La autorización no modifica tus perfiles.</p></div><button class="button primary" data-social-tab="connections">Conectar mis cuentas ↗</button></section>`:'')+
   `<section class="panel report-panel"><div class="panel-heading"><h2>Tu estudio de publicaciones</h2><button class="button primary" data-social="new">＋ Nueva publicación</button></div><label class="social-filter">Mostrar<select id="social-filter">${[['all','Todo'],['DRAFT','Borradores'],['SCHEDULED','Programadas'],['PUBLISHED','Publicadas'],['NEEDS_REVIEW','Por verificar'],['FAILED','No enviadas'],['PARTIAL','Parciales'],['CANCELED','Canceladas']].map(([key,title])=>`<option value="${key}" ${filter===key?'selected':''}>${title}</option>`).join('')}</select></label>${posts.length?`<div class="social-post-list">${posts.map(p=>`<button class="social-post-row" data-social-open="${e(p.id)}"><span class="social-post-thumb">${p.media?.id?p.media.type==='image'?`<img src="/api/social/media-preview/${e(p.media.id)}" alt="">`:'▶':'✎'}</span><span class="social-post-copy"><strong>${e(p.title)}</strong><small>${e(p.text.slice(0,110))}</small><span>${(p.channelIds||[]).map(id=>channels().find(c=>c.id===id)?.provider).filter(Boolean).map(key=>`<i class="social-mini ${key}">${glyph[key]}</i>`).join('')}${!(p.channelIds||[]).length?'<small>Sin cuentas seleccionadas</small>':''}</span></span><span class="social-post-state">${badge(p.status)}<small>${e(p.scheduledAt?displayDate(p.scheduledAt,p.timezone):'Guardada sin programar')}</small></span><span aria-hidden="true">↗</span></button>`).join('')}</div>${data.posts.length>=100?'<button class="button quiet" data-social="more">Cargar más publicaciones ↓</button>':''}`:empty('Tu próxima publicación empieza aquí.','Guarda una idea, añade una foto o un vídeo y elige cuándo compartirlo.')}</section>`;
 }
 const empty=(title,copy)=>`<div class="social-empty"><span aria-hidden="true">↗</span><h3>${e(title)}</h3><p>${e(copy)}</p><button class="button primary" data-social="new">Crear publicación</button></div>`;
 function connectionView(){
  return `<section class="panel report-panel"><div class="panel-heading"><div><span class="eyebrow">TUS CONEXIONES</span><h2>Elige dónde quieres estar.</h2></div><span class="badge accent">PUBLICACIÓN DIRECTA O7</span></div><div class="social-network-grid">${Object.entries(names).map(([provider,name])=>{
   const config=data.providers.find(p=>p.id===provider),accounts=channels().filter(c=>c.provider===provider&&c.state!=='DISCONNECTED');
   return `<article class="social-network ${provider}"><span class="social-network-symbol">${glyph[provider]}</span><h3>${name}</h3><p>${provider==='instagram'?'Fotos y Reels en tu cuenta profesional.':provider==='facebook'?'Texto, fotos y vídeos en tu Página.':provider==='youtube'?'Vídeos en tu canal, con la visibilidad que elijas.':'Texto, imágenes y vídeos en tu perfil.'}</p>${accounts.map(c=>`<div class="social-account"><strong>${e(c.name)}</strong><span class="social-connection-state ${c.state==='CONNECTED'?'connected':''}">${c.state==='CONNECTED'?'Conectada':'Requiere reconexión'}</span><a href="${e(c.profileUrl)}" target="_blank" rel="noopener">Ver cuenta ↗</a><button class="text-link" data-social-disconnect="${e(c.id)}">Desconectar</button></div>`).join('')}<button class="button ${config?.configured?'primary':'quiet'}" data-social-connect="${config?.oauth}" ${!config?.configured||!data.offer?.enabled?'disabled':''}>${accounts.length?'Conectar otra cuenta':'Conectar '+name} ↗</button>${!config?.configured?'<small class="social-setup-note">O7 está preparando la aplicación de conexión.</small>':!data.offer?.enabled?'<small class="social-setup-note">Tu equipo O7 debe activar el acceso Social en tu suscripción.</small>':''}<div class="social-profile-reference"><small>Enlaces encontrados en tu sitio original</small>${profiles[provider].map(([label,url])=>`<a href="${e(url)}" target="_blank" rel="noopener">${e(label)} ↗</a>`).join('')}</div></article>`;
  }).join('')}</div><p class="report-footnote">Comprueba el nombre del perfil antes de conectarlo. Facebook requiere una Página; Instagram, una cuenta profesional asociada a una Página. El acceso de X depende de su oferta API.</p></section>
  <section class="panel report-panel social-music"><div><span class="eyebrow">TU MÚSICA / SPOTIFY</span><h2>Tu catálogo también forma parte de tu universo.</h2><p>La distribución de canciones y álbumes se gestiona con tu distribuidor. Aquí conservas el acceso a tu perfil y el seguimiento de resultados.</p></div><div><a class="button quiet" href="https://open.spotify.com/artist/3lDJkwtZmncXJuv2BUpB80" target="_blank" rel="noopener">Mi perfil Spotify ↗</a><a class="text-link" href="#analytics">Analytics & Reporting ↗</a></div></section>
  <section class="panel report-panel social-price"><div><span class="eyebrow">SUSCRIPCIÓN O7 SOCIAL</span><h2>${e(new Intl.NumberFormat('es',{style:'currency',currency:data.offer?.currency||'USD'}).format((data.offer?.amountMinor??900)/100))} <small>/ mes</small></h2><p>Gestión desde O7 para Instagram, Facebook, YouTube y X. Oferta prevista, pendiente de activación por O7; no se activa ningún cobro al conectar una cuenta.</p></div><a class="button quiet" href="#subscription">Mi suscripción ↗</a></section>`;
 }
 function candidateView(){return `<section class="panel report-panel social-candidates"><span class="eyebrow">AUTORIZACIÓN RECIBIDA</span><h2>Elige las cuentas de Nathalie.</h2><p>Comprueba estos perfiles y marca únicamente las cuentas que quieres añadir a este Studio. Ninguna publicación se enviará al conectarlas.</p><form id="social-candidates">${pending.candidates.map(c=>`<label><input type="checkbox" name="account" value="${e(c.key)}"><span class="social-mini ${e(c.provider)}">${glyph[c.provider]}</span><span><strong>${e(c.name)}</strong><small>${e(names[c.provider])}</small></span><a href="${e(c.profileUrl)}" target="_blank" rel="noopener">Ver perfil ↗</a></label>`).join('')}<div class="social-form-actions"><button class="button primary" ${busy?'disabled':''}>Añadir cuentas seleccionadas</button><button type="button" class="button quiet" data-social="dismiss-candidates">Volver sin conectar</button></div><p class="social-form-error" role="alert"></p></form></section>`;}
 function composer(){
  draft ||= blank();
  const zones=[...new Set([draft.timezone,'Europe/Vienna','Europe/Madrid','America/Santo_Domingo','America/Mexico_City','UTC'])];
  return `<div class="social-compose-grid"><section class="panel report-panel"><div class="panel-heading"><div><span class="eyebrow">${draft.id?'BORRADOR GUARDADO':'UNA NUEVA HISTORIA'}</span><h2>Prepara tu publicación.</h2></div><span class="badge accent">${draft.id?'VERSIÓN '+draft.version:'BORRADOR'}</span></div><form id="social-composer"><label>Título de la publicación<input name="title" required maxlength="180" value="${e(draft.title)}" placeholder="Un nuevo escenario, una nueva historia…"></label><label>Tu mensaje<textarea name="text" maxlength="5000" rows="7" placeholder="Comparte lo que quieres contar…">${e(draft.text)}</textarea><small id="social-counter">${draft.text.length} caracteres · Instagram: 2200 máx. · X valida su límite al confirmar</small></label><fieldset><legend>¿Dónde quieres compartirlo?</legend>${connected().length?`<div class="social-targets">${connected().map(c=>`<label><input type="checkbox" name="channel" value="${e(c.id)}" ${draft.channelIds.includes(c.id)?'checked':''}><span class="social-mini ${e(c.provider)}">${glyph[c.provider]}</span><span><strong>${e(c.name)}</strong><small>${e(names[c.provider])}</small></span></label>`).join('')}</div>`:'<p>Primero puedes guardar tu idea. Conecta tus cuentas para elegir los destinos.</p><button type="button" class="text-link" data-social-tab="connections">Conectar mis cuentas ↗</button>'}</fieldset>
  <fieldset><legend>Foto o vídeo</legend><label class="social-upload"><span>＋ Seleccionar un archivo</span><input id="social-upload" type="file" accept="image/jpeg,image/png,image/webp,video/mp4" ${busy?'disabled':''}><small>Una foto de hasta 25 MB o un vídeo MP4 de hasta 250 MB. La foto se optimiza para las redes.</small></label>${draft.media?`<div class="social-media-selected"><strong>${draft.media.type==='video'?'▶ Vídeo MP4':'▧ Fotografía'} · ${(draft.media.size/1048576).toFixed(1)} MB</strong><button type="button" class="text-link" data-social="remove-media">Quitar</button></div>`:''}<label>O elegir una foto de tu galería<select id="social-gallery"><option value="">Selecciona una fotografía…</option>${(content()?.gallery||[]).filter(r=>r.status!=='archived'&&r.image).map(r=>{const id=typeof r.image==='string'?r.image:r.image.id;return `<option value="${e(id)}" ${draft.media?.id===id?'selected':''}>${e(r.title)}</option>`;}).join('')}</select></label></fieldset>
  <fieldset class="social-youtube"><legend>YouTube · opciones del vídeo</legend><label>Visibilidad<select name="privacy">${[['private','Privado'],['unlisted','No listado'],['public','Público']].map(([key,label])=>`<option value="${key}" ${draft.options.youtube?.privacy===key?'selected':''}>${label}</option>`).join('')}</select></label><label>Público del vídeo<select name="madeForKids"><option value="false" ${!draft.options.youtube?.madeForKids?'selected':''}>No está creado específicamente para niños</option><option value="true" ${draft.options.youtube?.madeForKids?'selected':''}>Sí, está creado específicamente para niños</option></select></label></fieldset>
  <fieldset><legend>Tu momento para compartir</legend><label>Zona horaria<select name="timezone">${zones.map(z=>`<option ${z===draft.timezone?'selected':''}>${e(z)}</option>`).join('')}</select></label><label>Fecha y hora para programar<input name="plannedLocal" type="datetime-local" value="${e(draft.plannedLocal||'')}"></label><p class="report-footnote">La programación conserva la zona horaria elegida. Entre un minuto y 90 días de antelación.</p></fieldset>
  <p id="social-form-error" class="social-form-error" role="alert"></p><div class="social-form-actions"><button class="button quiet" type="submit" ${busy?'disabled':''}>${busy?'Guardando…':'Guardar borrador'}</button><button class="button primary" type="button" data-social="review-schedule" ${busy||!connected().length||!data.offer?.enabled?'disabled':''}>Programar ↗</button><button class="button gold" type="button" data-social="review-now" ${busy||!connected().length||!data.offer?.enabled?'disabled':''}>Publicar ahora ↗</button></div></form></section>
  <aside class="social-preview-side"><section class="panel report-panel"><span class="eyebrow">VISTA PREVIA</span><div class="social-preview-profile"><img src="/artist.webp" alt=""><span><strong>Nathalie Peña-Comas</strong><small>Tu publicación · O7 Social</small></span></div><div id="social-preview-copy"></div><div id="social-preview-media">${draft.media?.id?draft.media.type==='video'?`<video controls preload="metadata" src="/api/social/media-preview/${e(draft.media.id)}"></video>`:`<img src="/api/social/media-preview/${e(draft.media.id)}" alt="Fotografía de la publicación">`:'<div class="social-preview-placeholder">Tu fotografía o vídeo aparecerá aquí.</div>'}</div><p class="report-footnote">Vista orientativa. Cada red adapta el formato final.</p></section><section class="panel report-panel social-compose-note"><h3>Preparar. Revisar. Compartir.</h3><p>Guardar un borrador conserva tu idea. Programar o publicar requiere confirmar los destinos y el contenido en el siguiente paso.</p><p>Si un envío queda por verificar, consulta el perfil antes de crear una nueva publicación.</p></section></aside></div>`;
 }
 function calendar(){
  const start=new Date(month+'-01T12:00:00Z'),offset=(start.getUTCDay()+6)%7,days=new Date(start.getUTCFullYear(),start.getUTCMonth()+1,0).getDate(),total=Math.ceil((offset+days)/7)*7;
  const buckets=new Map();for(const p of calendarRows){const key=dayKey(p.scheduledAt,calendarZone);buckets.set(key,[...(buckets.get(key)||[]),p]);}
  return `<section class="panel report-panel"><div class="panel-heading"><div><span class="eyebrow">TU CALENDARIO EDITORIAL</span><h2>${e(new Intl.DateTimeFormat('es',{month:'long',year:'numeric',timeZone:'UTC'}).format(start))}</h2></div><div class="social-calendar-actions"><button class="button quiet" data-social-month="-1" aria-label="Mes anterior">←</button><button class="button quiet" data-social-month="1" aria-label="Mes siguiente">→</button><button class="button primary" data-social="new">＋ Crear</button></div></div><p class="report-footnote">Fechas y horas en ${e(calendarZone)}. La cola conserva también el huso elegido en cada publicación.</p><div class="social-calendar-grid">${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>`<strong class="social-weekday">${d}</strong>`).join('')}${Array.from({length:total},(_,i)=>{const day=i-offset+1;if(day<1||day>days)return '<div class="social-day outside"></div>';const key=month+'-'+String(day).padStart(2,'0');return `<div class="social-day"><span>${day}</span>${(buckets.get(key)||[]).map(p=>`<button class="social-calendar-post ${e(p.status.toLowerCase())}" data-social-open="${e(p.id)}"><strong>${e(new Intl.DateTimeFormat('es',{timeZone:calendarZone,hour:'2-digit',minute:'2-digit'}).format(new Date(p.scheduledAt)))}</strong><span>${e(p.title)}</span></button>`).join('')}</div>`;}).join('')}</div>${!calendarRows.length?'<p class="report-footnote">Todavía no hay publicaciones programadas este mes.</p>':''}</section>`;
 }
 function detail(post){return `<dialog id="social-detail" class="social-dialog"><button class="social-dialog-close" aria-label="Cerrar detalle" data-social="close-detail">×</button><span class="eyebrow">TU PUBLICACIÓN</span><h2>${e(post.title)}</h2>${badge(post.status)}<p class="social-detail-copy">${e(post.text)}</p>${post.media?.type==='image'?`<img class="social-detail-image" src="/api/social/media-preview/${e(post.media.id)}" alt="">`:post.media?`<video controls preload="metadata" class="social-detail-image" src="/api/social/media-preview/${e(post.media.id)}"></video>`:''}<p>${e(post.scheduledAt?displayDate(post.scheduledAt,post.timezone):'Borrador sin programar')}</p><div class="social-deliveries">${(post.deliveries||[]).map(d=>`<article><strong>${e(names[d.channel?.provider])} · ${e(d.channel?.name)}</strong>${badge(d.state)}${d.visibility?`<small>Visibilidad: ${e(({private:'Privado',unlisted:'No listado',public:'Público'})[d.visibility]||d.visibility)}</small>`:''}${d.message?`<p>${e(d.message)}</p>`:''}${d.remoteUrl?`<a href="${e(d.remoteUrl)}" target="_blank" rel="noopener">Ver en la red ↗</a>`:''}</article>`).join('')}</div>${post.status==='NEEDS_REVIEW'||post.deliveries?.some(d=>d.state==='NEEDS_REVIEW')?'<p class="report-error">Comprueba el perfil antes de volver a publicar. O7 no repetirá automáticamente un envío sin confirmar.</p><button class="button quiet" data-social="check-remote">Verificar confirmación ↻</button>':''}<div class="social-form-actions">${post.status==='DRAFT'?'<button class="button primary" data-social="edit">Editar borrador ↗</button>':''}${['DRAFT','SCHEDULED'].includes(post.status)?'<button class="button quiet" data-social="cancel-post">Cancelar publicación</button>':''}<button class="button quiet" data-social="close-detail">Cerrar</button></div></dialog>`;}
 function bind(){
  main().querySelectorAll('[data-social-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.socialTab;error='';selected=null;if(tab==='composer')draft||=blank();if(tab==='calendar')loadCalendar();else render();}));
  main().querySelectorAll('[data-social]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.social)));
  main().querySelectorAll('[data-social-open]').forEach(b=>b.addEventListener('click',async()=>{try{selected=await api('/api/social/posts/'+b.dataset.socialOpen);render();}catch(failure){toast(failure.message,true);}}));
  main().querySelectorAll('[data-social-connect]').forEach(b=>b.addEventListener('click',()=>connect(b,b.dataset.socialConnect)));
  main().querySelectorAll('[data-social-disconnect]').forEach(b=>b.addEventListener('click',()=>disconnect(b.dataset.socialDisconnect)));
  main().querySelectorAll('[data-social-month]').forEach(b=>b.addEventListener('click',()=>{const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+Number(b.dataset.socialMonth));month=d.toISOString().slice(0,7);loadCalendar();}));
  main().querySelector('#social-filter')?.addEventListener('change',ev=>{filter=ev.target.value;render();});
  const form=main().querySelector('#social-composer');
  if(form){
   form.addEventListener('input',readDraft);form.addEventListener('change',readDraft);form.addEventListener('submit',async ev=>{ev.preventDefault();try{await saveDraft();toast('Borrador guardado. No se ha enviado nada.');render();}catch(failure){formError(failure.message);}});
   main().querySelector('#social-upload').addEventListener('change',upload);
   main().querySelector('#social-gallery').addEventListener('change',async ev=>{if(!ev.target.value)return;readDraft();draft.media={id:ev.target.value,type:'image',size:0};render();});
   previewCopy();
  }
  const candidates=main().querySelector('#social-candidates');candidates?.addEventListener('submit',async ev=>{
   ev.preventDefault();const keys=new FormData(candidates).getAll('account');if(!keys.length){candidates.querySelector('[role=alert]').textContent='Selecciona al menos una cuenta.';return;}
   busy=true;try{await api('/api/social/oauth/'+pending.attemptId+'/confirm',{method:'POST',body:{channelKeys:keys}});pending=null;sessionStorage.removeItem('o7-social-attempt');tab='connections';await load();toast('Cuentas conectadas a tu Studio.');}catch(failure){candidates.querySelector('[role=alert]').textContent=failure.message;}finally{busy=false;}
  });
  if(selected){const dialog=main().querySelector('#social-detail');dialog.addEventListener('cancel',()=>selected=null);dialog.showModal();}
 }
 function readDraft(){
  const form=main().querySelector('#social-composer');if(!form||!draft)return;
  const fields=new FormData(form);for(const key of ['title','text','timezone','plannedLocal'])draft[key]=fields.get(key)||'';
  draft.channelIds=fields.getAll('channel');draft.options={youtube:{privacy:fields.get('privacy'),madeForKids:fields.get('madeForKids')==='true'}};
  previewCopy();
 }
 function previewCopy(){const el=main().querySelector('#social-preview-copy');if(el)el.textContent=draft?.text||'Tu mensaje aparecerá aquí…';const counter=main().querySelector('#social-counter');if(counter)counter.textContent=draft.text.length+' caracteres · Instagram: 2200 máx. · X valida su límite al confirmar';}
 const formError=message=>{const el=main().querySelector('#social-form-error');if(el)el.textContent=message;else toast(message,true);};
 async function saveDraft(){
  readDraft();if(!draft.title.trim())throw new Error('Añade un título a tu publicación.');
  busy=true;
  try{
   const result=await api('/api/social/posts'+(draft.id?'/'+draft.id:''),{method:draft.id?'PATCH':'POST',body:{clientKey:draft.clientKey,title:draft.title,text:draft.text,timezone:draft.timezone,channelIds:draft.channelIds,options:draft.options,mediaId:draft.media?.id||null,...(draft.id?{version:draft.version}:{})}});
   draft={...draft,...result};data.posts=[result,...data.posts.filter(p=>p.id!==result.id)];return result;
  }finally{busy=false;}
 }
 async function review(action){
  if(busy)return;
  try{
   readDraft();if(!draft.channelIds.length)throw new Error('Selecciona al menos una cuenta conectada.');
   const due=action==='SCHEDULE'?zonedDate(draft.plannedLocal,draft.timezone):null;
   if(due&&(Date.parse(due)<Date.now()+60000||Date.parse(due)>Date.now()+90*86400000))throw new Error('Programa entre un minuto y 90 días de antelación.');
   const saved=await saveDraft();render();
   const dialog=document.createElement('dialog');dialog.className='social-dialog';dialog.id='social-approval';
   dialog.innerHTML=`<span class="eyebrow">ÚLTIMA REVISIÓN</span><h2>${action==='NOW'?'¿Publicar ahora?':'¿Confirmar programación?'}</h2><h3>${e(saved.title)}</h3><p class="social-detail-copy">${e(saved.text)}</p><div class="social-approval-accounts">${saved.channelIds.map(id=>{const c=channels().find(c=>c.id===id);return `<strong>${e(names[c?.provider])} · ${e(c?.name)}</strong>`;}).join('')}</div><p>${action==='NOW'?'La publicación entrará ahora en la cola O7.':e(displayDate(due,draft.timezone))}</p>${saved.channelIds.some(id=>channels().find(c=>c.id===id)?.provider==='youtube')?`<p>YouTube: ${e(({private:'Privado',unlisted:'No listado',public:'Público'})[draft.options.youtube.privacy])}.</p>`:''}<p class="social-form-error" role="alert"></p><div class="social-form-actions"><button class="button gold" id="social-approve-confirm">${action==='NOW'?'Sí, publicar en estas cuentas':'Sí, programar esta publicación'}</button><button class="button quiet" id="social-approve-back">Seguir editando</button></div>`;
   main().append(dialog);dialog.showModal();dialog.querySelector('#social-approve-back').onclick=()=>{dialog.close();dialog.remove();};
   dialog.addEventListener('cancel',()=>dialog.remove());
   dialog.querySelector('#social-approve-confirm').onclick=async ev=>{
    ev.target.disabled=true;busy=true;
    try{await api('/api/social/posts/'+saved.id+'/approve',{method:'POST',body:{version:saved.version,action,...(due?{scheduledAt:due}:{})}});dialog.close();dialog.remove();draft=null;tab='board';busy=false;await load();toast(action==='NOW'?'Publicación confirmada. Puedes seguir cada envío en el journal.':'Publicación programada en O7.');}
    catch(failure){dialog.querySelector('[role=alert]').textContent=failure.message;ev.target.disabled=false;busy=false;}
   };
  }catch(failure){formError(failure.message);}
 }
 async function upload(event){
  const file=event.target.files[0];if(!file)return;readDraft();
  if(!['image/jpeg','image/png','image/webp','video/mp4'].includes(file.type)||file.size>(file.type==='video/mp4'?250:25)*1048576){formError('Selecciona una foto de hasta 25 MB o un vídeo MP4 de hasta 250 MB.');return;}
  busy=true;toast('Subiendo tu medio. Mantén esta página abierta…',false,true);event.target.disabled=true;
  try{const response=await fetch('/api/social/upload',{method:'POST',headers:{'Content-Type':file.type},body:file});const result=await response.json();if(!response.ok)throw new Error(result.error||'No se pudo subir el medio.');draft.media=result;toast('Medio preparado. Guarda tu borrador para conservarlo.');}
  catch(failure){formError(failure.message);toast(failure.message,true);}
  finally{busy=false;render();}
 }
 async function connect(button,provider){
  button.disabled=true;
  try{const result=await api('/api/social/oauth/'+provider+'/start',{method:'POST',body:{}});const url=new URL(result.authorizationUrl);if(!['https://www.facebook.com','https://accounts.google.com','https://x.com'].includes(url.origin))throw new Error('El enlace de autorización no es válido.');location.assign(url.href);}
  catch(failure){toast(failure.message,true);button.disabled=false;}
 }
 async function disconnect(id){
  if(!confirm('¿Desconectar esta cuenta de O7? Los envíos que ya han empezado deben comprobarse en la red.'))return;
  try{await api('/api/social/channels/'+id+'/disconnect',{method:'POST',body:{}});await load();toast('Cuenta desconectada de O7.');}catch(failure){toast(failure.message,true);}
 }
 async function action(name){
  if(name==='new'){draft=blank();selected=null;tab='composer';render();return;}
  if(name==='refresh'){if(tab==='composer'){toast('Guarda tu borrador antes de actualizar.');return;}await load();if(tab==='calendar')await loadCalendar();return;}
  if(name==='remove-media'){readDraft();draft.media=null;render();return;}
  if(name==='review-now')return review('NOW');if(name==='review-schedule')return review('SCHEDULE');
  if(name==='close-detail'){selected=null;render();return;}
  if(name==='edit'){draft={...selected,options:{youtube:{privacy:'private',madeForKids:false},...selected.options},plannedLocal:''};selected=null;tab='composer';render();return;}
  if(name==='dismiss-candidates'){pending=null;sessionStorage.removeItem('o7-social-attempt');tab='connections';render();return;}
  if(name==='cancel-post'){
   if(!confirm('¿Cancelar esta publicación y sus envíos pendientes?'))return;
   try{await api('/api/social/posts/'+selected.id+'/cancel',{method:'POST',body:{version:selected.version}});selected=null;await load();if(tab==='calendar')await loadCalendar();toast('Publicación cancelada.');}catch(failure){toast(failure.message,true);}return;
  }
  if(name==='check-remote'){try{selected=await api('/api/social/posts/'+selected.id+'/refresh',{method:'POST',body:{}});render();}catch(failure){toast(failure.message,true);}return;}
  if(name==='more'){try{const rows=await api('/api/social/posts?cursor='+encodeURIComponent(data.posts.at(-1).id));data.posts.push(...rows.filter(p=>!data.posts.some(x=>x.id===p.id)));render();if(!rows.length)toast('Ya has visto todas las publicaciones.');}catch(failure){toast(failure.message,true);}}
 }
 async function loadCalendar(){
  try{calendarRows=await api('/api/social/calendar?month='+month);error='';render();}catch(failure){error=failure.message;render();}
 }
 async function load(quiet=false){
  const current=++generation;if(!quiet){loading=true;error='';render();}
  try{const result=await api('/api/social');if(current===generation){data=result;error='';}}
  catch(failure){if(current===generation)error=failure.message;}
  finally{if(current===generation){loading=false;if(!quiet||tab!=='composer')render();}}
 }
 return {
  async show(){
   await load();
   if(!isCurrent())return;
   const attempt=sessionStorage.getItem('o7-social-attempt');if(attempt){try{pending=await api('/api/social/oauth/'+encodeURIComponent(attempt)+'/candidates');render();}catch(failure){sessionStorage.removeItem('o7-social-attempt');toast(failure.message,true);}}
   if(!timer)timer=setInterval(()=>{if(isCurrent()&&!busy&&tab!=='composer'&&!selected&&!pending){void load(true);if(tab==='calendar')void loadCalendar();}},15000);
  },
  reset(){generation++;data=null;draft=null;selected=null;pending=null;error='';tab='board';clearInterval(timer);timer=null;sessionStorage.removeItem('o7-social-attempt');},
 };
}
