// Additive private SEO settings, without changing any content or existing rules.
import deployment from '../deployment.json' with {type:'json'};
const base=process.env.DIRECTUS_URL||process.env.PUBLIC_URL,token=process.env.ADMIN_TOKEN;
if(base!==deployment.url||!token)throw Error('Use the Nathalie dev Directus administrator environment.');
async function api(path,method='GET',data){
 const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`SEO setup ${method} ${path.split('?')[0]}: ${response.status}`);return (await response.json()).data;
}
const collection='studio_seo',collections=await api('/collections');
if(!collections.some(row=>row.collection===collection))await api('/collections','POST',{collection,schema:{},meta:{icon:'lock',hidden:true,note:'Private per-section editorial SEO rules. Never grant public or Website build access.'},fields:[
 {field:'id',type:'string',schema:{is_primary_key:true,is_nullable:false,max_length:80}},
 {field:'locked',type:'boolean',schema:{is_nullable:false,default_value:false}},
 ...['protected_keywords','required_keywords'].map(field=>({field,type:'json',schema:{is_nullable:false},meta:{special:['cast-json']}})),
 {field:'locked_hash',type:'string',schema:{is_nullable:true,max_length:64},meta:{hidden:true,readonly:true}},
 {field:'revision',type:'integer',schema:{is_nullable:false,default_value:1}},
 {field:'updated_at',type:'timestamp',schema:{is_nullable:true}},
]});
const policies=await api('/policies?limit=-1'),policy=policies.find(row=>row.name==='Nathalie Studio'&&!row.admin_access);
if(!policy)throw Error('The restricted Nathalie Studio policy must already exist.');
const permissions=await api('/permissions?limit=-1');
for(const action of ['read','create','update'])if(!permissions.some(row=>row.policy===policy.id&&row.collection===collection&&row.action===action))await api('/permissions','POST',{policy:policy.id,collection,action,permissions:{},validation:{},fields:['*']});
const publicPolicies=policies.filter(row=>row.name==='Website build').map(row=>row.id),final=await api('/permissions?limit=-1');
if(final.some(row=>row.collection===collection&&row.action==='read'&&(!row.policy||publicPolicies.includes(row.policy))))throw Error('SEO settings must stay private.');
console.log('Private SEO collection and existing Studio editor permissions are ready. Site copy and existing SEO rules unchanged.');
