// Additive, private collections in Nathalie's development CMS only.
import deployment from '../deployment.json' with {type:'json'};
const base=process.env.DIRECTUS_URL||process.env.PUBLIC_URL,token=process.env.ADMIN_TOKEN;
if(base!==deployment.url||!token)throw Error('Use the Nathalie dev Directus administrator environment.');
async function api(path,method='GET',data){
 const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`Private contacts setup ${method} ${path.split('?')[0]}: ${response.status}`);return (await response.json()).data;
}
const string=(field,max_length=200)=>({field,type:'string',schema:{is_nullable:false,max_length}});
const common=[{...string('id'),schema:{is_primary_key:true,is_nullable:false,max_length:200}},string('tenant_id'),{field:'updated_at',type:'timestamp',schema:{is_nullable:true}}];
const definitions={
 studio_contact_profiles:[string('contact_id'),{field:'classification',type:'json',schema:{is_nullable:false},meta:{special:['cast-json']}}],
 studio_mail_drafts:[string('owner_id'),{field:'draft',type:'json',schema:{is_nullable:false},meta:{special:['cast-json']}}],
};
const collections=await api('/collections');
for(const [collection,fields]of Object.entries(definitions))if(!collections.some(row=>row.collection===collection))await api('/collections','POST',{collection,schema:{},meta:{icon:'lock',hidden:true,note:'Private Studio contact classifications / mail drafts. Never grant Public or Website build access.'},fields:[...common,...fields]});
const policies=await api('/policies?limit=-1'),policy=policies.find(row=>row.name==='Nathalie Studio'&&!row.admin_access);
if(!policy)throw Error('The restricted Nathalie Studio policy must already exist.');
const permissions=await api('/permissions?limit=-1');
for(const collection of Object.keys(definitions))for(const action of ['read','create','update'])if(!permissions.some(row=>row.policy===policy.id&&row.collection===collection&&row.action===action))await api('/permissions','POST',{policy:policy.id,collection,action,permissions:{},validation:{},fields:['*']});
const website=policies.filter(row=>row.name==='Website build').map(row=>row.id),final=await api('/permissions?limit=-1');
if(final.some(row=>Object.hasOwn(definitions,row.collection)&&(!row.policy||website.includes(row.policy))))throw Error('Contact profiles and mail drafts must stay private.');
console.log('Private dev contact classifications and mail draft storage are ready.');
