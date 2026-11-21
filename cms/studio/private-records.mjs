import {createHash} from 'node:crypto';
import {ArmError} from './public/arm-data.js';

// Uses the existing private CMS, with a server-selected tenant and no public grants.
export function createPrivateRecords({request,tenant}){
 const scoped=(owner)=>({_and:[{tenant_id:{_eq:tenant}},...(owner?[{owner_id:{_eq:owner}}]:[])]});
 const collection=kind=>'studio_'+kind;
 async function list(kind,owner){
  const result=await request('/items/'+collection(kind)+'?limit=-1&filter='+encodeURIComponent(JSON.stringify(scoped(owner))));
  if(!Array.isArray(result?.data))throw new ArmError('No se pudieron cargar los datos privados.',502);
  return result.data;
 }
 async function save(kind,id,data,owner){
  const previous=await request('/items/'+collection(kind)+'?limit=1&filter='+encodeURIComponent(JSON.stringify({_and:[scoped(owner),{id:{_eq:id}}]})));
  const exists=previous?.data?.[0];
  const record={...data,id,tenant_id:tenant,...(owner?{owner_id:owner}:{}),updated_at:new Date().toISOString()};
  const result=await request('/items/'+collection(kind)+(exists?'/'+id:''),exists?'PATCH':'POST',record);
  if(!result?.data?.id)throw new ArmError('No se confirmó el guardado privado.',502);
  return result.data;
 }
 return {
  profiles:{
   ready:()=>request('/items/studio_contact_profiles?limit=0'),
   async list(){return (await list('contact_profiles')).map(row=>({id:row.contact_id,...row.classification}));},
   async save(contactId,classification){
    const id=createHash('sha256').update(tenant+'\0'+contactId).digest('hex');
    const rows=await list('contact_profiles'),previous=rows.find(row=>row.contact_id===contactId);
    const merged={...previous?.classification,...classification};
    await save('contact_profiles',id,{contact_id:contactId,classification:merged});
    return merged;
   },
  },
  drafts:{list:owner=>list('mail_drafts',owner),save:(owner,id,draft)=>save('mail_drafts',id,{draft},owner)},
 };
}
