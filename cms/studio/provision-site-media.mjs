// Add native-video fields and a separate website upload folder. Never reseed content.
import deployment from '../deployment.json' with {type:'json'};
import {SITE_VIDEO_FOLDER} from './site-media.mjs';
const base=process.env.PUBLIC_URL||process.env.DIRECTUS_URL,token=process.env.ADMIN_TOKEN;
if(base!==deployment.url||!token)throw Error('Use the Nathalie dev Directus administrator environment.');
async function api(path,method='GET',body){const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`Site media setup ${method} ${path.split('?')[0]}: ${response.status}`);return response.status===204?null:(await response.json()).data;}
const fields=await api('/fields/videos');
if(!fields.some(row=>row.field==='source_type'))await api('/fields/videos','POST',{field:'source_type',type:'string',schema:{is_nullable:true,max_length:20},meta:{interface:'select-dropdown',options:{choices:[{text:'Archivo subido',value:'upload'},{text:'YouTube',value:'youtube'}]}}});
if(!fields.some(row=>row.field==='video_file'))await api('/fields/videos','POST',{field:'video_file',type:'uuid',schema:{is_nullable:true},meta:{interface:'file',special:['file']}});
const relations=await api('/relations');if(!relations.some(row=>row.collection==='videos'&&row.field==='video_file'))await api('/relations','POST',{collection:'videos',field:'video_file',related_collection:'directus_files',schema:{on_delete:'SET NULL'}});
const folders=await api('/folders?limit=-1');if(!folders.some(row=>row.id===SITE_VIDEO_FOLDER))await api('/folders','POST',{id:SITE_VIDEO_FOLDER,name:'Nathalie Studio · vídeos del sitio'});
const policies=await api('/policies?limit=-1'),policy=policies.find(row=>row.name==='Nathalie Studio');if(!policy)throw Error('The existing Studio editor policy is required.');
const permissions=await api('/permissions?limit=-1');if(!permissions.some(row=>row.policy===policy.id&&row.collection==='directus_folders'&&row.action==='read'))await api('/permissions','POST',{policy:policy.id,collection:'directus_folders',action:'read',permissions:{},fields:['*']});
console.log('Website video fields and dedicated upload folder ready. Existing videos and public file permissions unchanged.');
