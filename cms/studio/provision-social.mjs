import deployment from '../deployment.json' with {type:'json'};
import {SOCIAL_MEDIA_FOLDER} from './social-media.mjs';
const base=process.env.PUBLIC_URL||process.env.DIRECTUS_URL,token=process.env.ADMIN_TOKEN;
if(base!==deployment.url||!token)throw new Error('Use the Nathalie dev Directus administrator environment.');
async function api(path,method='GET',body){
 const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw new Error(`Social media privacy setup failed: ${method} ${path.split('?')[0]} (${r.status})`);
 return r.status===204?null:(await r.json()).data;
}
const folders=await api('/folders?limit=-1');
if(!folders.some(f=>f.id===SOCIAL_MEDIA_FOLDER))await api('/folders','POST',{id:SOCIAL_MEDIA_FOLDER,name:'O7 Social · medios privados'});
const policies=await api('/policies?limit=-1'),connector=policies.find(p=>p.name==='Nathalie Studio');
if(!connector)throw new Error('Expected existing Studio connector policy.');
const permissions=await api('/permissions?limit=-1');
if(!permissions.some(p=>p.policy===connector.id&&p.collection==='directus_folders'&&p.action==='read'))await api('/permissions','POST',{policy:connector.id,collection:'directus_folders',action:'read',permissions:{},fields:['*']});
// Directus Core permits collection-level permissions, not conditional folder filters.
// Keep the website build identity server-only; the website loader uses only media
// referenced by the six public content collections, never this private folder.
console.log('O7 Social media folder ready. Authenticated CMS storage and signed publication windows; existing website file permissions preserved.');
