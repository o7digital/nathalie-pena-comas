// Run with the Nathalie Directus dev environment. No CRM customer or billing is created here.
import { request } from 'node:https';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const project='1601ae79-f088-42ca-b8d9-0700627bb4c3';
const base=process.env.PUBLIC_URL,admin=process.env.ADMIN_TOKEN;
if(base!=='https://directus-dev-9ae1.up.railway.app'||!admin)throw new Error('Use the Nathalie Directus dev environment.');
async function api(path,method='GET',body){
 const bytes=body===undefined?undefined:Buffer.from(JSON.stringify(body));
 const result=await new Promise((resolve,reject)=>{const req=request(base+path,{method,headers:{Authorization:`Bearer ${admin}`,'Content-Type':'application/json',...(bytes?{'Content-Length':bytes.length}:{})}},res=>{const chunks=[];res.on('data',part=>chunks.push(part));res.on('end',()=>resolve({status:res.statusCode,value:JSON.parse(Buffer.concat(chunks).toString()||'null')}));});req.on('error',reject);req.setTimeout(30000,()=>req.destroy(new Error('CMS timeout')));req.end(bytes);});
 if(result.status>=400)throw new Error(`CMS setup ${method} ${path}: ${result.status}`);return result.value?.data;
}
function save(service,key,value){const result=spawnSync('railway',['variable','set',key,'--stdin','--project',project,'--environment','dev','--service',service,'--skip-deploys','--json'],{input:value,encoding:'utf8'});if(result.status!==0)throw new Error('Could not configure '+service+'/'+key);console.log('Configured',service,key);}
const policies=await api('/policies?limit=-1');let policy=policies.find(row=>row.name==='Nathalie Studio');
if(!policy)policy=await api('/policies','POST',{name:'Nathalie Studio',icon:'palette',admin_access:false,app_access:false});
const permissions=await api('/permissions?limit=-1');
for(const collection of ['gallery','albums','videos','concerts','site_images','site_texts','directus_files'])for(const action of collection==='directus_files'?['read','create']:['read','create','update']){
 if(!permissions.some(row=>row.policy===policy.id&&row.collection===collection&&row.action===action))await api('/permissions','POST',{policy:policy.id,collection,action,permissions:{},fields:['*']});
}
const roles=await api('/roles?limit=-1');let role=roles.find(row=>row.name==='Nathalie Studio');
if(!role)role=await api('/roles','POST',{name:'Nathalie Studio',icon:'palette',policies:[{policy:policy.id}]});
const users=await api('/users?filter[first_name][_eq]=Studio%20connector&limit=-1');let editorToken=process.env.STUDIO_CONTENT_TOKEN;
if(!users.length){editorToken=randomBytes(32).toString('hex');await api('/users','POST',{first_name:'Studio connector',role:role.id,status:'active',token:editorToken});save('directus','STUDIO_CONTENT_TOKEN',editorToken);}
else if(!editorToken)throw new Error('Recover STUDIO_CONTENT_TOKEN from Railway before rerunning.');
const prior=spawnSync('railway',['variable','list','--project',project,'--service','studio','--environment','dev','--json'],{encoding:'utf8'});
if(prior.status!==0)throw new Error('Studio service must exist before configuration.');
const current=JSON.parse(prior.stdout);
const variables={
 PORT:'4380',RAILWAY_DOCKERFILE_PATH:'cms/studio/Dockerfile',
 DIRECTUS_URL:'${{directus.PUBLIC_URL}}',STUDIO_CONTENT_TOKEN:'${{directus.STUDIO_CONTENT_TOKEN}}',VERCEL_PREVIEW_DEPLOY_HOOK:'${{directus.VERCEL_PREVIEW_DEPLOY_HOOK}}',
 STUDIO_ORIGIN:'https://studio-dev-4236.up.railway.app',STUDIO_PREVIEW_URL:'https://nathalie-pena-comas-git-dev-olivier-steineur.vercel.app/es/',ARM_API_URL:'https://api.crm.o7digitalgroup.com/api',
 STUDIO_SESSION_SECRET:current.STUDIO_SESSION_SECRET||randomBytes(48).toString('hex'),
};
for(const [key,value]of Object.entries(variables))save('studio',key,value);
console.log('Studio configured on Railway dev. CRM tenant binding remains separate.');
