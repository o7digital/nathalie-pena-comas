import {contactName,normalized} from './arm-data.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createOliviaComposer({api,toast}){
 const dialog=document.createElement('dialog');dialog.className='arm-modal olivia-composer';dialog.id='olivia-composer';document.body.append(dialog);
 let recipients=[],draft=null,status={connected:false},dirty=false,busy=false,generation=0,allContacts=[];
 const $=selector=>dialog.querySelector(selector);
 const close=()=>{if(busy)return;if(dirty&&!confirm('¿Cerrar sin guardar los cambios de este borrador?'))return;dirty=false;dialog.close();};
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 window.addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});
 const header=title=>`<header class="arm-modal-head"><div><span class="eyebrow">OLIVIA ONE · NATHALIE</span><h2>${title}</h2></div><button class="icon-button" data-mail-close aria-label="Cerrar correo">✕</button></header>`;
 function render(){
  const attempted=Object.keys(draft?.deliveries||{}).length>0;
  const remaining=attempted?draft.contactIds.filter(id=>!draft.deliveries[id]).length:recipients.length;
  dialog.innerHTML=header('Escribir un correo')+`<div class="olivia-mail-body"><div class="olivia-mail-status"><span>${status.connected?'Conectada: '+esc(status.email):'Buzón pendiente de conexión · Puedes escribir y guardar borradores'}</span>${status.connected?'<button class="arm-text-button" data-mail-disconnect>Desconectar</button>':'<button class="arm-text-button" data-mail-connect-toggle>Conectar más tarde / Configurar</button>'}</div><section class="olivia-connect" hidden><h3>Conectar mi buzón Olivia One</h3><form id="olivia-connect-form"><label>Correo del buzón<input name="email" type="email" required autocomplete="username"></label><label>Contraseña<input name="password" type="password" required autocomplete="current-password"></label><label class="olivia-check"><input name="privacyAccepted" type="checkbox" required> Autorizo a Olivia One a acceder a este buzón para gestionar y enviar mis mensajes. He leído el aviso de privacidad en mi cuenta Olivia One.</label><a href="https://one.o7digitalgroup.com" target="_blank" rel="noopener noreferrer">Abrir Olivia One ↗</a><button class="button" type="submit">Conectar buzón</button></form></section><form id="olivia-draft-form"><fieldset ${attempted?'disabled':''}><legend>Destinatarios · ${recipients.length}</legend><p class="arm-help">La selección incluye todos los resultados filtrados, también los de otras páginas. Cada persona recibirá un correo individual.</p><div class="olivia-recipients">${recipients.map(row=>`<label><input type="checkbox" name="recipient" value="${esc(row.id)}" checked><span><strong>${esc(contactName(row)||row.name)}</strong><small>${esc(row.email)}</small></span></label>`).join('')||'<p>No hay destinatarios con correo en esta selección. Puedes guardar el texto como borrador.</p>'}</div><label>Asunto<input id="olivia-subject" maxlength="250" value="${esc(draft?.subject||'')}" placeholder="Asunto del mensaje"></label><label id="olivia-message-label">Mensaje</label><div class="olivia-toolbar" role="toolbar" aria-label="Formato del mensaje">${[['bold','Negrita','B'],['italic','Cursiva','I'],['underline','Subrayado','U'],['insertUnorderedList','Lista','• Lista'],['removeFormat','Quitar formato','Texto']].map(([command,label,text])=>`<button type="button" data-mail-format="${command}" aria-label="${label}">${text}</button>`).join('')}</div><div id="olivia-message" class="olivia-rich-editor" contenteditable="${!attempted}" role="textbox" aria-labelledby="olivia-message-label" aria-multiline="true"></div></fieldset>${attempted?`<section class="olivia-deliveries"><h3>Estado de los envíos</h3>${Object.values(draft.deliveries).map(item=>`<p>${esc(item.email)} · ${item.status==='sent'?'Enviado':'Pendiente de verificar en Olivia One'}</p>`).join('')}<p>Para evitar duplicados, este mensaje conserva sus intentos de envío.</p></section>`:''}<p class="form-error" id="olivia-mail-error" role="alert"></p><p id="olivia-save-status" role="status">${draft?'Borrador guardado en tu espacio privado.':''}</p><footer class="arm-modal-footer"><button type="button" class="button quiet" data-mail-close>Cerrar</button><button class="button" type="submit" ${attempted?'disabled':''}>Guardar borrador</button><button type="button" class="button primary" data-mail-send ${!status.connected||!remaining?'disabled':''}>${attempted?'Continuar pendientes':'Revisar y enviar'} ↗</button></footer></form></div>`;
  // HTML is sanitized by the server before persistence; paste below is plain text.
  $('#olivia-message').innerHTML=draft?.html||'';
 }
 async function connection(){try{status=await api('/api/arm/mail/status');}catch{status={connected:false};}}
 async function open(rows,saved=null){
  const current=++generation;await connection();if(current!==generation)return;
  const emails=new Set();recipients=rows.filter(row=>row?.email&&!emails.has(normalized(row.email))&&(emails.add(normalized(row.email)),true));
  draft=saved;dirty=false;render();if(!dialog.open)dialog.showModal();
  const skipped=rows.length-recipients.length;if(skipped)toast(skipped+' contactos sin correo o duplicados quedaron fuera de los destinatarios.');
 }
 async function save(){
  const ids=[...dialog.querySelectorAll('[name=recipient]:checked')].map(input=>input.value);
  draft=await api('/api/arm/mail/drafts',{method:'POST',body:{...(draft?{id:draft.id,revision:draft.revision}:{}),contactIds:ids,subject:$('#olivia-subject').value,html:$('#olivia-message').innerHTML}});
  recipients=recipients.filter(row=>ids.includes(row.id));dirty=false;$('#olivia-save-status').textContent='Borrador guardado en tu espacio privado.';return draft;
 }
 async function openDrafts(rows){
  allContacts=rows;const current=++generation;
  const drafts=await api('/api/arm/mail/drafts');if(current!==generation)return;
  dirty=false;dialog.innerHTML=header('Mis borradores')+`<div class="olivia-mail-body">${drafts.length?drafts.map(row=>`<button class="olivia-draft-row" data-mail-draft="${esc(row.id)}"><strong>${esc(row.subject||'Sin asunto')}</strong><small>${row.contactIds.length} destinatarios · ${esc(new Date(row.updatedAt).toLocaleString('es'))}</small></button>`).join(''):'<p>Todavía no hay borradores. Abre una ficha o filtra tus contactos y elige «Escribir a esta selección».</p>'}</div>`;
  dialog._drafts=drafts;if(!dialog.open)dialog.showModal();
 }
 dialog.addEventListener('input',event=>{if(event.target.closest('#olivia-draft-form')){dirty=true;$('#olivia-save-status').textContent='Cambios sin guardar';}});
 dialog.addEventListener('paste',event=>{if(event.target.closest('#olivia-message')){event.preventDefault();document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));}});
 dialog.addEventListener('drop',event=>{if(event.target.closest('#olivia-message'))event.preventDefault();});
 dialog.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||busy)return;
  try{
   if(button.hasAttribute('data-mail-close'))return close();
   if(button.hasAttribute('data-mail-connect-toggle')){$('.olivia-connect').hidden=!$('.olivia-connect').hidden;return;}
   if(button.dataset.mailFormat){$('#olivia-message').focus();document.execCommand(button.dataset.mailFormat);dirty=true;return;}
   if(button.dataset.mailDraft){const saved=dialog._drafts.find(row=>row.id===button.dataset.mailDraft);return open(saved.recipients.map(row=>allContacts.find(contact=>contact.id===row.id)||row),saved);}
   if(button.hasAttribute('data-mail-disconnect')){busy=true;await api('/api/arm/mail/disconnect',{method:'POST',body:{}});status={connected:false};$('.olivia-mail-status span').textContent='Buzón desconectado · Guarda tu borrador para conservar los cambios';$('[data-mail-send]').disabled=true;button.hidden=true;return;}
   if(button.hasAttribute('data-mail-send')){
    const attempted=Object.keys(draft?.deliveries||{}).length>0;
    const count=attempted?draft.contactIds.filter(id=>!draft.deliveries[id]).length:dialog.querySelectorAll('[name=recipient]:checked').length;
    if(!count||!$('#olivia-subject').value.trim()||!$('#olivia-message').textContent.trim())throw Error('Selecciona al menos un destinatario y escribe el asunto y el mensaje.');
    if(!confirm(`¿Enviar este mensaje individualmente a ${count} destinatarios desde ${status.email}? Revisa el asunto, el texto y la selección antes de continuar.`))return;
    busy=true;button.disabled=true;if(!attempted)await save();
    for(const contactId of draft.contactIds.filter(id=>!draft.deliveries[id])){$('#olivia-save-status').textContent='Enviando mensajes individuales…';await api('/api/arm/mail/drafts/'+draft.id+'/send',{method:'POST',body:{revision:draft.revision,contactId}});}
    dirty=false;toast('Mensajes enviados desde Olivia One.');dialog.close();
   }
  }catch(error){const target=$('#olivia-mail-error');if(target)target.textContent=error.message;else toast(error.message,true);if(button.hasAttribute('data-mail-send')){button.disabled=true;$('#olivia-save-status').textContent='Reabre el borrador para revisar el estado de cada envío antes de continuar.';}}
  finally{busy=false;}
 });
 dialog.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;busy=true;const button=event.target.querySelector('[type=submit]');button.disabled=true;
  try{
   $('#olivia-mail-error').textContent='';
   if(event.target.id==='olivia-connect-form'){
    const data=Object.fromEntries(new FormData(event.target));data.privacyAccepted=data.privacyAccepted==='on';
    status=await api('/api/arm/mail/connect',{method:'POST',body:data});event.target.reset();$('.olivia-connect').hidden=true;$('.olivia-mail-status span').textContent='Conectada: '+status.email;$('[data-mail-send]').disabled=!recipients.length;
   }else await save();
  }catch(error){$('#olivia-mail-error').textContent=error.message;}finally{busy=false;button.disabled=false;}
 });
 return {open,openDrafts,reset(){generation++;dirty=false;dialog.close();dialog.innerHTML='';draft=null;recipients=[];status={connected:false};}};
}
