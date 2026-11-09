import {createSocialUI} from './social.js';
import {createReportingUI} from './reporting.js';
export {};
const $=s=>document.querySelector(s);
const icons={home:'<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-8h6v8"/>',photo:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',video:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3Z"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',album:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 6a6 6 0 0 1 6 6"/>',text:'<path d="M4 5h16M12 5v15M8 20h8M5 12h4m6 0h4"/>',layout:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/>',people:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m2-15a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 4v2"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',pin:'<path d="M19 10c0 6-7 11-7 11S5 16 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',check:'<path d="m5 12 4 4L19 6"/>',briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 13h18m-11 0v3h4v-3"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'};
icons.globe='<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18Z"/>';
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.photo}</svg>`;
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain=value=>String(value??'').replace(/<[^>]*>/g,'');
const language={es:'Español',en:'English',de:'Deutsch',fr:'Français',it:'Italiano',sv:'Svenska',hu:'Magyar',hr:'Hrvatski',ru:'Русский','zh-TW':'繁體中文',ja:'日本語'};
let nav=[['overview','Resumen','home'],['arm','Relaciones · ARM','people']];
const collectionFor={gallery:'gallery',videos:'videos',concerts:'concerts',albums:'albums',texts:'site_texts',sections:'site_images'};
const labels={gallery:'Fotografías',videos:'Vídeos',concerts:'Actuaciones',albums:'Discografía',site_texts:'Textos e idiomas',site_images:'Mi sitio'};
const state={data:null,session:null,config:{},filter:'all',search:'',locale:'es',editor:null,editorImage:'',arm:null,armTab:'clients',site:{sections:[]},drafts:{},reviewLocale:'en',translating:false};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const route=()=>{const key=location.hash.slice(1),alias={music:'albums',schedule:'concerts',media:'videos',texts:'settings',sections:'home'};return ['arm','overview','analytics','subscription','social'].includes(key)||state.site.sections.some(row=>row.id===(alias[key]||key))?(alias[key]||key):'overview';};
const imageId=row=>typeof row?.image==='string'?row.image:row?.image?.id;
const image=(row,width=640)=>imageId(row)?`/api/image/${encodeURIComponent(imageId(row))}?w=${width}`:'/artist.webp';
const badge=status=>`<span class="badge ${escapeHtml(status)}">${({published:'Publicado',draft:'Borrador',archived:'Archivado'})[status]||'Borrador'}</span>`;
function closeNav(){$('#sidebar').classList.remove('open');$('#nav-backdrop').hidden=true;$('#mobile-menu').setAttribute('aria-expanded','false');}
let toastTimer;
function toast(message,error=false,persistent=false){const el=$('#toast');el.textContent=message;el.classList.toggle('error',error);el.hidden=false;clearTimeout(toastTimer);if(!persistent)toastTimer=setTimeout(()=>el.hidden=true,5500);}
async function api(path,options={}){
 const response=await fetch(path,{...options,headers:{...(options.body instanceof FormData?{}:options.body?{'Content-Type':'application/json'}:{}),...options.headers},body:options.body instanceof FormData?options.body:options.body===undefined?undefined:JSON.stringify(options.body)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok){const error=new Error(data.error||'No se pudo completar la solicitud.');error.status=response.status;throw error;}return data;
}
function showLogin(error=''){socialUI.reset();reportingUI.reset();state.session=null;state.data=null;state.arm=null;state.editor=null;state.drafts={};$('#editor').close();closeNav();$('#studio-view').hidden=true;$('#login-view').hidden=false;$('#login-error').textContent=error;}
async function reload(){const result=await api('/api/content');state.data=result.content;renderNavigation();render();}
function renderNavigation(){
 $('#navigation').innerHTML=nav.map(([key,title,glyph])=>`<a class="nav-item ${route()===key?'active':''} ${key==='arm'?'arm':''}" href="#${key}" ${route()===key?'aria-current="page"':''}>${icon(glyph)}<span>${title}</span>${['gallery','videos','albums'].includes(key)?`<small class="nav-count">${state.data?.[collectionFor[key]]?.filter(r=>r.status!=='archived').length??''}</small>`:''}</a>`).join('');
 $('#breadcrumb').textContent=nav.find(row=>row[0]===route())?.[1]||'Inicio';
}
function actions(add=true){return `<div class="head-actions"><a class="button quiet" href="${escapeHtml(state.config.preview)}" target="_blank" rel="noopener">Ver sitio ↗</a>${add?`<button class="button primary" data-action="new">＋ ${route()==='gallery'?'Añadir fotos':route()==='videos'?'Nuevo vídeo':route()==='concerts'?'Nueva actuación':'Nuevo álbum'}</button>`:`<button class="button gold" data-action="publish">Actualizar vista previa ↗</button>`}</div>`;}
function heading(title,subtitle,add=true){
 const index=state.site.sections.findIndex(section=>section.id===route());
 return `<header class="page-head editorial-head"><div class="page-head-copy"><span class="eyebrow"><span class="heading-rule" aria-hidden="true"></span> MI UNIVERSO ARTÍSTICO</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div>${actions(add)}${index>=0?`<span class="section-edition" aria-hidden="true">${String(index+1).padStart(2,'0')}</span>`:''}</header>`;
}
function render(){
 if(!state.data)return;
 renderNavigation();const current=route();
 closeNav();
 if(current==='overview')return dashboard();
 if(current==='arm')return renderArm();
 if(current==='social')return socialUI.show();
 if(current==='analytics')return reportingUI.show();
 if(current==='subscription')return reportingUI.subscription();
 const definition=state.site.sections.find(section=>section.id===current);
 if(!definition)return dashboard();
 if(!definition.collection)return renderSiteSection(definition);
 const descriptions={gallery:'Momentos que cuentan tu historia. Elige cómo quieres compartirlos.',videos:'Tu voz, en imágenes. Organiza tus interpretaciones y vídeos oficiales.',concerts:'Cada escenario, una nueva historia. Mantén tu agenda al día.',albums:'Las obras que forman tu universo musical.',texts:'Tu voz también está en las palabras. Cuida cada idioma de tu sitio.',sections:'La imagen de cada espacio de tu sitio, en un solo lugar.'};
 const currentCollection=collectionFor[current];
 $('#main').innerHTML=heading(definition.title,descriptions[current],true)+languagePages(definition)+sectionEditor(definition,true)+translationReview()+
 `<div class="section-tools">${current==='texts'?`<label class="locale-label">Idioma de edición <select class="locale-picker" id="locale">${Object.entries(language).map(([key,label])=>`<option value="${key}" ${state.locale===key?'selected':''}>${label}</option>`).join('')}</select></label>`:`<div class="tabs" role="group" aria-label="Filtrar contenido">${[['all','Todo'],['published','Publicado'],['draft','Borradores'],['archived','Archivado']].map(([key,label])=>`<button class="tab ${state.filter===key?'active':''}" data-filter="${key}">${label}</button>`).join('')}</div>`}<label class="search">${icon('search')}<input id="search" type="search" aria-label="Buscar contenido" placeholder="Buscar en ${labels[currentCollection].toLowerCase()}…" value="${escapeHtml(state.search)}"></label></div><div id="items"></div>${current==='gallery'?`<button class="upload-zone" id="dropzone" data-action="upload">${icon('upload')}<span><strong>Un nuevo momento para tu galería</strong><small>Arrastra tus fotos aquí o haz clic para seleccionarlas.</small></span></button>`:''}`;
 renderItems();renderTranslationReview();
}
function filtered(){return(state.data[collectionFor[route()]]||[]).filter(row=>(state.filter==='all'||row.status===state.filter)&&(route()!=='texts'||row.locale===state.locale)&&(!state.search||[row.title,row.detail,row.credit,row.city,row.venue,row.value].some(value=>plain(value).toLowerCase().includes(state.search.toLowerCase()))));}
function renderItems(){
 const current=route(),rows=filtered();
 if(!rows.length){$('#items').innerHTML=`<div class="empty-state">${icon(current==='concerts'?'calendar':current==='texts'?'text':'photo')}<h2>${state.search?'No encontramos ese contenido.':'Un espacio para lo que viene.'}</h2><p>${state.search?'Prueba con otra palabra o cambia el filtro.':'Añade tu contenido y elige cuándo estará listo para compartir.'}</p></div>`;return;}
 if(current==='concerts'){
  const sorted=[...rows].sort((a,b)=>a.date.localeCompare(b.date));
  $('#items').innerHTML=`<div class="panel table-panel"><table class="content-table"><thead><tr><th>Fecha</th><th>Actuación</th><th>Lugar</th><th>Estado</th><th></th></tr></thead><tbody>${sorted.map(row=>`<tr class="${row.date<today()?'past':''}"><td><strong>${escapeHtml(new Intl.DateTimeFormat('es',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(row.date+'T12:00:00Z')))}</strong><small>${row.date<today()?'Actuación pasada':'Próxima actuación'}</small></td><td><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.ensemble)}</small></td><td>${escapeHtml(row.venue)}<small>${escapeHtml(row.city)}</small></td><td>${badge(row.status)}</td><td><button class="text-link" data-edit="${escapeHtml(row.id)}">Editar ↗</button></td></tr>`).join('')}</tbody></table></div>`;return;
 }
 if(current==='texts'){
  $('#items').innerHTML=`<div class="panel table-panel"><table class="content-table"><thead><tr><th>Contenido</th><th>Tu texto · ${language[state.locale]}</th><th></th></tr></thead><tbody>${rows.slice(0,80).map(row=>`<tr><td><strong>${escapeHtml(textName(row))}</strong><small>${language[row.locale]}</small></td><td class="text-cell"><span>${escapeHtml(plain(row.value))}</span></td><td><button class="text-link" data-edit="${escapeHtml(row.id)}">Editar ↗</button></td></tr>`).join('')}</tbody></table></div><p class="list-note">${rows.length} textos en ${language[state.locale]}.${rows.length>80?' Usa la búsqueda para encontrar un texto concreto.':''}</p>`;return;
 }
 $('#items').innerHTML=`<div class="media-grid">${rows.map(row=>`<article class="media-card"><button class="media-cover ${current==='albums'?'album':''}" data-edit="${escapeHtml(row.id)}" aria-label="Editar ${escapeHtml(row.title)}"><img src="${image(row)}" alt="${escapeHtml(row.title)}" loading="lazy">${badge(row.status)}${current==='videos'?'<span class="play-icon">▶</span>':''}</button><div class="media-meta"><h3>${escapeHtml(row.title)}</h3><p>${escapeHtml(row.credit||row.detail||({hero:'Imagen de inicio',story:'Biografía',press:'Prensa',spirituosi:'Ensemble Spirituosi'})[row.key]||current==='videos'&&'Vídeo de YouTube'||'Nathalie Peña-Comas')}</p><div class="media-bottom"><button class="text-link" data-edit="${escapeHtml(row.id)}">Editar ${current==='gallery'?'fotografía':current==='videos'?'vídeo':current==='albums'?'álbum':'imagen'} ↗</button><div class="reorder">${!['sections','texts'].includes(current)?`<button data-move="${escapeHtml(row.id)}" data-direction="-1" aria-label="Mover antes">↑</button><button data-move="${escapeHtml(row.id)}" data-direction="1" aria-label="Mover después">↓</button>`:''}<button data-archive="${escapeHtml(row.id)}" aria-label="${row.status==='archived'?'Recuperar':'Archivar'} ${escapeHtml(row.title)}">${row.status==='archived'?'↶':'⋯'}</button></div></div></div></article>`).join('')}</div>`;
}
function textName(row){
 const known={storyP1:'La artista · Presentación',storyP2:'La artista · Trayectoria',contactTitle:'Contacto · Título',contactDesc:'Contacto · Presentación',storyTitle:'Biografía · Título',heroDesc:'Inicio · Presentación',heroSub:'Inicio · Subtítulo',privacy:'Privacidad',play:'Reproducir vídeos',announcement:'Anuncio principal',footerNote:'Pie de página'};
 if(row.key?.startsWith('translation:'))return known[row.key.slice(12)]||'Texto del sitio';
 const value=plain(row.value);return value.length>65?value.slice(0,65)+'…':value||'Texto de una sección';
}
function dashboard(){
 const visible=key=>(state.data[key]||[]).filter(row=>row.status!=='archived');
 const events=visible('concerts').filter(row=>row.status==='published'&&row.date>=today()).sort((a,b)=>a.date.localeCompare(b.date));
 const photos=visible('gallery');const next=events[0];
 const stats=[['Fotografías',photos.length,'momentos en tu galería','photo'],['Vídeos',visible('videos').length,'interpretaciones para compartir','video'],['Próximas actuaciones',events.length,'encuentros con tu público','calendar'],['Idiomas',new Set(state.data.site_texts.map(row=>row.locale)).size,'formas de conectar','text']];
 const date=next?new Date(next.date+'T12:00:00Z'):null;
 $('#main').innerHTML=`<header class="page-head"><div><span class="eyebrow">BIENVENIDA A TU STUDIO</span><h1>Tu espacio creativo.</h1><p>Todo lo que necesitas para cuidar tu universo artístico.</p></div>${actions(false)}</header><section class="kpis" aria-label="Resumen del contenido">${stats.map(([label,value,description,glyph])=>`<article class="kpi"><div><label>${label}</label><strong>${value}</strong><small>${description}</small></div><span class="kpi-icon">${icon(glyph)}</span></article>`).join('')}</section><div class="dashboard-grid"><div><section class="panel artist-card"><div class="artist-copy"><span class="eyebrow">UNA VOZ, MUCHAS HISTORIAS</span><h2>El arte de crear.<br>El placer de compartir.</h2><p>Tu música, tus escenarios y los instantes que hacen única tu trayectoria.</p><a class="button primary" href="#home">Editar mi sitio <span>↗</span></a></div><div class="artist-photo"><img src="/artist.webp" alt="Nathalie Peña-Comas — retrato oficial"><small>NATHALIE PEÑA-COMAS</small></div></section><section class="panel recent-panel"><div class="panel-heading"><h2>Instantes de tu galería</h2><a href="#gallery">Ver todas ↗</a></div><div class="recent-grid">${photos.slice(0,3).map(row=>`<a class="recent-photo" href="#gallery"><img src="${image(row,480)}" alt="${escapeHtml(row.title)}"><span>${escapeHtml(row.title)}</span></a>`).join('')}</div></section></div><aside class="dashboard-side"><section class="panel"><div class="panel-heading"><h2>Tu próximo escenario</h2><span class="badge accent">AGENDA</span></div><div class="next-event">${next?`<div class="event-date"><div class="date-square"><strong>${date.getUTCDate()}</strong><span>${new Intl.DateTimeFormat('es',{month:'short',timeZone:'UTC'}).format(date)}</span></div><span class="eyebrow">${new Intl.DateTimeFormat('es',{weekday:'long',timeZone:'UTC'}).format(date)}</span></div><h3>${escapeHtml(next.title)}</h3><p>${escapeHtml(next.ensemble)}</p><div class="event-place">${icon('pin')}<span>${escapeHtml(next.venue)}<br>${escapeHtml(next.city)}</span></div>`:'<h3>Lo próximo está por escribir.</h3><p>Añade una actuación a tu agenda para tenerla siempre a mano.</p>'}<a href="#concerts" class="text-link">Ver mi agenda ↗</a></div></section><section class="panel arm-teaser"><span class="arm-symbol">${icon('people')}</span><h2>Las relaciones que te impulsan.</h2><p>Programadores, representantes y nuevas propuestas. Tu gestión artística, conectada con O7 Pulse.</p><a class="text-link" href="#arm">Entrar en mi ARM <span>↗</span></a></section></aside></div>${languagePages()}<section class="panel site-outline"><div class="panel-heading"><h2>Tu sitio, sección por sección</h2><span class="badge accent">ES → 10 IDIOMAS</span></div><div class="site-outline-grid">${state.site.sections.filter(section=>section.id!=='settings').map((section,index)=>`<a href="#${section.id}"><small>${String(index+1).padStart(2,'0')}</small>${escapeHtml(section.title)}<span>↗</span></a>`).join('')}</div></section>`;
}

function spanishValue(field){return state.data.site_texts.find(row=>row.key===field.key&&row.locale==='es')?.value??field.source;}
function previewUrl(locale,section){
 if(!Object.hasOwn(language,locale))return '';
 const url=new URL(state.config.preview,location.origin);
 url.pathname=`/${locale}/${section?.page==='privacy'?'privacy/':''}`;url.search='';url.hash=section?.anchor||'';
 return url.href;
}
function languagePages(section){
 return `<section class="panel language-pages" aria-label="Páginas del sitio en otros idiomas"><div class="language-intro"><span class="language-symbol">${icon('globe')}</span><div><span class="eyebrow">TU SITIO EN 11 IDIOMAS</span><h2>${section?'Versiones de esta página':'Tu sitio, sin fronteras'}</h2></div><p>El original en español.<br>Diez maneras más de compartirlo.</p></div><nav aria-label="Ver páginas por idioma">${Object.entries(language).map(([locale,name])=>`<a href="${escapeHtml(previewUrl(locale,section))}" data-preview-locale="${locale}" target="_blank" rel="noopener noreferrer" class="language-page ${locale==='es'?'source-page':''}" lang="${locale}"><span>${locale==='zh-TW'?'ZH':locale.toUpperCase()}</span>${name}<small>${locale==='es'?'Original':'↗'}</small></a>`).join('')}</nav></section>`;
}
function sectionEditor(section,collapsed=false){
 const picture=section.image?state.data.site_images.find(row=>row.key===section.image):null;
 const input=field=>{const value=state.drafts[field.key]??spanishValue(field),email=field.source.includes('@')&&!field.source.includes(' '),short=email||['Título','Antetítulo','Texto del enlace'].includes(field.label)&&value.length<160;return `<label class="copy-field"><span>${email?'Correo electrónico':escapeHtml(field.label)} <small>Editable</small></span>${short?`<input type="${email?'email':'text'}" data-text-key="${escapeHtml(field.key)}" value="${escapeHtml(value)}" required>`:`<textarea data-text-key="${escapeHtml(field.key)}" rows="${value.length>250?5:value.length>85?3:2}">${escapeHtml(value)}</textarea>`}</label>`;};
 const main=section.fields.filter(field=>!field.auxiliary),extra=section.fields.filter(field=>field.auxiliary);
 const body=`<div class="section-editor-layout ${picture?'with-photo':''}"><form class="section-copy" data-section-form="${section.id}"><div class="language-banner"><span class="source-language">ES</span><div><strong>Escribe en español.</strong><p>Al guardar, se actualizan automáticamente los otros 10 idiomas.</p></div><span class="badge ${state.config.translationReady?'published':'draft'}">${state.config.translationReady?'Traducción automática':'Traducción no configurada'}</span></div><div class="section-editor-toolbar"><p class="editable-hint"><span aria-hidden="true">✎</span> Los textos en verde se pueden editar.</p><button type="button" class="button translate-button" data-action="translate-again" title="Guarda el español que ves y actualiza sus diez traducciones" ${state.config.translationReady?'':'disabled'}>Traducir a 10 idiomas ↗</button></div><div class="copy-fields">${main.map(input).join('')}</div>${extra.length?`<details class="auxiliary-fields"><summary>Etiquetas y controles · ${extra.length}</summary><div class="copy-fields">${extra.map(input).join('')}</div></details>`:''}<p class="form-error section-save-error" role="alert"></p><footer class="section-save"><p>Después de guardar, actualiza la vista previa para ver los cambios en el sitio.</p><button class="button primary" type="submit" ${section.fields.some(row=>Object.hasOwn(state.drafts,row.key))?'':'disabled'}>Guardar y traducir ↗</button></footer></form>${picture?`<aside class="section-photo-panel"><div class="section-photo-frame"><span class="photo-caption-tag">NATHALIE PEÑA-COMAS</span><img src="${image(picture,960)}" alt="${escapeHtml(section.title)} — imagen actual"></div><div class="section-photo-copy"><span class="eyebrow">IMAGEN DE LA SECCIÓN</span><h2>${escapeHtml(section.title)}</h2><button class="button" data-edit="${escapeHtml(picture.id)}" data-collection="site_images">Cambiar imagen ↗</button></div></aside>`:''}</div>`;
 return collapsed?`<details class="section-copy-panel panel" open><summary><span>${icon('text')} Textos de ${escapeHtml(section.title)}</span><small>${section.fields.length} textos editables · Español → 10 idiomas</small></summary>${body}</details>`:`<section class="panel section-copy-panel">${body}</section>`;
}
function translationReview(){
 return `<details class="panel translation-review"><summary>Ver las traducciones <span>10 idiomas · Solo lectura</span></summary><div class="translation-review-body"><div class="translation-review-tools"><label class="locale-label">Idioma <select id="review-locale">${Object.entries(language).filter(([locale])=>locale!=='es').map(([locale,title])=>`<option value="${locale}" ${state.reviewLocale===locale?'selected':''}>${title}</option>`).join('')}</select></label><a id="translation-page-link" class="text-link" target="_blank" rel="noopener noreferrer">Ver esta página ↗</a></div><div id="translation-preview"></div></div></details>`;
}
function renderSiteSection(section){
 const preview=previewUrl('es',section);
 $('#main').innerHTML=heading(section.title,'Edita esta sección tal como aparece en tu sitio.',false)+`<div class="section-location"><span>${icon('layout')} Mi sitio <span>/</span> ${escapeHtml(section.title)}</span><a class="text-link" href="${escapeHtml(preview)}" target="_blank" rel="noopener">Ver esta sección ↗</a></div>`+languagePages(section)+sectionEditor(section)+translationReview();
 renderTranslationReview();
}
function renderTranslationReview(){
 const target=$('#translation-preview');if(!target)return;
 const section=state.site.sections.find(row=>row.id===route());
 $('#translation-page-link').href=previewUrl(state.reviewLocale,section);
 $('#translation-page-link').textContent=`Ver página · ${language[state.reviewLocale]} ↗`;
 target.innerHTML=[...section.fields.filter(field=>!field.auxiliary),...section.fields.filter(field=>field.auxiliary)].map(field=>{const row=state.data.site_texts.find(row=>row.key===field.key&&row.locale===state.reviewLocale);return `<article class="translated-copy"><strong>${escapeHtml(field.label)}</strong><p>${escapeHtml(row?.value??'Se generará al guardar el original español.')}</p>${row?.auto_translated?'<span class="badge published">Traducido automáticamente</span>':''}</article>`;}).join('');
}
async function submitSection(form,force=false){
 if(state.translating||!form.reportValidity())return;
 const section=state.site.sections.find(row=>row.id===form.dataset.sectionForm),button=form.querySelector('[type=submit]'),translateButton=form.querySelector('[data-action="translate-again"]'),error=form.querySelector('.section-save-error');
 const texts=[...form.querySelectorAll('[data-text-key]')].map(input=>({key:input.dataset.textKey,value:input.value})).filter(row=>force||row.value!==spanishValue(section.fields.find(field=>field.key===row.key)));
 if(!texts.length)return;
 state.translating=true;form.setAttribute('aria-busy','true');for(const control of form.querySelectorAll('input,textarea,button'))control.disabled=true;
 button.textContent='Guardando y traduciendo…';translateButton.textContent='Traduciendo 10 idiomas…';error.textContent='';
 try{
  const result=await api('/api/sections/'+section.id,{method:'POST',body:{texts,...(force?{force:true}:{})}});
  for(const row of texts)if(state.drafts[row.key]===row.value)delete state.drafts[row.key];
  await reload();toast(`${result.changed} ${result.changed===1?'texto guardado':'textos guardados'} · 10 idiomas actualizados.`);
 }catch(problem){error.textContent=problem.message;}
 finally{
  state.translating=false;form.removeAttribute('aria-busy');for(const control of form.querySelectorAll('input,textarea,button'))control.disabled=false;
  button.disabled=!section.fields.some(row=>Object.hasOwn(state.drafts,row.key));button.textContent='Guardar y traducir ↗';translateButton.textContent='Traducir a 10 idiomas ↗';
 }
}
async function saveSection(event){event.preventDefault();await submitSection(event.target);}
window.addEventListener('beforeunload',event=>{if(Object.keys(state.drafts).length||state.translating){event.preventDefault();}});

function findRow(collection,id){return state.data[collection]?.find(row=>String(row.id)===String(id));}
function field(label,name,value,type='text',extra=''){return `<label>${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${extra}></label>`;}
function select(label,name,value,choices){return `<label>${label}<select name="${name}">${choices.map(([key,text])=>`<option value="${key}" ${key===value?'selected':''}>${text}</option>`).join('')}</select></label>`;}
function editorPhoto(){return `<div class="editor-photo ${state.editorImage?'':'empty'}" id="editor-photo">${state.editorImage?`<img src="/api/image/${encodeURIComponent(state.editorImage)}?w=960" alt="Vista previa de la imagen">`:''}<button type="button" class="button" data-action="editor-upload">${state.editorImage?'Cambiar imagen':'Seleccionar fotografía'} ↗</button></div>`;}
function openEditor(id=null,explicitCollection=null){
 const collection=explicitCollection||collectionFor[route()],row=id?findRow(collection,id):{};
 state.editor={collection,id};state.editorImage=imageId(row)||'';
 $('#editor-eyebrow').textContent=labels[collection];$('#editor-title').textContent=id?'Cada detalle cuenta.':'Algo nuevo empieza aquí.';$('#editor-error').textContent='';
 let html='<p class="editable-hint">✎ Los textos en verde se pueden editar.</p>';
 if(['gallery','albums','videos','site_images'].includes(collection))html+=editorPhoto();
 if(collection==='site_texts')html+=`<span class="badge accent">${language[row.locale]}</span><p class="editor-help">${escapeHtml(textName(row))}</p><label>Tu texto<textarea name="value" rows="10">${escapeHtml(row.value)}</textarea></label>`;
 else{
  html+=field(collection==='gallery'?'Nombre de la fotografía':collection==='concerts'?'Nombre de la actuación':'Título','title',row.title||'','text','required');
  if(collection==='gallery')html+=field('Crédito fotográfico','credit',row.credit||'');
  if(collection==='albums')html+=field('Artistas y créditos','detail',row.detail||'')+field('Enlace para escuchar','url',row.url||'','url','required')+select('Repertorio','category',row.category||(['album-2','album-4'].includes(row.id)?'classical':'contemporary'),[['classical','Clásico'],['contemporary','Contemporáneo']]);
  if(collection==='videos')html+=field('Enlace de YouTube','youtube_id',row.youtube_id?`https://www.youtube.com/watch?v=${row.youtube_id}`:'','text','required')+'<p class="editor-help">Pega el enlace de tu vídeo de YouTube. El reproductor se abre cuando el visitante decide verlo.</p>'+field('Obra, escenario y créditos','detail',row.detail||'')+select('Colección','category',row.category||'opera',[['opera','Interpretaciones de ópera'],['film','Vídeos musicales']]);
  if(collection==='concerts')html+=field('Fecha','date',row.date||'','date','required')+field('Orquesta o ensemble','ensemble',row.ensemble||'')+field('Teatro o recinto','venue',row.venue||'')+field('Ciudad y país','city',row.city||'');
 }
 html+=select('Visibilidad','status',row.status||'draft',[['draft','Borrador · Solo en tu Studio'],['published','Publicado · Incluir en la vista previa'],['archived','Archivado · Fuera del sitio']]);
 if(['gallery','albums','videos','concerts'].includes(collection))html+='<p class="editor-help">Escribe en español. Las traducciones se generan automáticamente al guardar; los nombres de artistas y obras se conservan.</p>';
 html+='<p class="editor-help">Guarda tus cambios y actualiza la vista previa cuando todo esté listo.</p>';
 $('#editor-fields').innerHTML=html;$('#editor').showModal();
}
function youtubeId(value){const raw=value.trim();if(/^[A-Za-z\d_-]{11}$/.test(raw))return raw;try{const url=new URL(raw);if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(url.hostname)){const id=url.hostname==='youtu.be'?url.pathname.split('/')[1]:url.searchParams.get('v')||url.pathname.split('/').filter(Boolean).at(-1);if(/^[A-Za-z\d_-]{11}$/.test(id||''))return id;}}catch{}throw new Error('Revisa el enlace de YouTube.');}
async function saveEditor(event){
 event.preventDefault();const button=$('#editor-form button[type=submit]');button.disabled=true;button.textContent='Guardando y traduciendo…';$('#editor-error').textContent='';
 try{
  const {collection,id}=state.editor;const data=Object.fromEntries(new FormData(event.currentTarget));
  if(['gallery','albums','videos','site_images'].includes(collection)){if(!state.editorImage)throw new Error('Selecciona una fotografía para este contenido.');data.image=state.editorImage;}
  if(collection==='videos')data.youtube_id=youtubeId(data.youtube_id);
  await api(`/api/content/${collection}${id?'/'+encodeURIComponent(id):''}`,{method:id?'PATCH':'POST',body:data});
  $('#editor').close();await reload();toast('Cambios guardados. Tu contenido está en buenas manos.');
 }catch(error){$('#editor-error').textContent=error.message;}finally{button.disabled=false;button.innerHTML='Guardar cambios <span>↗</span>';}
}
async function uploadFile(file){const form=new FormData();form.set('file',file);const result=await api('/api/upload',{method:'POST',body:form});return result.data;}
async function uploadPhotos(files){
 if(!files.length)return;if(files.length>30){toast('Selecciona hasta 30 fotografías por lote.',true);return;}
 let done=0;
 try{for(const file of files){toast(`Añadiendo tus fotografías… ${done+1} de ${files.length}`,false,true);const image=await uploadFile(file);await api('/api/content/gallery',{method:'POST',body:{title:file.name.replace(/\.[^.]+$/,'').replace(/[_-]/g,' '),image:image.id,status:'draft',credit:''}});done++;}await reload();toast(`${done} ${done===1?'fotografía añadida':'fotografías añadidas'}. Revísalas antes de compartir.`);}
 catch(error){await reload().catch(()=>{});toast(`${done?done+' fotografías guardadas. ':''}${error.message}`,true);}
}
async function move(id,direction){
 const collection=collectionFor[route()],rows=state.data[collection],index=rows.findIndex(row=>String(row.id)===id),target=index+direction;
 if(target<0||target>=rows.length)return;
 const ids=rows.map(row=>row.id);[ids[index],ids[target]]=[ids[target],ids[index]];
 await api('/api/reorder/'+collection,{method:'POST',body:{ids}});await reload();toast('El orden de tu colección se ha actualizado.');
}
async function renderArm(){
 const connected=state.session.armConnected;
 if(!connected){
  $('#main').innerHTML=heading('Cada relación abre un escenario.','Tu ARM, conectado con nuestro CRM O7 Pulse.',false)+`<section class="panel arm-connect"><div><span class="eyebrow">ARTIST RELATIONSHIP MANAGEMENT</span><h2>Más tiempo para tu arte.<br>Más cerca de tu equipo.</h2><p>Reúne tus contactos profesionales, las propuestas de conciertos y los siguientes pasos de tu carrera en tu propio espacio.</p><div class="arm-benefits"><div>${icon('people')}Programadores, representantes y colaboradores</div><div>${icon('briefcase')}Propuestas y oportunidades profesionales</div><div>${icon('clock')}Seguimiento y tareas de tu equipo</div></div></div><div class="arm-form"><h3>Conectar mi espacio ARM</h3>${state.config.armReady?'<form id="arm-login"><label>Correo de tu cuenta ARM<input name="email" type="email" autocomplete="username" required></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label><p class="form-error" id="arm-error" role="alert"></p><button type="submit" class="button primary wide">Conectar mi cuenta ↗</button></form>':'<div class="pending">El espacio de Nathalie está pendiente de configuración. En cuanto se cree su cuenta y se vincule su suscripción, podrás conectar aquí su gestión artística.</div>'}<p class="editor-help">Este espacio se vincula exclusivamente a la cuenta de Nathalie.</p><a href="https://crm.o7digitalgroup.com/" target="_blank" rel="noopener" class="text-link">Abrir O7 Pulse ↗</a></div></section>`;return;
 }
 if(!state.arm){$('#main').innerHTML='<div class="loading-state"><span class="loader"></span><p>Conectando con tu espacio ARM…</p></div>';try{const result=await Promise.all(['clients','deals','tasks','pipelines'].map(key=>api('/api/arm/'+key)));state.arm=Object.fromEntries(['clients','deals','tasks','pipelines'].map((key,i)=>[key,Array.isArray(result[i])?result[i]:result[i].data||[]]));if(route()==='arm')renderArm();}catch(error){$('#main').innerHTML=`<div class="empty-state"><h2>Tu ARM no está disponible.</h2><p>${escapeHtml(error.message)}</p><button class="button" data-action="retry-arm">Volver a intentar</button></div>`;}return;}
 const titles={clients:'Contactos profesionales',deals:'Propuestas y oportunidades',tasks:'Los siguientes pasos'};
 $('#main').innerHTML=heading('Las relaciones que te impulsan.','Tu gestión artística está conectada con O7 Pulse.',false)+`<div class="section-tools"><div class="tabs">${Object.entries(titles).map(([key,title])=>`<button class="tab ${state.armTab===key?'active':''}" data-arm-tab="${key}">${title}</button>`).join('')}</div><button class="button primary" data-action="new-arm">＋ ${state.armTab==='clients'?'Añadir contacto':state.armTab==='deals'?'Nueva propuesta':'Nueva tarea'}</button></div><div id="arm-content"></div>`;
 const rows=state.arm[state.armTab];
 if(!rows.length){$('#arm-content').innerHTML=`<div class="empty-state">${icon('people')}<h2>Tu próxima conexión empieza aquí.</h2><p>${state.armTab==='clients'?'Añade a las personas que acompañan tu carrera.':state.armTab==='deals'?'Organiza tus propuestas y sus próximos pasos.':'Crea una tarea para no perder de vista lo importante.'}</p></div>`;return;}
 if(state.armTab==='clients')$('#arm-content').innerHTML=`<div class="panel table-panel"><table class="content-table"><thead><tr><th>Contacto</th><th>Organización</th><th>Correo</th><th>Teléfono</th></tr></thead><tbody>${rows.map(row=>`<tr><td><strong>${escapeHtml([row.firstName,row.name].filter(Boolean).join(' '))}</strong><small>${escapeHtml(row.function)}</small></td><td>${escapeHtml(row.company)}</td><td>${escapeHtml(row.email)}</td><td>${escapeHtml(row.phone)}</td></tr>`).join('')}</tbody></table></div>`;
 if(state.armTab==='deals')$('#arm-content').innerHTML=`<div class="kanban">${state.arm.pipelines.flatMap(pipeline=>(pipeline.stages||[]).map(stage=>`<section class="kanban-column"><h2>${escapeHtml(stage.name)} <span class="badge">${rows.filter(row=>row.stageId===stage.id).length}</span></h2>${rows.filter(row=>row.stageId===stage.id).map(row=>`<article class="deal-card"><h3>${escapeHtml(row.title)}</h3><p>${escapeHtml(row.client?.name||'')}</p><strong>${new Intl.NumberFormat('es',{style:'currency',currency:['USD','EUR','MXN','CAD'].includes(row.currency)?row.currency:'USD'}).format(row.value||0)}</strong><label class="card-field">Etapa<select data-deal-stage="${escapeHtml(row.id)}" aria-label="Etapa de ${escapeHtml(row.title)}">${(pipeline.stages||[]).map(option=>`<option value="${escapeHtml(option.id)}" ${row.stageId===option.id?'selected':''}>${escapeHtml(option.name)}</option>`).join('')}</select></label></article>`).join('')}</section>`)).join('')}</div>`;
 if(state.armTab==='tasks')$('#arm-content').innerHTML=`<div class="panel table-panel"><table class="content-table"><thead><tr><th>Tarea</th><th>Contacto</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>${rows.map(row=>`<tr><td><strong>${escapeHtml(row.title)}</strong></td><td>${escapeHtml(row.client?.name||'')}</td><td>${escapeHtml(row.dueDate?.slice(0,10)||'Sin fecha')}</td><td><select class="status-picker" data-task-status="${escapeHtml(row.id)}" aria-label="Estado de ${escapeHtml(row.title)}">${Object.entries({PENDING:'Pendiente',IN_PROGRESS:'En curso',DONE:'Terminada'}).map(([value,label])=>`<option value="${value}" ${row.status===value?'selected':''}>${label}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>`;
}
function newArm(){
 const kind=state.armTab;
 if(kind!=='clients'&&!state.arm.clients.length){toast('Añade primero un contacto profesional.',true);return;}
 if(kind==='deals'&&!state.arm.pipelines.length){toast('Configura primero un pipeline en O7 Pulse.',true);return;}
 state.editor={arm:kind};$('#editor-title').textContent=kind==='clients'?'Una nueva conexión.':kind==='deals'?'Una nueva oportunidad.':'Un siguiente paso.';$('#editor-eyebrow').textContent='TU GESTIÓN ARTÍSTICA';$('#editor-error').textContent='';
 const contacts=state.arm.clients.map(row=>[row.id,[row.firstName,row.name].filter(Boolean).join(' ')]);
 let html=kind==='clients'?field('Nombre','firstName','')+field('Apellidos o nombre profesional','name','','text','required')+field('Organización','company','')+field('Cargo o relación','function','')+field('Correo electrónico','email','','email')+field('Teléfono','phone',''):field(kind==='tasks'?'Tarea':'Propuesta','title','','text','required')+select('Contacto','clientId',contacts[0]?.[0],contacts);
 if(kind==='deals')html+=select('Pipeline','pipelineId',state.arm.pipelines[0].id,state.arm.pipelines.map(row=>[row.id,row.name]))+field('Importe previsto','value','0','number','min="0" step="0.01"')+select('Moneda','currency','USD',[['USD','USD'],['EUR','EUR'],['MXN','MXN'],['CAD','CAD']]);
 if(kind==='tasks')html+=field('Fecha','dueDate','','date')+select('Prioridad','priority','MEDIUM',[['LOW','Normal'],['MEDIUM','Media'],['HIGH','Alta'],['URGENT','Urgente']]);
 $('#editor-fields').innerHTML=html;$('#editor').showModal();
}
document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button)return;
 try{
  if(button.dataset.edit)return openEditor(button.dataset.edit,button.dataset.collection);
  if(button.dataset.filter){state.filter=button.dataset.filter;return render();}
  if(button.dataset.move)return await move(button.dataset.move,Number(button.dataset.direction));
  if(button.dataset.archive){const collection=collectionFor[route()],row=findRow(collection,button.dataset.archive);await api(`/api/content/${collection}/${encodeURIComponent(row.id)}`,{method:'PATCH',body:{status:row.status==='archived'?'draft':'archived'}});await reload();toast(row.status==='archived'?'Contenido recuperado como borrador.':'Contenido archivado. Puedes recuperarlo cuando quieras.');return;}
  if(button.dataset.armTab){state.armTab=button.dataset.armTab;return renderArm();}
  const action=button.dataset.action;
  if(action==='new')return route()==='gallery'?$('#gallery-upload').click():openEditor();
  if(action==='upload')return $('#gallery-upload').click();
  if(action==='editor-upload')return $('#editor-upload').click();
  if(action==='new-arm')return newArm();
  if(action==='retry-arm'){state.arm=null;return renderArm();}
  if(action==='translate-again')return submitSection(button.closest('[data-section-form]'),true);
  if(action==='publish'){button.disabled=true;try{await api('/api/publish',{method:'POST',body:{}});toast('Actualización iniciada. La vista previa mostrará tus cambios cuando termine.');}finally{button.disabled=false;}}
 }catch(error){toast(error.message,true);}
});
document.addEventListener('input',event=>{
 if(event.target.id==='search'){state.search=event.target.value;renderItems();}
 if(event.target.dataset.textKey){const key=event.target.dataset.textKey,definition=state.site.sections.find(section=>section.id===route()),field=definition.fields.find(row=>row.key===key);if(event.target.value===spanishValue(field))delete state.drafts[key];else state.drafts[key]=event.target.value;event.target.closest('form').querySelector('[type=submit]').disabled=!definition.fields.some(row=>Object.hasOwn(state.drafts,row.key));}
});
document.addEventListener('change',async event=>{
 if(event.target.dataset.taskStatus || event.target.dataset.dealStage){
  const control=event.target,task=Boolean(control.dataset.taskStatus),id=control.dataset.taskStatus||control.dataset.dealStage;control.disabled=true;
  try{await api('/api/arm/'+(task?'tasks':'deals')+'/'+encodeURIComponent(id),{method:'PATCH',body:task?{status:control.value}:{stageId:control.value}});state.arm=null;await renderArm();toast('Seguimiento actualizado en O7 Pulse.');}catch(error){toast(error.message,true);state.arm=null;await renderArm();}finally{control.disabled=false;}
  return;
 }

 if(event.target.id==='review-locale'){state.reviewLocale=event.target.value;renderTranslationReview();}
 if(event.target.id==='locale'){state.locale=event.target.value;renderItems();}
 if(event.target.id==='gallery-upload'){await uploadPhotos([...event.target.files]);event.target.value='';}
 if(event.target.id==='editor-upload'){
  const file=event.target.files[0];if(!file)return;try{toast('Preparando tu fotografía…',false,true);const result=await uploadFile(file);state.editorImage=result.id;$('#editor-photo').outerHTML=editorPhoto();toast('Fotografía preparada. Guarda tus cambios para utilizarla.');}catch(error){toast(error.message,true);}event.target.value='';
 }
});
document.addEventListener('dragover',event=>{if(event.target.closest('#dropzone')){event.preventDefault();$('#dropzone').classList.add('dragging');}});
document.addEventListener('dragleave',event=>{if(event.target.closest('#dropzone'))$('#dropzone').classList.remove('dragging');});
document.addEventListener('drop',event=>{if(event.target.closest('#dropzone')){event.preventDefault();$('#dropzone').classList.remove('dragging');uploadPhotos([...event.dataTransfer.files]);}});
$('#editor-form').addEventListener('submit',async event=>{
 if(!state.editor.arm)return saveEditor(event);
 event.preventDefault();const button=event.currentTarget.querySelector('[type=submit]');button.disabled=true;
 try{const data=Object.fromEntries(new FormData(event.currentTarget));if(state.editor.arm==='deals')data.value=Number(data.value);for(const key of Object.keys(data))if(data[key]==='')delete data[key];await api('/api/arm/'+state.editor.arm,{method:'POST',body:data});$('#editor').close();state.arm=null;await renderArm();toast('Guardado en tu espacio O7 Pulse.');}catch(error){$('#editor-error').textContent=error.message;}finally{button.disabled=false;}
});
$('#close-editor').onclick=$('#cancel-editor').onclick=()=>$('#editor').close();
$('#login-form').addEventListener('submit',async event=>{
 event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type=submit]');button.disabled=true;$('#login-error').textContent='';
 try{await api('/api/login',{method:'POST',body:Object.fromEntries(new FormData(form))});form.reset();await startSession();}catch(error){$('#login-error').textContent=error.message;}finally{button.disabled=false;}
});
document.addEventListener('submit',async event=>{
 if(event.target.matches('[data-section-form]'))return saveSection(event);
 if(event.target.id!=='arm-login')return;event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;
 try{await api('/api/arm/connect',{method:'POST',body:Object.fromEntries(new FormData(event.target))});state.session=await api('/api/session');state.arm=null;renderArm();}catch(error){$('#arm-error').textContent=error.message;button.disabled=false;}
});
$('#logout').onclick=async()=>{await api('/api/logout',{method:'POST',body:{}});showLogin();};
$('#mobile-menu').onclick=()=>{const open=$('#sidebar').classList.toggle('open');$('#nav-backdrop').hidden=!open;$('#mobile-menu').setAttribute('aria-expanded',String(open));};
$('#close-nav').onclick=$('#nav-backdrop').onclick=closeNav;
$('#sidebar').addEventListener('click',event=>{if(event.target.closest('a, #logout'))closeNav();});
window.addEventListener('keydown',event=>{if(event.key==='Escape')closeNav();});
window.addEventListener('hashchange',()=>{state.filter='all';state.search='';render();});
async function startSession(){
 state.session=await api('/api/session');$('#login-view').hidden=true;$('#studio-view').hidden=false;
 $('#account-name').textContent=state.session.name||state.session.email?.split('@')[0]||'Mi cuenta';
 $('#today').textContent=new Intl.DateTimeFormat('es',{weekday:'long',day:'numeric',month:'long',timeZone:'America/Mexico_City'}).format(new Date());
 state.site=await api('/api/site-map');nav=[['overview','Resumen','home'],...state.site.sections.map(section=>[section.id,section.title,section.icon]),['arm','Relaciones · ARM','people'],['social','O7 Pulse Social','globe'],['analytics','Analytics & Reporting','layout'],['subscription','Mi suscripción','briefcase']];
 $('#sidebar-preview').href=state.config.preview;
 if(state.config.includedUntil){const date=new Date(state.config.includedUntil);if(Number.isFinite(date.getTime()))$('#workspace-plan').textContent='Hosting incluido hasta el '+new Intl.DateTimeFormat('es',{day:'numeric',month:'long',year:'numeric',timeZone:'America/Mexico_City'}).format(date)+' · Renovación por configurar';}
 await reload();
}
async function init(){try{state.config=await api('/api/config');$('#login-mode-label').hidden=!state.config.armReady;await startSession();}catch(error){showLogin(error.status===401?'':error.message);}}
const socialUI=createSocialUI({api,content:()=>state.data,isCurrent:()=>Boolean(state.session)&&route()==='social',toast});
const reportingUI=createReportingUI({api,session:()=>state.session||{},config:()=>state.config,isCurrent:key=>Boolean(state.session)&&route()===key,toast});
init();
