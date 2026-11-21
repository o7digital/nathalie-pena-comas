const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeHtml=value=>esc(value).replace(/&lt;(\/?(?:em|strong)|br\s*\/?)&gt;/gi,'<$1>');
export const targetKey=target=>target.key?`text:${target.key}`:`${target.collection}:${target.id}:${target.field||'image'}`;
const sizes={desktop:1440,tablet:820,mobile:390};
const names={desktop:'Ordenador',tablet:'Tableta',mobile:'Móvil'};

export function visualEditorMarkup(){
 return `<section class="visual-editor" aria-label="Editor visual de la página">
 <div class="visual-toolbar"><div class="visual-modes" role="group" aria-label="Modo del editor"><button type="button" data-visual-mode="edit" aria-pressed="true">Editar página</button><button type="button" data-visual-mode="preview" aria-pressed="false">Vista previa</button></div><div class="visual-devices" role="group" aria-label="Tamaño de pantalla">${Object.keys(sizes).map(device=>`<button type="button" data-visual-device="${device}" aria-pressed="${device==='desktop'}">${names[device]}</button>`).join('')}</div><button type="button" class="icon-button" data-visual-expand aria-label="Ampliar editor">⛶</button><button type="button" class="button primary" data-visual-save disabled>Guardar y traducir</button></div>
 <div class="visual-status" role="status">Haz clic en un texto o una fotografía para editar.</div>
 <div class="visual-workbench"><div class="visual-canvas"><div class="visual-browser"><span aria-hidden="true">● ● ●</span><span>Tu sitio · Diseño real</span><span class="visual-dimensions">1440 px</span></div><div class="visual-viewport"><div class="visual-frame-wrap"><iframe title="Página de Nathalie · Editor visual" sandbox="allow-same-origin"></iframe></div><div class="visual-loading" role="status"><span class="loader"></span><strong>Preparando tu página…</strong></div></div></div>
 <aside class="visual-inspector" aria-label="Contenido seleccionado"><div class="visual-inspector-tabs"><button type="button" data-inspector="edit" aria-pressed="true">Editar</button><button type="button" data-inspector="contents" aria-pressed="false">Contenido</button></div><div class="visual-inspector-content"><div class="visual-welcome"><span aria-hidden="true">✎</span><h2>Tu página, en tus manos.</h2><p>Haz clic en un texto para escribir directamente sobre el diseño.</p><p>Selecciona una fotografía para cambiarla y ver el resultado al instante.</p><p>Guarda para actualizar los diez idiomas. Después, actualiza la vista previa del sitio.</p></div></div></aside></div>
 <p class="visual-error form-error" role="alert"></p><input class="visual-upload" type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden></section>`;
}

// Persist only the inline formatting supported by the public site's renderer.
export function editorValue(element){
 const visit=node=>{
  if(node.nodeType===3)return node.textContent;
  if(node.nodeType!==1||['SCRIPT','STYLE','IFRAME','OBJECT'].includes(node.tagName))return '';
  const children=[...node.childNodes].map(visit).join('');
  if(node.tagName==='BR')return '<br/>';
  if(['B','STRONG'].includes(node.tagName))return `<strong>${children}</strong>`;
  if(['I','EM'].includes(node.tagName))return `<em>${children}</em>`;
  return ['DIV','P'].includes(node.tagName)?`${children}<br/>`:children;
 };
 return [...element.childNodes].map(visit).join('').replace(/(?:<br\/>)+$/,'');
}

export function mountVisualEditor(root,{section,rows,photos,valueOf,photoOf,onText,onPhoto,onSave,prefs,dirtyCount,busy,canEdit=()=>true}){
 const frame=root.querySelector('iframe'),viewport=root.querySelector('.visual-viewport'),inspector=root.querySelector('.visual-inspector-content');
 const fields=new Map(rows.map(row=>[targetKey(row.target),row])),pictures=new Map(photos.map(row=>[`${row.collection}:${row.id}`,row]));
 // innerText includes CSS text-transform; keep the artist's original capitalization.
 const readValue=(row,node)=>row.rich?editorValue(node):node.textContent.replace(/\n/g,' ');
 const htmlOf=(row,value)=>row.rich?safeHtml(value):esc(value);
 const anyEditable=()=>rows.some(row=>canEdit(row.target))||photos.some(row=>canEdit(row));
 const targets=new Map(),imageNodes=new Map();
 let doc,activated,selected,destroyed=false,mode='edit',device=prefs.device||'desktop',saving=false;
 const listen=(element,type,fn)=>element.addEventListener(type,fn);
 const photoUrl=row=>new URL(`/api/image/${encodeURIComponent(photoOf(row))}?w=1600`,location.origin).href;
 function status(){
  const count=dirtyCount();root.querySelector('.visual-status').textContent=saving?'Guardando y traduciendo…':!anyEditable()?'Esta sección está fijada en SEO. Desbloquéala para editar.':count?`${count} cambio${count===1?'':'s'} sin guardar`:'Haz clic en un texto o una fotografía para editar.';
  root.querySelector('[data-visual-save]').disabled=saving||busy()||!count||!anyEditable();
 }
 function highlight(node){doc?.querySelectorAll('[data-studio-selected]').forEach(el=>el.removeAttribute('data-studio-selected'));node?.setAttribute('data-studio-selected','');}
 function change(row,value,origin){
  if(!canEdit(row.target))return;
  onText(row.target,value);
  for(const node of targets.get(targetKey(row.target))||[])if(node!==origin)node.innerHTML=htmlOf(row,value);
  const input=inspector.querySelector('[data-visual-text]');if(input&&input!==origin&&selected?.row===row)input.innerHTML=htmlOf(row,value);
  status();
 }
 function showText(row,focus=false){
  selected={kind:'text',row};const nodes=targets.get(targetKey(row.target))||[];highlight(nodes[0]);
  inspector.innerHTML=`<span class="visual-kind">TEXTO · ESPAÑOL</span><h2>${esc(row.label)}</h2>${row.rich?'<div class="visual-format" role="group" aria-label="Formato del texto"><button type="button" data-format="bold" aria-label="Negrita"><strong>B</strong></button><button type="button" data-format="italic" aria-label="Cursiva"><em>I</em></button><button type="button" data-format="insertLineBreak">Salto de línea</button></div>':''}<div class="visual-text-input" data-visual-text contenteditable="${row.rich?'true':'plaintext-only'}" role="textbox" aria-multiline="true" aria-label="Texto seleccionado" spellcheck="true">${htmlOf(row,valueOf(row.target))}</div><p>La tipografía y el diseño se conservan. Las traducciones se actualizan al guardar.</p>${nodes.length?'<button type="button" class="button quiet" data-focus-visual>Ir al texto</button>':'<p>Este texto pertenece a un control o contenido desplegable de la sección.</p>'}`;
  const input=inspector.querySelector('[data-visual-text]');
  if(!canEdit(row.target)){input.contentEditable='false';input.setAttribute('aria-readonly','true');inspector.querySelector('.visual-format')?.remove();const note=document.createElement('p');note.className='visual-locked-note';note.textContent='Este texto está fijado en SEO, también cuando se comparte con otra sección. Desbloquea esa sección para modificarlo.';input.after(note);}
  listen(input,'input',()=>change(row,readValue(row,input),input));
  listen(input,'paste',pastePlain);
  if(focus)input.focus();
 }
 function showPhoto(row,node){
  selected={kind:'image',row,node};highlight(node);
  inspector.innerHTML=`<span class="visual-kind">FOTOGRAFÍA</span><h2>${esc(row.label)}</h2><img class="visual-photo" src="${esc(photoUrl(row))}" alt="${esc(row.label)}"><button type="button" class="button primary" data-upload-visual>Cambiar fotografía</button><p>JPG, PNG, WebP o AVIF · Hasta 25 MB.</p><p>Elige una foto y revisa el resultado en la página. Guarda para conservar el cambio.</p>`;
  if(!canEdit(row)){inspector.querySelector('[data-upload-visual]').disabled=true;const note=document.createElement('p');note.className='visual-locked-note';note.textContent='Esta fotografía pertenece a una sección fijada en SEO.';inspector.append(note);}
 }
 function outline(){
  inspector.innerHTML=`<span class="visual-kind">${esc(section.title)}</span><h2>Contenido de la sección</h2><div class="visual-outline">${rows.map((row,index)=>`<button type="button" data-outline-text="${index}"><strong>${esc(row.label)}</strong><span>${esc(String(valueOf(row.target)).replace(/<[^>]*>/g,'').slice(0,100))}</span></button>`).join('')}${photos.map((row,index)=>`<button type="button" data-outline-photo="${index}"><img src="${esc(photoUrl(row))}" alt=""><span>${esc(row.label)}</span></button>`).join('')}</div>`;
 }
 function resize(){
  if(destroyed)return;
  const width=sizes[device],scale=Math.max(.1,Math.min(1,(viewport.clientWidth-24)/width)),height=Math.max(350,viewport.clientHeight-24);
  const wrap=root.querySelector('.visual-frame-wrap');wrap.style.width=`${width*scale}px`;wrap.style.height=`${height}px`;
  frame.style.width=`${width}px`;frame.style.height=`${height/scale}px`;frame.style.transform=`scale(${scale})`;
  root.querySelector('.visual-dimensions').textContent=`${width} px`;
  root.querySelectorAll('[data-visual-device]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.visualDevice===device)));
 }
 function scrollToSection(){
  if(!doc||section.id==='settings')return;
  const target=doc.getElementById(section.anchor);if(!target)return;
  const header=doc.querySelector('body>header');
  doc.defaultView.scrollTo(0,target.getBoundingClientRect().top+doc.defaultView.scrollY-(header?.getBoundingClientRect().height||0)-20);
 }
 function setMode(next){
  mode=next;doc?.body.toggleAttribute('data-studio-readonly',next==='preview');
  for(const [key,nodes]of targets)for(const node of nodes){const editable=canEdit(fields.get(key).target);node.contentEditable=next==='edit'&&editable?(fields.get(key).rich?'true':'plaintext-only'):'false';node.setAttribute('aria-readonly',String(next!=='edit'||!editable));node.toggleAttribute('data-studio-locked',!editable);if(!editable)node.tabIndex=0;}
  root.querySelectorAll('[data-visual-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.visualMode===next)));
  root.classList.toggle('is-preview',next==='preview');if(next==='preview')highlight(null);
 }
 function pastePlain(event){event.preventDefault();event.target.ownerDocument.execCommand('insertText',false,event.clipboardData.getData('text/plain'));}
 function applyPhotos(){
  for(const [key,nodes]of imageNodes){const row=pictures.get(key);for(const node of nodes){node.removeAttribute('srcset');node.closest('picture')?.querySelectorAll('source').forEach(source=>source.removeAttribute('srcset'));node.src=photoUrl(row);}}
 }
 async function save(){
  if(saving||busy()||!dirtyCount()||!anyEditable())return;
  saving=true;status();root.querySelector('.visual-error').textContent='';root.inert=true;
  for(const nodes of targets.values())for(const node of nodes)node.contentEditable='false';
  try{await onSave();}catch(error){if(!destroyed)root.querySelector('.visual-error').textContent=error.message;}
  finally{saving=false;if(!destroyed){root.inert=false;setMode(mode);status();}}
 }
 function activate(){
  if(destroyed)return;doc=frame.contentDocument;
  const loading=root.querySelector('.visual-loading');
  if(!doc?.querySelector('meta[name="nathalie-preview"]')){
   let message='No se pudo abrir la página. Vuelve a intentar.';try{message=JSON.parse(doc.body.textContent).error||message;}catch{}
   loading.innerHTML=`<strong>La página no está disponible.</strong><p>${esc(message)}</p><button type="button" class="button" data-visual-retry>Volver a intentar</button>`;return;
  }
  if(activated===doc)return;activated=doc;targets.clear();imageNodes.clear();
  for(const node of doc.querySelectorAll('[data-studio-text]')){
   let target;try{target=JSON.parse(node.dataset.studioText);}catch{continue;}
   const key=targetKey(target),row=fields.get(key);if(!row)continue;
   node.dataset.studioEditable='';node.setAttribute('role','textbox');node.setAttribute('aria-label',row.label);node.setAttribute('aria-multiline','true');node.spellcheck=true;
   node.innerHTML=htmlOf(row,valueOf(target));if(!targets.has(key))targets.set(key,[]);targets.get(key).push(node);
   listen(node,'focus',()=>{if(mode==='edit'&&selected?.row!==row)showText(row);});
   listen(node,'input',()=>change(row,readValue(row,node),node));listen(node,'paste',pastePlain);
   listen(node,'beforeinput',event=>{if(!canEdit(row.target)){event.preventDefault();return;}if(event.inputType==='insertParagraph'){event.preventDefault();doc.execCommand(row.rich?'insertLineBreak':'insertText',false,row.rich?null:' ');}});
  }
  for(const node of doc.querySelectorAll('img[data-studio-image]')){
   let target;try{target=JSON.parse(node.dataset.studioImage);}catch{continue;}
   const key=`${target.collection}:${target.id}`,row=pictures.get(key);if(!row)continue;
   if(!imageNodes.has(key))imageNodes.set(key,[]);imageNodes.get(key).push(node);
   node.dataset.studioPhoto='';node.tabIndex=0;node.setAttribute('role','button');node.setAttribute('aria-label',`Cambiar fotografía: ${row.label}`);
   listen(node,'click',event=>{if(mode==='edit'){event.preventDefault();event.stopPropagation();showPhoto(row,node);}});
   listen(node,'keydown',event=>{if(mode==='edit'&&['Enter',' '].includes(event.key)){event.preventDefault();showPhoto(row,node);}});
  }
  applyPhotos();setMode(mode);resize();loading.hidden=true;status();
  scrollToSection();
  listen(doc,'click',event=>{
   if(event.target.closest('[data-studio-editable]')){if(mode==='edit')event.preventDefault();}
   else if(event.target.closest('summary'))return;
   else if(event.target.closest('a,button,input,select,textarea'))event.preventDefault();
  });
  listen(doc,'submit',event=>event.preventDefault());
  listen(doc,'keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='s'){event.preventDefault();save();}});
 }
 listen(frame,'load',activate);
 listen(root,'pointerdown',event=>{if(event.target.closest('[data-format]'))event.preventDefault();});
 listen(root,'click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.visualMode)setMode(button.dataset.visualMode);
  if(button.dataset.visualDevice){device=button.dataset.visualDevice;prefs.device=device;resize();requestAnimationFrame(scrollToSection);}
  if(button.hasAttribute('data-visual-expand')){root.classList.toggle('visual-expanded');resize();}
  if(button.hasAttribute('data-visual-save'))save();
  if(button.hasAttribute('data-visual-retry')){loadingPage();}
  if(button.dataset.inspector){root.querySelectorAll('[data-inspector]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));if(button.dataset.inspector==='contents')outline();else if(selected?.kind==='text')showText(selected.row);else if(selected?.kind==='image')showPhoto(selected.row,selected.node);}
  if(button.dataset.outlineText!==undefined){const row=rows[Number(button.dataset.outlineText)];showText(row,true);targets.get(targetKey(row.target))?.[0]?.scrollIntoView({block:'center'});}
  if(button.dataset.outlinePhoto!==undefined){const row=photos[Number(button.dataset.outlinePhoto)],node=imageNodes.get(`${row.collection}:${row.id}`)?.[0];node?.scrollIntoView({block:'center'});showPhoto(row,node);}
  if(button.hasAttribute('data-upload-visual'))root.querySelector('.visual-upload').click();
  if(button.hasAttribute('data-focus-visual')){const node=targets.get(targetKey(selected.row.target))?.[0];node?.scrollIntoView({block:'center'});node?.focus();}
  if(button.dataset.format&&selected?.kind==='text'&&canEdit(selected.row.target)){
   const input=inspector.querySelector('[data-visual-text]');input.focus();document.execCommand(button.dataset.format);change(selected.row,editorValue(input),input);
  }
 });
 listen(root.querySelector('.visual-upload'),'change',async event=>{
  const file=event.target.files[0],target=selected;if(!file||target?.kind!=='image'||!canEdit(target.row))return;
  const button=inspector.querySelector('[data-upload-visual]');button.disabled=true;button.textContent='Subiendo fotografía…';
  try{await onPhoto(target.row,file);if(destroyed)return;applyPhotos();showPhoto(target.row,target.node);status();}
  catch(error){if(!destroyed)root.querySelector('.visual-error').textContent=error.message;}
  finally{event.target.value='';if(!destroyed&&button.isConnected){button.disabled=false;button.textContent='Cambiar fotografía';}}
 });
 function loadingPage(){root.querySelector('.visual-loading').hidden=false;frame.src=`/api/preview?page=${encodeURIComponent(`/${prefs.locale||'es'}/${section.page==='privacy'?'privacy/':''}`)}`;}
 const observer=new ResizeObserver(resize);observer.observe(viewport);loadingPage();resize();status();
 return {refresh(){for(const row of rows)for(const node of targets.get(targetKey(row.target))||[])node.innerHTML=htmlOf(row,valueOf(row.target));applyPhotos();status();},destroy(){destroyed=true;observer.disconnect();frame.removeEventListener('load',activate);root.classList.remove('visual-expanded');}};
}
