// Normalize only exact legacy concert labels already translated by the Spanish website.
// Edited values and original names of works are preserved. Writes use the Studio translation pipeline.
import { request } from 'node:https';
const cms=process.env.PUBLIC_URL,origin='https://studio-dev-4236.up.railway.app';
if(cms!=='https://directus-dev-9ae1.up.railway.app'||!process.env.ADMIN_TOKEN||!process.env.ADMIN_EMAIL||!process.env.ADMIN_PASSWORD)throw new Error('Use the Nathalie Directus dev variables.');
const concerts=await new Promise((resolve,reject)=>{
 const req=request(cms+'/items/concerts?limit=-1',{headers:{Authorization:'Bearer '+process.env.ADMIN_TOKEN}},res=>{const chunks=[];res.on('data',part=>chunks.push(part));res.on('end',()=>res.statusCode===200?resolve(JSON.parse(Buffer.concat(chunks).toString()).data):reject(new Error('CMS concert read failed.')));});req.on('error',reject);req.end();
});
const dictionary=new Map([
 ['Inaugural Concert','Concierto inaugural'],['National Symphony Orchestra','Orquesta Sinfónica Nacional'],['Györ Philharmonic Orchestra','Orquesta Filarmónica de Györ'],
 ['Basilica of Györ','Basílica de Györ'],['Punta Cana, Dominican Republic','Punta Cana, República Dominicana'],['Santo Domingo, Dominican Republic','Santo Domingo, República Dominicana'],
 ['Györ, Hungary','Györ, Hungría'],['Vienna, Austria','Viena, Austria'],['Mahler: Symphony Nr. 2 — Resurrection','Mahler: Sinfonía n.º 2 — Resurrección'],
]);
const login=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})});
if(!login.ok)throw new Error('Studio login failed.');
const cookie=login.headers.get('set-cookie').split(';')[0];
try {
 let changed=0;
 for(const row of concerts) {
  if(!/^concert-2026-\d{2}-\d{2}$/.test(row.id))continue;
  const data=Object.fromEntries(['title','ensemble','venue','city'].filter(key=>dictionary.has(row[key])).map(key=>[key,dictionary.get(row[key])]));
  if(!Object.keys(data).length)continue;
  const response=await fetch(origin+'/api/content/concerts/'+row.id,{method:'PATCH',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(data)});
  if(!response.ok)throw new Error('Spanish concert normalization failed: '+response.status);
  changed++;console.log('Spanish original and ten translations saved:',row.id);
 }
 console.log('Legacy concert normalization complete:',changed,'records updated.');
}finally{await fetch(origin+'/api/logout',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:'{}'});}
