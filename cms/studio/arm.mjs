import {ArmError,validateContact,contactKeys,nativeContactFields} from './public/arm-data.js';
import {classificationFields} from './public/contact-classification.js';
import {validDate} from './public/calendar.js';

const fields={deals:['title','value','currency','pipelineId','stageId','clientId','expectedCloseDate'],tasks:['title','clientId','dueDate','status','priority']};
const identifier=value=>typeof value==='string'&&/^[a-zA-Z\d_-]{1,200}$/.test(value);
export function createArm({request,profiles}){
 let queue=Promise.resolve();
 const serialized=work=>{const result=queue.then(work);queue=result.catch(()=>undefined);return result;};
 const list=async(token,resource)=>{
  const result=await request('/'+resource,token);
  if(!Array.isArray(result))throw new ArmError('No se pudo cargar la base de relaciones.',502);
  return result;
 };
 async function contactSave(token,input,id,skipDuplicateCheck=false){
  const data=validateContact(input,{partial:Boolean(id)});
  const classification=Object.fromEntries(Object.entries(data).filter(([key])=>classificationFields.includes(key)));
  const native=Object.fromEntries(Object.entries(data).filter(([key])=>nativeContactFields.includes(key)));
  if(!Object.keys(data).length)throw new ArmError('No hay cambios que guardar.');
  if(Object.keys(classification).length){if(!profiles)throw new ArmError('La clasificación está pendiente de configuración.',503);await profiles.ready();}
  if(id){
   const previous=await request('/clients/'+id,token);
   // The current CRM ignores blank optional strings. Never claim a field was cleared.
   if(Object.entries(native).some(([key,value])=>!value&&previous[key]))throw new ArmError('El CRM todavía no permite vaciar un campo ya guardado. Sustituye su contenido o conserva el valor anterior; no se ha guardado ningún cambio.',422);
  }else if(!skipDuplicateCheck){
   const keys=new Set(contactKeys(data));
   const duplicate=(await list(token,'clients')).some(row=>contactKeys(row).some(key=>keys.has(key)));
   if(duplicate)throw new ArmError('Ya existe un contacto con ese correo o con el mismo nombre y organización. Busca su ficha para actualizarlo.',409);
  }
  const payload=Object.fromEntries(Object.entries(native).filter(([,value])=>value!==''));
  const saved=id&&!Object.keys(payload).length?await request('/clients/'+id,token):await request('/clients'+(id?'/'+id:''),token,id?'PATCH':'POST',payload);
  if(!saved?.id)throw new ArmError('El CRM no confirmó el contacto.',502);
  if(Object.keys(classification).length)try{return {...saved,...await profiles.save(saved.id,classification)};}catch{
   const error=new ArmError('La identidad del contacto se guardó, pero falta confirmar su clasificación. Conservamos el formulario: vuelve a guardar para completarla.',502);error.savedContactId=saved.id;throw error;
  }
  return profiles?{...saved,...(await profiles.list()).find(row=>row.id===saved.id)}:saved;
 }
 async function relationSave(token,resource,input,id){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!fields[resource].includes(key)))throw new ArmError('Campos no permitidos para esta operación ARM.');
  const data={...input};
  for(const [key,value]of Object.entries(data)){
   if(key==='value'){if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new ArmError('El importe debe ser un número positivo o cero.');continue;}
   if(['dueDate','expectedCloseDate'].includes(key)&&value===null&&id)continue;
   if(typeof value!=='string'||value.length>400)throw new ArmError('Revisa el campo '+key+'.');
   data[key]=value.trim();
  }
  if((!id||Object.hasOwn(data,'title'))&&!data.title)throw new ArmError('Escribe un título.');
  if(!id&&!identifier(data.clientId))throw new ArmError('Selecciona un contacto.');
  if(data.clientId){if(!identifier(data.clientId))throw new ArmError('Contacto no válido.');await request('/clients/'+data.clientId,token);}
  for(const key of ['dueDate','expectedCloseDate'])if(data[key]&&!validDate(data[key]))throw new ArmError('Selecciona una fecha válida.');
  if(data.status&&!['PENDING','IN_PROGRESS','DONE'].includes(data.status))throw new ArmError('Estado de tarea no válido.');
  if(data.priority&&!['LOW','MEDIUM','HIGH','URGENT'].includes(data.priority))throw new ArmError('Prioridad no válida.');
  if(resource==='deals'){
   if(!id&&(!identifier(data.pipelineId)||data.value===undefined))throw new ArmError('Selecciona un pipeline y un importe.');
   if(data.currency&&!['USD','EUR','MXN','CAD'].includes(data.currency))throw new ArmError('Moneda no válida.');
   if(data.pipelineId||data.stageId){
    const previous=id?await request('/deals/'+id,token):null;
    const pipelineId=data.pipelineId||previous?.pipelineId;
    if(!identifier(pipelineId))throw new ArmError('Pipeline no válido.');
    const pipeline=await request('/pipelines/'+pipelineId,token);
    if(data.stageId&&!pipeline.stages?.some(stage=>stage.id===data.stageId))throw new ArmError('La etapa no pertenece al pipeline seleccionado.');
   }
  }
  return request('/'+resource+(id?'/'+id:''),token,id?'PATCH':'POST',data);
 }
 return {
  async execute(token,resource,id,method,input){
   if(id&&!identifier(id))throw new ArmError('Identificador no válido.');
   if(!['clients','deals','tasks','pipelines'].includes(resource))throw new ArmError('Recurso no disponible.',404);
   if(method==='GET'){
    if(id){const row=await request('/'+resource+'/'+id,token);return resource==='clients'&&profiles?{...row,...(await profiles.list()).find(profile=>profile.id===id)}:row;}
    const rows=await list(token,resource);
    if(resource==='pipelines')return Promise.all(rows.map(row=>request('/pipelines/'+encodeURIComponent(row.id),token)));
    if(resource==='clients'&&profiles){const byId=new Map((await profiles.list()).map(row=>[row.id,row]));return rows.map(row=>({...row,...byId.get(row.id)}));}
    return rows;
   }
   if(resource==='pipelines'||!((method==='POST'&&!id)||(method==='PATCH'&&id)))throw new ArmError('Operación no disponible.',405);
   return resource==='clients'?serialized(()=>contactSave(token,input,id)):relationSave(token,resource,input,id);
  },
  importContacts(token,input){return serialized(async()=>{
   if(!input||Object.keys(input).some(key=>key!=='rows')||!Array.isArray(input.rows)||!input.rows.length||input.rows.length>50)throw new ArmError('Envía entre 1 y 50 contactos por grupo.');
   // Validate the entire batch before the first write; return every partial outcome explicitly.
   const contacts=input.rows.map(row=>validateContact(row));
   const keys=new Set((await list(token,'clients')).flatMap(contactKeys));
   const results=[];
   for(const [index,contact]of contacts.entries()){
    const own=contactKeys(contact);
    if(own.some(key=>keys.has(key))){results.push({index,status:'duplicate'});continue;}
    try{
     const saved=await contactSave(token,contact,null,true);
     if(!saved?.id)throw new ArmError('El CRM no confirmó el contacto.',502);
     own.forEach(key=>keys.add(key));results.push({index,status:'created',id:saved.id});
    }catch(error){
     results.push({index,status:'failed',error:error.message,...(error.savedContactId?{savedContactId:error.savedContactId}:{})});
     if(!error.status||error.status>=500||[401,403].includes(error.status)){for(let i=index+1;i<contacts.length;i++)results.push({index:i,status:'failed',error:'La importación se detuvo. Comprueba la conexión y tu sesión antes de reintentar.'});break;}
    }
   }
   return {results};
  });},
 };
}
