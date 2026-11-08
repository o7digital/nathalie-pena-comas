// Additive, private collections only. Does not reseed any site copy.
import deployment from '../deployment.json' with {type:'json'};
const base=process.env.DIRECTUS_URL||process.env.PUBLIC_URL,token=process.env.ADMIN_TOKEN;
if(base!==deployment.url||!token)throw new Error('Use the Nathalie dev Directus administrator environment.');
async function api(path,method='GET',body) {
 const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error(`Directus reporting setup failed: ${method} ${path.split('?')[0]} (${response.status})`);
 return (await response.json()).data;
}
const collection='studio_reporting',collections=await api('/collections');
if(!collections.some(c=>c.collection===collection))await api('/collections','POST',{
 collection,schema:{},meta:{icon:'monitoring',hidden:true,note:'Private Studio reporting; never expose through the website build policy.'},
 fields:[
  {field:'id',type:'string',schema:{is_primary_key:true,is_nullable:false,max_length:64}},
  {field:'date',type:'date',schema:{is_nullable:false,is_indexed:true}},
  {field:'provider',type:'string',schema:{is_nullable:false,max_length:40}},
  {field:'payload',type:'json',schema:{is_nullable:false},meta:{special:['cast-json']}},
 ],
});
const users=await api('/users?filter[first_name][_eq]=Studio%20connector&fields=id,policies.policy,role.policies.policy');
if(users.length!==1)throw new Error('Expected the existing Studio connector identity.');
const policyIds=[...(users[0].policies||[]),...(users[0].role?.policies||[])].map(p=>typeof p.policy==='string'?p.policy:p.policy?.id).filter(Boolean);
const policies=await api('/policies?limit=-1');
const policy=policies.find(p=>policyIds.includes(p.id)&&!p.admin_access);
if(!policy)throw new Error('Expected the existing restricted Studio connector policy.');
const permissions=await api('/permissions?limit=-1');
for(const action of ['read','create','update'])if(!permissions.some(p=>p.policy===policy.id&&p.collection===collection&&p.action===action))await api('/permissions','POST',{policy:policy.id,collection,action,permissions:{},validation:{},fields:['*']});
// Verify that neither anonymous users nor the public website build can read reports.
const buildPolicies=policies.filter(p=>p.name==='Website build').map(p=>p.id);
const final=await api('/permissions?limit=-1');
if(final.some(p=>p.collection===collection&&p.action==='read'&&(!p.policy||buildPolicies.includes(p.policy))))throw new Error('Reporting must remain private.');
console.log('Private reporting collection and Studio permissions are ready. Public site permissions unchanged.');
