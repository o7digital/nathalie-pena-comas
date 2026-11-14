import {contactName,contactKeys,contactFields,contactTypes,contactStatuses,normalized,parseContactsCsv,contactsCsv} from './arm-data.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=row=>new Intl.NumberFormat('es',{style:'currency',currency:['EUR','USD','MXN','CAD'].includes(row.currency)?row.currency:'EUR'}).format(row.value||0);
const day=value=>value?new Intl.DateTimeFormat('es',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value)):'Sin fecha';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const statuses={PENDING:'Pendiente',IN_PROGRESS:'En curso',DONE:'Terminada'};
const priorities={LOW:'Normal',MEDIUM:'Media',HIGH:'Alta',URGENT:'Urgente'};
const input=(label,name,value='',extra='')=>`<label>${label}<input name="${name}" value="${esc(value)}" ${extra}></label>`;
const select=(label,name,value,choices,extra='')=>`<label>${label}<select name="${name}" ${extra}>${choices.map(([key,text])=>`<option value="${esc(key)}" ${key===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
const linked=(row,id)=>row.clientId===id||row.client?.id===id;

export function createArmUI({api,session,config,isCurrent,toast,onConnect}){
 const $=selector=>document.querySelector(selector);
 const state={data:null,tab:'clients',contact:null,query:'',type:'',status:'',organization:'',sort:'name',page:1,taskStatus:'',editor:null,dirty:false,saving:false,importRows:null,importing:false,loading:null,generation:0,fileSelection:0,readingCsv:false};
 const modal=document.createElement('dialog');modal.id='arm-editor';modal.className='arm-modal';document.body.append(modal);
 const requestClose=()=>{if(state.saving||state.importing)return;if(state.dirty&&!window.confirm('¿Cerrar sin guardar los cambios de esta ficha?'))return;state.dirty=false;state.editor=null;state.fileSelection++;state.readingCsv=false;modal.close();};
 modal.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
 modal.addEventListener('input',event=>{if(event.target.closest('#arm-record-form'))state.dirty=true;});
 window.addEventListener('beforeunload',event=>{if(state.dirty||state.importing){event.preventDefault();event.returnValue='';}});
 function reset(){state.fileSelection++;state.readingCsv=false;state.generation++;state.data=null;state.loading=null;state.contact=null;state.tab='clients';state.query='';state.type='';state.status='';state.organization='';state.page=1;state.editor=null;state.dirty=false;state.importRows=null;modal.close();modal.innerHTML='';}
 async function load(){
  if(state.data)return state.data;
  const generation=state.generation;
  if(!state.loading)state.loading=Promise.all(['clients','deals','tasks','pipelines'].map(key=>api('/api/arm/'+key))).then(values=>{
   const data=Object.fromEntries(['clients','deals','tasks','pipelines'].map((key,index)=>[key,values[index]]));
   if(Object.values(data).some(rows=>!Array.isArray(rows)))throw Error('No se pudo cargar la base de relaciones.');
   if(generation===state.generation)state.data=data;return data;
  }).finally(()=>{if(generation===state.generation)state.loading=null;});
  return state.loading;
 }
 async function refresh(){state.data=null;await load();if(isCurrent())await render();}
 function modalBody(title,html,footer=''){
  modal.innerHTML=`<header class="arm-modal-head"><div><span class="eyebrow">RELACIONES · ARM</span><h2>${esc(title)}</h2></div><button type="button" class="icon-button" data-arm-close aria-label="Cerrar ficha">✕</button></header>${html}${footer}`;
  if(!modal.open)modal.showModal();
 }
 const contactById=id=>state.data.clients.find(row=>row.id===id);
 const clientFor=row=>contactById(row.clientId||row.client?.id)||row.client||{};
 function statusBadge(status){return `<span class="arm-badge ${esc(status||'PROSPECT')}">${esc(contactStatuses[status]||'Por contactar')}</span>`;}
 function contactRows(){
  const query=normalized(state.query);
  const rows=state.data.clients.filter(row=>(!query||normalized(contactFields.map(key=>row[key]).join(' ')).includes(query))&&(!state.type||row.companySector===state.type)&&(!state.status||row.clientStatus===state.status)&&(!state.organization||row.company===state.organization));
  rows.sort((a,b)=>state.sort==='recent'?String(b.createdAt||'').localeCompare(String(a.createdAt||'')):normalized(state.sort==='company'?a.company:contactName(a)).localeCompare(normalized(state.sort==='company'?b.company:contactName(b)),'es'));
  return rows;
 }
 function renderContacts(){
  const rows=contactRows(),pages=Math.max(1,Math.ceil(rows.length/25));state.page=Math.min(state.page,pages);
  const shown=rows.slice((state.page-1)*25,state.page*25);
  $('#arm-results').innerHTML=`<div class="arm-result-count" role="status">${rows.length} ${rows.length===1?'contacto':'contactos'}${state.query||state.type||state.status||state.organization?' en esta selección':''}</div>${shown.length?`<div class="arm-table-wrap"><table class="arm-table"><thead><tr><th>Contacto / Organización</th><th>Tipo de relación</th><th>Correo / Teléfono</th><th>Estado</th><th>Seguimiento</th><th><span class="sr-only">Ficha</span></th></tr></thead><tbody>${shown.map(row=>{
   const tasks=state.data.tasks.filter(task=>linked(task,row.id)&&task.status!=='DONE');
   return `<tr><td><button class="arm-person" data-arm-profile="${esc(row.id)}"><span class="arm-initial">${esc(contactName(row).slice(0,1).toUpperCase())}</span><span><strong>${esc(contactName(row))}</strong><small>${esc(row.company||'Sin organización')}${row.function?' · '+esc(row.function):''}</small></span></button></td><td>${esc(row.companySector||'Sin clasificar')}</td><td><span>${esc(row.email||'Sin correo')}</span><small>${esc(row.phone||'Sin teléfono')}</small></td><td>${statusBadge(row.clientStatus)}</td><td><span>${state.data.deals.filter(deal=>linked(deal,row.id)).length} propuestas</span><small>${tasks.length} tareas pendientes</small></td><td><button class="button quiet" data-arm-profile="${esc(row.id)}" aria-label="Abrir ficha de ${esc(contactName(row))}">Ver ficha ↗</button></td></tr>`;
  }).join('')}</tbody></table></div>`:`<div class="arm-empty"><span aria-hidden="true">◎</span><h2>${state.data.clients.length?'No hay contactos con estos filtros.':'Tu base de contactos empieza aquí.'}</h2><p>${state.data.clients.length?'Prueba otro nombre, organización, tipo o estado.':'Crea una ficha completa o importa tu archivo CSV. Cada contacto tendrá sus propuestas, tareas y notas.'}</p><button class="button ${state.data.clients.length?'':'primary'}" ${state.data.clients.length?'data-arm-clear':'data-arm-new="clients"'}>${state.data.clients.length?'Limpiar filtros':'Crear mi primer contacto'}</button></div>`}<footer class="arm-pagination"><span>Página ${state.page} de ${pages}</span><div><button class="button quiet" data-arm-page="-1" ${state.page===1?'disabled':''}>← Anterior</button><button class="button quiet" data-arm-page="1" ${state.page===pages?'disabled':''}>Siguiente →</button></div></footer>`;
 }
 function dealsMarkup(rows){
  return `<div class="arm-pipelines">${state.data.pipelines.map(pipeline=>`<section><header class="arm-subhead"><h2>${esc(pipeline.name)}</h2><span>${rows.filter(row=>row.pipelineId===pipeline.id).length} propuestas</span></header><div class="arm-kanban">${(pipeline.stages||[]).map(stage=>`<section class="arm-stage"><h3>${esc(stage.name)} <span>${rows.filter(row=>row.stageId===stage.id).length}</span></h3>${rows.filter(row=>row.stageId===stage.id).map(row=>`<article class="arm-deal"><button data-arm-edit="deals" data-arm-id="${esc(row.id)}"><strong>${esc(row.title)}</strong><small>${esc(contactName(clientFor(row)))}</small></button><b>${money(row)}</b>${row.expectedCloseDate?`<small>Previsión: ${day(row.expectedCloseDate)}</small>`:''}<label>Etapa<select data-arm-stage="${esc(row.id)}" aria-label="Etapa de ${esc(row.title)}">${pipeline.stages.map(option=>`<option value="${esc(option.id)}" ${option.id===stage.id?'selected':''}>${esc(option.name)}</option>`).join('')}</select></label></article>`).join('')}</section>`).join('')}</div></section>`).join('')}${rows.some(row=>!state.data.pipelines.some(p=>p.stages?.some(s=>s.id===row.stageId)))?`<section class="arm-unassigned"><h3>Propuestas sin etapa visible</h3>${rows.filter(row=>!state.data.pipelines.some(p=>p.stages?.some(s=>s.id===row.stageId))).map(row=>`<button class="button" data-arm-edit="deals" data-arm-id="${esc(row.id)}">${esc(row.title)} · ${money(row)}</button>`).join('')}</section>`:''}</div>`;
 }
 function tasksMarkup(rows){
  if(!rows.length)return '<div class="arm-empty"><h2>No hay tareas en esta selección.</h2><p>Añade un próximo paso desde la ficha de un contacto.</p></div>';
  return `<div class="arm-table-wrap"><table class="arm-table"><thead><tr><th>Tarea / Contacto</th><th>Fecha</th><th>Prioridad</th><th>Estado</th><th>Ficha</th></tr></thead><tbody>${[...rows].sort((a,b)=>String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999'))).map(row=>`<tr><td><strong>${esc(row.title)}</strong><button class="arm-text-button" data-arm-profile="${esc(row.clientId||row.client?.id)}">${esc(contactName(clientFor(row)))}</button></td><td class="${row.status!=='DONE'&&row.dueDate?.slice(0,10)<today()?'arm-overdue':''}">${day(row.dueDate)}</td><td>${esc(priorities[row.priority]||'Media')}</td><td><select data-arm-task="${esc(row.id)}" aria-label="Estado de ${esc(row.title)}">${Object.entries(statuses).map(([value,label])=>`<option value="${value}" ${row.status===value?'selected':''}>${label}</option>`).join('')}</select></td><td><button class="button quiet" data-arm-edit="tasks" data-arm-id="${esc(row.id)}">Editar</button></td></tr>`).join('')}</tbody></table></div>`;
 }
 function profileMarkup(row){
  const proposals=state.data.deals.filter(deal=>linked(deal,row.id)),tasks=state.data.tasks.filter(task=>linked(task,row.id));
  const safeWeb=(()=>{try{const u=new URL(row.website);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}})();
  return `<button class="arm-text-button arm-back" data-arm-back>← Volver a la base de contactos</button><section class="arm-profile-head"><span class="arm-initial large">${esc(contactName(row).slice(0,1))}</span><div><span class="eyebrow">${esc(row.companySector||'CONTACTO PROFESIONAL')}</span><h2>${esc(contactName(row))}</h2><p>${esc(row.function||'')}${row.function&&row.company?' · ':''}${esc(row.company||'')}</p>${statusBadge(row.clientStatus)}</div><button class="button primary" data-arm-edit="clients" data-arm-id="${esc(row.id)}">Editar ficha ↗</button></section><div class="arm-profile-grid"><aside class="panel arm-profile-info"><h3>Datos de contacto</h3><dl><dt>Correo electrónico</dt><dd>${row.email?`<a href="mailto:${esc(encodeURIComponent(row.email))}">${esc(row.email)}</a>`:'Sin correo'}</dd><dt>Teléfono</dt><dd>${row.phone?`<a href="tel:${esc(row.phone.replace(/[^\d+]/g,''))}">${esc(row.phone)}</a>`:'Sin teléfono'}</dd><dt>Web</dt><dd>${safeWeb?`<a href="${esc(safeWeb)}" target="_blank" rel="noopener noreferrer">${esc(row.website)} ↗</a>`:'Sin web'}</dd><dt>Dirección / Ciudad / País</dt><dd>${esc(row.address||'Sin dirección')}</dd><dt>En la base desde</dt><dd>${day(row.createdAt)}</dd><dt>Última actualización de la ficha</dt><dd>${day(row.updatedAt)}</dd></dl><button class="button quiet" data-arm-inactive="${esc(row.id)}">${row.clientStatus==='LOST'?'Reactivar relación':'Marcar como inactivo'}</button></aside><div class="arm-profile-main"><section class="panel arm-notes"><header class="arm-subhead"><h3>Notas de la relación</h3><button class="arm-text-button" data-arm-edit="clients" data-arm-id="${esc(row.id)}">Editar notas</button></header><p>${esc(row.notes||'Añade el contexto de la relación, preferencias y acuerdos para tenerlos siempre a mano.')}</p></section><section class="panel arm-related"><header class="arm-subhead"><h3>Propuestas · ${proposals.length}</h3><button class="button quiet" data-arm-new="deals" data-arm-client="${esc(row.id)}">＋ Nueva propuesta</button></header>${proposals.length?proposals.map(deal=>`<button class="arm-related-row" data-arm-edit="deals" data-arm-id="${esc(deal.id)}"><span><strong>${esc(deal.title)}</strong><small>${esc(state.data.pipelines.flatMap(p=>p.stages||[]).find(stage=>stage.id===deal.stageId)?.name||'Sin etapa')}</small></span><b>${money(deal)}</b><span>↗</span></button>`).join(''):'<p>Todavía no hay propuestas vinculadas a este contacto.</p>'}</section><section class="panel arm-related"><header class="arm-subhead"><h3>Seguimiento · ${tasks.length}</h3><button class="button quiet" data-arm-new="tasks" data-arm-client="${esc(row.id)}">＋ Nueva tarea</button></header>${tasksMarkup(tasks)}</section></div></div>`;
 }
 async function render(){
  if(!isCurrent())return;
  const host=$('#main');
  if(!session()?.armConnected){host.innerHTML=`<section class="panel arm-connect"><div><span class="eyebrow">RELACIONES · ARM</span><h1>Tu base de relaciones profesionales.</h1><p>Contactos, propuestas, notas y seguimiento en un mismo espacio.</p></div><div class="arm-form"><h2>Conectar mi espacio ARM</h2>${config().armReady?'<form id="arm-login"><label>Correo de tu cuenta ARM<input name="email" type="email" required autocomplete="username"></label><label>Contraseña<input name="password" type="password" required autocomplete="current-password"></label><p class="form-error" role="alert"></p><button class="button primary" type="submit">Conectar mi cuenta ↗</button></form>':'<p>El espacio de Nathalie está pendiente de configuración.</p>'}</div></section>`;return;}
  if(!state.data){host.innerHTML='<div class="loading-state"><span class="loader"></span><p>Cargando tu base de relaciones…</p></div>';try{await load();if(isCurrent())return render();}catch(error){if(isCurrent())host.innerHTML=`<div class="arm-empty"><h2>No se pudo cargar tu ARM.</h2><p>${esc(error.message)}</p><button class="button" data-arm-retry>Volver a intentar</button></div>`;}return;}
  const data=state.data,openTasks=data.tasks.filter(row=>row.status!=='DONE');
  host.innerHTML=`<div class="arm-workspace${state.contact?' has-profile':''}"><header class="arm-head"><div><span class="eyebrow">RELACIONES · ARM / NATHALIE PEÑA-COMAS</span><h1>Tu red. Tu próximo escenario.</h1><p>Una base viva para cuidar tus contactos y hacer avanzar cada oportunidad.</p></div><div class="arm-head-actions"><button class="button quiet" data-arm-retry>↻ Actualizar</button><button class="button primary" data-arm-new="clients">＋ Añadir contacto</button></div></header><section class="arm-metrics" aria-label="Resumen de relaciones"><article><span>Contactos</span><strong>${data.clients.length}</strong><small>${data.clients.filter(row=>row.clientStatus==='CLIENT').length} relaciones activas</small></article><article><span>Organizaciones</span><strong>${new Set(data.clients.map(row=>row.company).filter(Boolean)).size}</strong><small>Teatros, agencias y colaboradores</small></article><article><span>Propuestas</span><strong>${data.deals.length}</strong><small>Vinculadas a tus contactos</small></article><article><span>Tareas pendientes</span><strong>${openTasks.length}</strong><small>${openTasks.filter(row=>row.dueDate?.slice(0,10)<today()).length} fuera de plazo</small></article></section><nav class="arm-tabs" aria-label="Vistas de Relaciones ARM">${[['clients','Contactos profesionales'],['deals','Propuestas y oportunidades'],['tasks','Los siguientes pasos']].map(([key,label])=>`<button class="tab ${state.tab===key&&!state.contact?'active':''}" data-arm-tab="${key}" ${state.tab===key&&!state.contact?'aria-current="page"':''}>${label}</button>`).join('')}</nav><section id="arm-content"></section><p class="arm-persistence">Tus fichas se guardan en tu espacio privado de O7 Pulse. No se publican en la web de la artista.</p></div>`;
  const content=$('#arm-content');
  if(state.contact){const row=contactById(state.contact);if(row){content.innerHTML=profileMarkup(row);return;}state.contact=null;}
  if(state.tab==='clients'){
   const types=[...new Set([...contactTypes,...data.clients.map(row=>row.companySector).filter(Boolean)])],orgs=[...new Set(data.clients.map(row=>row.company).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
   content.innerHTML=`<section class="panel arm-database"><div class="arm-database-head"><div><h2>Base de contactos</h2><p>Busca, clasifica y abre una ficha para trabajar su relación.</p></div><div><button class="button quiet" data-arm-import>Importar CSV</button><button class="button quiet" data-arm-export>Exportar selección</button></div></div><div class="arm-filters"><label class="arm-search">Buscar en la base<input type="search" id="arm-search" placeholder="Nombre, organización, correo, ciudad o notas…" value="${esc(state.query)}"></label>${select('Tipo','arm-type',state.type,[['','Todos los tipos'],...types.map(value=>[value,value])])}${select('Estado','arm-status',state.status,[['','Todos los estados'],...Object.entries(contactStatuses)])}${select('Organización','arm-org',state.organization,[['','Todas'],...orgs.map(value=>[value,value])])}${select('Ordenar','arm-sort',state.sort,[['name','Nombre A–Z'],['company','Organización A–Z'],['recent','Más recientes']])}</div><div id="arm-results"></div></section>`;renderContacts();
  }else if(state.tab==='deals')content.innerHTML=`<div class="arm-subhead"><div><h2>Propuestas y oportunidades</h2><p>Abre una propuesta para editarla o cambia su etapa.</p></div><button class="button primary" data-arm-new="deals">＋ Nueva propuesta</button></div>${dealsMarkup(data.deals)}`;
  else content.innerHTML=`<div class="arm-subhead"><div><h2>Los siguientes pasos</h2><p>Fechas, prioridades y seguimiento de cada relación.</p></div><button class="button primary" data-arm-new="tasks">＋ Nueva tarea</button></div><div class="arm-task-filter">${select('Filtrar tareas','arm-task-filter',state.taskStatus,[['','Todos los estados'],...Object.entries(statuses)])}</div>${tasksMarkup(data.tasks.filter(row=>!state.taskStatus||row.status===state.taskStatus))}`;
 }
 function openRecord(kind,id=null,clientId=null){
  const row=id?state.data[kind].find(value=>value.id===id):{};if(!row)return;
  if(kind!=='clients'&&!state.data.clients.length){toast('Añade primero un contacto profesional.',true);return;}
  if(kind==='deals'&&!state.data.pipelines.length){toast('No hay un pipeline disponible para crear la propuesta.',true);return;}
  state.editor={kind,id};state.dirty=false;
  let html;
  if(kind==='clients'){
   const types=[...new Set([...contactTypes,...(row.companySector?[row.companySector]:[])])];
   html=`<div class="arm-form-section"><h3>Identidad y relación</h3><div class="arm-form-grid">${input('Nombre','firstName',row.firstName,'maxlength="120" autocomplete="given-name"')}${input('Apellidos o nombre profesional','name',row.name,'required maxlength="120" autocomplete="family-name"')}${input('Organización','company',row.company,'maxlength="120" autocomplete="organization"')}${input('Cargo o relación','function',row.function,'maxlength="120" autocomplete="organization-title"')}${select('Tipo de relación','companySector',row.companySector||'',[['','Sin clasificar'],...types.map(value=>[value,value])])}${select('Estado de la relación','clientStatus',row.clientStatus||'PROSPECT',Object.entries(contactStatuses))}</div></div><div class="arm-form-section"><h3>Cómo contactar</h3><div class="arm-form-grid">${input('Correo electrónico','email',row.email,'type="email" autocomplete="email"')}${input('Teléfono','phone',row.phone,'type="tel" autocomplete="tel"')}${input('Sitio web','website',row.website,'type="url" placeholder="https://" maxlength="2048"')}${input('Dirección / Ciudad / País','address',row.address,'maxlength="2048" autocomplete="street-address"')}</div></div><div class="arm-form-section"><h3>Contexto y notas</h3><label>Notas de la relación<textarea name="notes" rows="5" maxlength="20000" placeholder="Cómo os conocisteis, preferencias, proyectos y acuerdos…">${esc(row.notes)}</textarea></label><p class="arm-help">Información privada de tu equipo. No aparece en el sitio público.</p>${id?'<p class="arm-help">Puedes sustituir los datos guardados. Por ahora, el CRM no permite dejar vacío un campo que ya tenía contenido.</p>':''}</div>`;
  }else{
   const contacts=[...state.data.clients].sort((a,b)=>contactName(a).localeCompare(contactName(b),'es'));
   html=`<div class="arm-form-section"><div class="arm-form-grid">${input(kind==='tasks'?'Tarea':'Propuesta','title',row.title,'required maxlength="200"')}${select('Contacto','clientId',row.clientId||row.client?.id||clientId||'',[['','Seleccionar contacto…'],...contacts.map(value=>[value.id,contactName(value)+(value.company?' · '+value.company:'')])],'required')}</div></div>`;
   if(kind==='deals'){
    const pipeline=state.data.pipelines.find(value=>value.id===row.pipelineId)||state.data.pipelines[0];
    html+=`<div class="arm-form-section"><div class="arm-form-grid">${select('Pipeline','pipelineId',pipeline.id,state.data.pipelines.map(value=>[value.id,value.name]))}${select('Etapa','stageId',row.stageId||pipeline.stages?.[0]?.id,(pipeline.stages||[]).map(value=>[value.id,value.name]))}${input('Importe previsto','value',row.value??0,'type="number" min="0" step="0.01" required')}${select('Moneda','currency',row.currency||'EUR',['EUR','USD','MXN','CAD'].map(value=>[value,value]))}${input('Fecha prevista de confirmación','expectedCloseDate',row.expectedCloseDate?.slice(0,10),'type="date"')}</div></div>`;
   }else html+=`<div class="arm-form-section"><div class="arm-form-grid">${input('Fecha','dueDate',row.dueDate?.slice(0,10),'type="date"')}${select('Prioridad','priority',row.priority||'MEDIUM',Object.entries(priorities))}${select('Estado','status',row.status||'PENDING',Object.entries(statuses))}</div></div>`;
  }
  modalBody(kind==='clients'?(id?'Editar contacto':'Nuevo contacto profesional'):kind==='deals'?(id?'Editar propuesta':'Nueva propuesta'):(id?'Editar tarea':'Nueva tarea'),`<form id="arm-record-form">${html}<p class="form-error" id="arm-record-error" role="alert"></p><footer class="arm-modal-footer"><button type="button" class="button quiet" data-arm-close>Cancelar</button><button class="button primary" type="submit">Guardar cambios ↗</button></footer></form>`);
 }
 function download(text,filename){const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function importMarkup(){
  const rows=state.importRows||[],invalid=rows.filter(row=>row.error),pending=rows.filter(row=>!row.error&&!row.status),created=rows.filter(row=>row.status==='created'),duplicates=rows.filter(row=>row.status==='duplicate'),failed=rows.filter(row=>row.status==='failed');
  modalBody('Importar tu base de contactos',`<div class="arm-import"><p>Sube un CSV exportado desde Excel o tu agenda. Admitimos coma o punto y coma, campos entre comillas y hasta 500 contactos. Los contactos existentes no se sobrescriben.</p><div class="arm-import-tools"><label class="button quiet">Seleccionar archivo CSV<input type="file" id="arm-csv-file" accept=".csv,text/csv" ${state.importing?'disabled':''}></label><button class="button quiet" data-arm-template ${state.importing?'disabled':''}>Descargar plantilla</button></div><p id="arm-import-error" class="form-error" role="alert"></p>${rows.length?`<div class="arm-import-summary" role="status"><strong>${rows.length} filas</strong><span>${created.length} creadas</span><span>${duplicates.length} ya existentes</span><span>${invalid.length+failed.length} con errores</span><span>${pending.length} pendientes</span></div><div class="arm-table-wrap"><table class="arm-table"><thead><tr><th>Fila</th><th>Contacto</th><th>Organización / Correo</th><th>Resultado</th></tr></thead><tbody>${rows.slice(0,50).map(row=>`<tr><td>${row.line}</td><td>${esc(contactName(row.contact))}</td><td>${esc(row.contact.company)}<small>${esc(row.contact.email)}</small></td><td>${esc(row.error||row.resultError||({created:'Creado',duplicate:'Ya existe · no se importa',failed:'Error al guardar'})[row.status]||'Listo para importar')}</td></tr>`).join('')}</tbody></table></div>${rows.length>50?'<p>Vista previa de las primeras 50 filas. El resumen incluye todo el archivo.</p>':''}`:''}<p class="arm-help">Se detectan duplicados por correo o por nombre completo y organización. Corrige las filas inválidas en el archivo antes de importarlo. Las notas y los contactos son privados.</p></div><footer class="arm-modal-footer"><button type="button" class="button quiet" data-arm-close ${state.importing?'disabled':''}>${created.length?'Cerrar':'Cancelar'}</button><button class="button primary" data-arm-run-import ${state.importing||state.readingCsv||invalid.length||!(pending.length+failed.length)?'disabled':''}>${state.importing?'Guardando contactos…':`Importar ${pending.length+failed.length} contactos`}</button></footer>`);
 }
 async function runImport(){
  if(state.importing||state.readingCsv||!state.importRows||state.importRows.some(row=>row.error))return;
  state.importing=true;
  const pending=state.importRows.filter(row=>!row.status||row.status==='failed');
  try{
   for(let i=0;i<pending.length;i+=50){
    const batch=pending.slice(i,i+50);importMarkup();
    const result=await api('/api/arm/import',{method:'POST',body:{rows:batch.map(row=>row.contact)}});
    if(!Array.isArray(result.results)||result.results.length!==batch.length)throw Error('No se recibió la confirmación de todas las filas. Reintenta: los contactos ya guardados se detectarán como duplicados.');
    for(const item of result.results){const row=batch[item.index];if(!row||!['created','duplicate','failed'].includes(item.status))throw Error('Resultado de importación no válido.');row.status=item.status;row.resultError=item.error;}
    if(result.results.some(row=>row.status==='failed'))break;
   }
   state.data=null;await load();if(isCurrent())await render();
  }catch(error){importMarkup();$('#arm-import-error').textContent=error.message;}
  finally{state.importing=false;const error=$('#arm-import-error')?.textContent;importMarkup();$('#arm-import-error').textContent=error||'';}
 }
 document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||(!isCurrent()&&!modal.open))return;
  try{
   if(button.hasAttribute('data-arm-close'))return requestClose();
   if(button.dataset.armTab){state.tab=button.dataset.armTab;state.contact=null;return render();}
   if(button.hasAttribute('data-arm-back')){state.contact=null;state.tab='clients';return render();}
   if(button.dataset.armProfile){state.contact=button.dataset.armProfile;await render();$('#main').scrollIntoView({block:'start'});return;}
   if(button.dataset.armNew)return openRecord(button.dataset.armNew,null,button.dataset.armClient);
   if(button.dataset.armEdit)return openRecord(button.dataset.armEdit,button.dataset.armId);
   if(button.dataset.armInactive){button.disabled=true;const row=contactById(button.dataset.armInactive);await api('/api/arm/clients/'+encodeURIComponent(row.id),{method:'PATCH',body:{clientStatus:row.clientStatus==='LOST'?'CLIENT':'LOST'}});await refresh();toast('Estado de la relación actualizado.');return;}
   if(button.hasAttribute('data-arm-retry'))return refresh();
   if(button.dataset.armPage){state.page+=Number(button.dataset.armPage);return renderContacts();}
   if(button.hasAttribute('data-arm-clear')){state.query='';state.type='';state.status='';state.organization='';state.page=1;return render();}
   if(button.hasAttribute('data-arm-export')){const rows=contactRows();download(contactsCsv(rows),'nathalie-contactos-'+today()+'.csv');toast(rows.length+' contactos exportados de la selección actual.');return;}
   if(button.hasAttribute('data-arm-import')){state.importRows=null;return importMarkup();}
   if(button.hasAttribute('data-arm-template'))return download(contactsCsv([{firstName:'',name:'',clientStatus:'PROSPECT'}]),'plantilla-contactos-nathalie.csv');
   if(button.hasAttribute('data-arm-run-import'))return runImport();
  }catch(error){toast(error.message,true);button.disabled=false;}
 });
 document.addEventListener('input',event=>{if(event.target.id==='arm-search'){state.query=event.target.value;state.page=1;renderContacts();}});
 document.addEventListener('change',async event=>{
  const control=event.target;let selection;
  try{
   const filters={'arm-type':'type','arm-status':'status','arm-org':'organization','arm-sort':'sort'};
   if(filters[control.name]){state[filters[control.name]]=control.value;state.page=1;return renderContacts();}
   if(control.name==='arm-task-filter'){state.taskStatus=control.value;return render();}
   if(control.name==='pipelineId'&&control.closest('#arm-record-form')){const pipeline=state.data.pipelines.find(row=>row.id===control.value);$('#arm-record-form [name=stageId]').innerHTML=(pipeline?.stages||[]).map(row=>`<option value="${esc(row.id)}">${esc(row.name)}</option>`).join('');}
   if(control.dataset.armTask||control.dataset.armStage){
    control.disabled=true;const task=Boolean(control.dataset.armTask),id=control.dataset.armTask||control.dataset.armStage;
    await api('/api/arm/'+(task?'tasks/':'deals/')+encodeURIComponent(id),{method:'PATCH',body:task?{status:control.value}:{stageId:control.value}});await refresh();toast('Seguimiento actualizado.');
   }
   if(control.id==='arm-csv-file'){
    const file=control.files[0];if(!file)return;selection=++state.fileSelection;state.readingCsv=true;modal.querySelector('[data-arm-run-import]').disabled=true;$('#arm-import-error').textContent='Leyendo el archivo…';if(file.size>2_000_000)throw Error('El CSV puede ocupar como máximo 2 MB.');
    const parsed=parseContactsCsv(await file.text());if(selection!==state.fileSelection||!modal.open)return;state.readingCsv=false;state.importRows=parsed;const keys=new Set(state.data.clients.flatMap(contactKeys));
    for(const row of state.importRows){if(row.error)continue;const own=contactKeys(row.contact);if(own.some(key=>keys.has(key)))row.status='duplicate';else own.forEach(key=>keys.add(key));}importMarkup();
   }
  }catch(error){if(control.id==='arm-csv-file'){if(selection!==state.fileSelection||!modal.open)return;state.readingCsv=false;state.importRows=null;importMarkup();$('#arm-import-error').textContent=error.message;}else{toast(error.message,true);if(control.dataset.armTask||control.dataset.armStage)await refresh();}}finally{control.disabled=false;}
 });
 modal.addEventListener('submit',async event=>{
  if(event.target.id!=='arm-record-form')return;event.preventDefault();if(state.saving)return;
  const button=event.target.querySelector('[type=submit]'),{kind,id}=state.editor;button.disabled=true;state.saving=true;$('#arm-record-error').textContent='';
  try{
   const data=Object.fromEntries(new FormData(event.target));
   if(kind!=='clients')for(const key of Object.keys(data))if(data[key]===''){if(['dueDate','expectedCloseDate'].includes(key)&&id)data[key]=null;else delete data[key];}
   if(kind==='deals')data.value=Number(data.value);
   const saved=await api('/api/arm/'+kind+(id?'/'+encodeURIComponent(id):''),{method:id?'PATCH':'POST',body:data});
   if(!saved?.id)throw Error('El CRM no confirmó el guardado. Conservamos tu formulario.');
   state.dirty=false;state.editor=null;if(kind==='clients')state.contact=saved.id;modal.close();await refresh();toast('Ficha guardada en tu base de relaciones.');
  }catch(error){$('#arm-record-error').textContent=error.message;}finally{state.saving=false;button.disabled=false;}
 });
 document.addEventListener('submit',async event=>{
  if(event.target.id!=='arm-login')return;event.preventDefault();const button=event.target.querySelector('[type=submit]');button.disabled=true;
  try{await api('/api/arm/connect',{method:'POST',body:Object.fromEntries(new FormData(event.target))});await onConnect();state.data=null;await render();}catch(error){event.target.querySelector('.form-error').textContent=error.message;}finally{button.disabled=false;}
 });
 return {render,reset};
}
