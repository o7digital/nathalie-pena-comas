// Create only Nathalie's designated Studio account. Never rotate the administrator password.
// Credentials are written to a private local handoff file, never to Git or public configuration.
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
const project='1601ae79-f088-42ca-b8d9-0700627bb4c3';
const variables=service=>JSON.parse(execFileSync('railway',['variable','list','--project',project,'--environment','dev','--service',service,'--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const cms=variables('directus'),studio=variables('studio');
const email=studio.STUDIO_CUSTOMER_EMAIL?.trim().toLowerCase();
if(cms.PUBLIC_URL!=='https://directus-dev-9ae1.up.railway.app'||!cms.ADMIN_TOKEN||!email||email===cms.ADMIN_EMAIL?.toLowerCase())throw Error('Use the designated Nathalie customer and Directus dev configuration.');
async function api(path,method='GET',body,token=cms.ADMIN_TOKEN){
 const r=await fetch(cms.PUBLIC_URL+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('Artist account setup '+method+' '+path.split('?')[0]+': '+r.status);
 return (await r.json()).data;
}
const roles=await api('/roles?fields=id,name,policies.policy.id,policies.policy.admin_access,policies.policy.app_access');
const role=roles.find(row=>row.name==='Nathalie Studio');
if(!role||!role.policies?.length||role.policies.some(row=>row.policy.admin_access||row.policy.app_access))throw Error('The non-administrator Studio role must already exist.');
const existing=await api('/users?fields=id,email,first_name,last_name,status,role&filter[email][_eq]='+encodeURIComponent(email));
if(existing.length>1)throw Error('Artist account collision.');
if(!process.argv.includes('--apply')){console.log('Verified the designated artist email and restricted Studio role. Use --apply to create the nathalie login and bind its ARM access.');process.exit(0);}
const output=resolve(process.env.STUDIO_ARTIST_CREDENTIAL_FILE||'/tmp/nathalie-studio-artist-access.json');
let credentials;
try{
 const info=await stat(output);if((info.mode&0o077)!==0)throw Error('The existing credential handoff file is not private.');
 credentials=JSON.parse(await readFile(output,'utf8'));
 if(credentials.email!==email||credentials.username!=='nathalie'||typeof credentials.password!=='string'||credentials.password.length<18)throw Error('Unexpected artist handoff file.');
}catch(error){if(error.code!=='ENOENT')throw error;}
if(existing.length&&!credentials)throw Error('An artist account already exists. Inspect it before resetting any password.');
if(existing.length&&(existing[0].id!==credentials.userId||existing[0].role!==role.id||existing[0].first_name!=='Nathalie'||existing[0].last_name!=='Peña-Comas'||existing[0].status!=='active'))throw Error('The existing artist account does not match this provisioning record.');
if(!credentials){
 credentials={studio:'https://studio-dev-4236.up.railway.app',username:'nathalie',email,password:'Nath-'+randomBytes(12).toString('base64url'),userId:null};
 await writeFile(output,JSON.stringify(credentials,null,2)+'\n',{mode:0o600,flag:'wx'});
}
let artist=existing[0];
if(!artist){
 artist=await api('/users','POST',{email,password:credentials.password,first_name:'Nathalie',last_name:'Peña-Comas',role:role.id,status:'active'});
 credentials.userId=artist.id;await writeFile(output,JSON.stringify(credentials,null,2)+'\n',{mode:0o600});
}
if(studio.STUDIO_ARTIST_USER_ID&&studio.STUDIO_ARTIST_USER_ID!==artist.id)throw Error('A different artist user is already bound to Studio.');
const auth=await api('/auth/login','POST',{email,password:credentials.password,mode:'json'});
const profile=await api('/users/me?fields=id,email,first_name,last_name',undefined,undefined,auth.access_token);
if(profile.id!==artist.id||profile.email&&profile.email.toLowerCase()!==email)throw Error('The new artist login did not return the expected identity.');
const rights=await api('/permissions/me',undefined,undefined,auth.access_token);
for(const collection of ['gallery','albums','videos','concerts','site_images','site_texts'])if(!rights[collection]?.read?.access||rights[collection].read.access==='none'||!rights[collection]?.update?.access||rights[collection].update.access==='none')throw Error('Missing artist Studio permissions for '+collection);
for(const [key,value]of Object.entries({STUDIO_ARTIST_EMAIL:email,STUDIO_ARTIST_USER_ID:artist.id})){
 if(studio[key]===value)continue;
 execFileSync('railway',['variable','set',key,'--stdin','--project',project,'--environment','dev','--service','studio','--skip-deploys','--json'],{input:value,encoding:'utf8',stdio:['pipe','pipe','pipe']});
 console.log('Configured',key);
}
await api('/auth/logout','POST',{refresh_token:auth.refresh_token}).catch(()=>{});
console.log('Nathalie Peña-Comas account verified; restricted Studio role and dedicated ARM identity configured. Private credentials:',output);
