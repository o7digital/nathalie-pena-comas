import {randomUUID} from 'node:crypto';
import {parseFragment} from 'parse5';
import {ArmError,contactName,normalized} from './public/arm-data.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const allowed=new Set(['p','br','div','strong','b','em','i','u','ul','ol','li','blockquote','a']);
export function cleanMailHtml(html){
 const fragment=parseFragment(html);let text='';
 function visit(node){
  if(node.nodeName==='#text'){text+=node.value;return escape(node.value);}
  if(['script','style','iframe','object','svg','math','template'].includes(node.tagName))return '';
  if(node.tagName==='br'){text+='\n';return '<br>';}
  const content=(node.childNodes||[]).map(visit).join('');
  if(['p','div','li','blockquote'].includes(node.tagName))text+='\n';
  if(!allowed.has(node.tagName))return content;
  let attribute='';
  if(node.tagName==='a'){
   const href=node.attrs?.find(attr=>attr.name==='href')?.value||'';
   try{const url=new URL(href);if(['https:','http:','mailto:'].includes(url.protocol)&&!url.username&&!url.password)attribute=` href="${escape(url.href)}"`;}catch{}
  }
  return '<'+node.tagName+attribute+'>'+content+'</'+node.tagName+'>';
 }
 const safe=(fragment.childNodes||[]).map(visit).join('');
 return {html:safe,body:text.trim()};
}

export function createOliviaMail({drafts,contacts,fetcher=fetch,origin='https://one.o7digitalgroup.com'}){
 const queues=new Map(),attempts=new Map();
 const serialize=(owner,work)=>{const previous=queues.get(owner)||Promise.resolve(),job=previous.catch(()=>{}).then(work);queues.set(owner,job);job.finally(()=>{if(queues.get(owner)===job)queues.delete(owner);}).catch(()=>{});return job;};
 async function provider(path,mail,method='GET',data){
  let response;
  try{response=await fetcher(origin+path,{method,redirect:'error',headers:{'Content-Type':'application/json',...(mail?{Cookie:mail.cookie,'x-olivia-csrf':mail.csrf}:{})},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(60000)});}catch{throw new ArmError('Olivia One no respondió. Comprueba el estado del mensaje antes de reintentar.',502);}
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new ArmError(response.status===401?'Conecta de nuevo tu buzón Olivia One.':response.status===403?'Olivia One no autorizó la operación. Revisa la conexión.':'Olivia One no pudo completar la operación.',response.status===401?409:502);
  return {result,response};
 }
 const ownerFor=s=>{const owner=String(s.userId||s.email||'').toLowerCase();if(!owner)throw new ArmError('Vuelve a entrar al Studio para abrir tus borradores.',401);return owner;};
 const publicDraft=row=>({id:row.id,...row.draft,updatedAt:row.updated_at});
 async function get(owner,id){const row=(await drafts.list(owner)).find(row=>row.id===id);if(!row)throw new ArmError('Borrador no encontrado.',404);return publicDraft(row);}
 async function recipientRows(token,ids){
  const rows=await contacts(token),byId=new Map(rows.map(row=>[row.id,row]));
  const emails=new Set();
  return ids.map(id=>{const row=byId.get(id);if(!row||!row.email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)||/[\r\n]/.test(row.email))throw new ArmError('Uno de los contactos no tiene un correo válido. Revisa la selección.',422);
   const email=normalized(row.email);if(emails.has(email))throw new ArmError('La selección incluye un correo duplicado. Conserva una sola ficha por destinatario.',422);emails.add(email);return {id,email:row.email,name:contactName(row)};});
 }
 return {
  async status(s){
   if(!s.olivia)return {connected:false,url:origin};
   try{const {result}=await provider('/api/me',s.olivia);return {connected:result.authenticated===true,email:result.user?.email,url:origin};}catch(error){if(error.status===409)return {connected:false,url:origin};throw error;}
  },
  async connect(s,input){
   const owner=ownerFor(s),now=Date.now(),previous=(attempts.get(owner)||[]).filter(time=>now-time<900000);
   if(previous.length>=5)throw new ArmError('Espera unos minutos antes de volver a conectar el buzón.',429);
   if(typeof input?.email!=='string'||!/^\S+@\S+\.\S+$/.test(input.email)||typeof input.password!=='string'||!input.password||input.password.length>1024||input.privacyAccepted!==true)throw new ArmError('Revisa el correo, la contraseña y el aviso de privacidad.');
   attempts.set(owner,[...previous,now]);
   const {response,result}=await provider('/api/auth/login',null,'POST',{email:input.email,password:input.password,privacyAccepted:true,privacyVersion:'2026-08-27'});
   const cookies=response.headers.getSetCookie().map(value=>value.split(';')[0]).filter(value=>/^(?:__Host-olivia_session|olivia_session|olivia_csrf)=/.test(value));
   if(!cookies.some(value=>/^(?:__Host-olivia_session|olivia_session)=/.test(value))||!cookies.some(value=>value.startsWith('olivia_csrf='))||typeof result.csrfToken!=='string')throw new ArmError('No se pudo confirmar la sesión de Olivia One.',502);
   s.olivia={cookie:cookies.join('; '),csrf:result.csrfToken,email:result.user.email};attempts.delete(owner);
   return {connected:true,email:result.user.email};
  },
  async disconnect(s){if(s.olivia)await provider('/api/auth/logout',s.olivia,'POST',{}).catch(()=>{});delete s.olivia;return {connected:false};},
  async list(s){return (await drafts.list(ownerFor(s))).map(publicDraft).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));},
  save(s,token,input){return serialize(ownerFor(s),async()=>{
   if(!input||Object.keys(input).some(key=>!['id','revision','contactIds','subject','html'].includes(key))||!Array.isArray(input.contactIds)||input.contactIds.length>500||input.contactIds.some(id=>typeof id!=='string'||!id.match(/^[\w-]{1,200}$/))||new Set(input.contactIds).size!==input.contactIds.length||typeof input.subject!=='string'||input.subject.length>250||/[\r\n]/.test(input.subject)||typeof input.html!=='string'||input.html.length>100000)throw new ArmError('Revisa el borrador y sus destinatarios.');
   if(input.id&&!/^[\da-f-]{36}$/.test(input.id))throw new ArmError('Borrador no válido.');
   const owner=ownerFor(s),previous=input.id?await get(owner,input.id):null;
   if(previous&&previous.revision!==input.revision)throw new ArmError('Este borrador cambió en otra ventana. Ábrelo de nuevo antes de guardar.',409);
   if(previous&&Object.keys(previous.deliveries||{}).length)throw new ArmError('Este borrador ya tiene intentos de envío. Crea un mensaje nuevo para modificarlo.',409);
   const recipients=await recipientRows(token,input.contactIds),safe=cleanMailHtml(input.html);
   const id=input.id||randomUUID(),draft={contactIds:input.contactIds,recipients,subject:input.subject.trim(),...safe,revision:(previous?.revision||0)+1,deliveries:{}};
   return publicDraft(await drafts.save(owner,id,draft));
  });},
  send(s,token,id,input){return serialize(ownerFor(s),async()=>{
   if(!s.olivia)throw new ArmError('Conecta tu buzón Olivia One para enviar. Tu borrador está guardado.',409);
   const owner=ownerFor(s),draft=await get(owner,id);
   if(input?.revision!==draft.revision||!draft.contactIds.includes(input.contactId))throw new ArmError('Revisa los destinatarios y guarda el borrador antes de enviar.',409);
   if(!draft.subject||!draft.body)throw new ArmError('Escribe el asunto y el mensaje antes de enviar.',422);
   if(draft.deliveries[input.contactId])throw new ArmError('Este destinatario ya tiene un intento de envío. Revisa su estado en Olivia One antes de repetirlo.',409);
   const [current]=await recipientRows(token,[input.contactId]),reviewed=draft.recipients.find(row=>row.id===input.contactId);
   if(current.email!==reviewed?.email)throw new ArmError('El correo del contacto cambió. Crea y revisa un nuevo borrador antes de enviar.',409);
   const update=async status=>{draft.deliveries[input.contactId]={status,at:new Date().toISOString(),email:current.email};const {id:_,updatedAt:__,...data}=draft;await drafts.save(owner,id,data);};
   // Persist the attempt before SMTP: ambiguous timeouts must never silently resend.
   await update('pending');
   try{const {result}=await provider('/api/mail/send',s.olivia,'POST',{to:current.email,cc:'',bcc:'',subject:draft.subject,body:draft.body,html:draft.html,attachments:[]});if(result.status!=='sent'||typeof result.id!=='string')throw new ArmError('Olivia One no confirmó el envío. Revisa la carpeta Enviados.',502);}
   catch(error){await update('unknown');throw error;}
   await update('sent');return {contactId:current.id,status:'sent'};
  });},
 };
}
