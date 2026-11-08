import http from 'node:http';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname } from 'node:path';
import siteMap from './site-map.json' with { type: 'json' };
import { translateSpanish,translationWrites,localizedFields,recordTextKey,assertTranslationsReady,sourceHash,targetLocales } from './translations.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fields = {
 gallery: ['title','credit','image'], albums: ['title','detail','url','category','image'],
 videos: ['title','detail','youtube_id','category','image'], concerts: ['title','date','ensemble','venue','city'],
 site_images: ['title','key','image'], site_texts: ['key','locale','value'],
};
const idPattern = /^[a-zA-Z0-9_-]{1,200}$/;
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const locales = ['es','en','de','fr','it','sv','hu','hr','ru','zh-TW','ja'];
class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }

export function createStudioServer(options = {}) {
 const config = {
  cms: process.env.DIRECTUS_URL,
  secret: process.env.STUDIO_SESSION_SECRET,
  origin: process.env.STUDIO_ORIGIN,
  publishHook: process.env.VERCEL_PREVIEW_DEPLOY_HOOK,
  preview: process.env.STUDIO_PREVIEW_URL || 'https://nathalie-pena-comas-git-dev-olivier-steineur.vercel.app/es/',
  crm: process.env.ARM_API_URL || 'https://api.crm.o7digitalgroup.com/api',
  tenant: process.env.ARM_TENANT_ID,
  editorToken: process.env.STUDIO_CONTENT_TOKEN,
  adminEmail: process.env.ARM_ADMIN_EMAIL,
  serviceEmail: process.env.ARM_SERVICE_EMAIL,
  servicePassword: process.env.ARM_SERVICE_PASSWORD,
  includedUntil: process.env.STUDIO_INCLUDED_UNTIL,
  translationKey: process.env.OPENAI_API_KEY,
  translationModel: process.env.TRANSLATION_MODEL || 'gpt-5.4-mini',
  secure: process.env.NODE_ENV === 'production', ...options,
 };
 if (!config.cms || !config.secret || config.secret.length < 32) throw new Error('Configure DIRECTUS_URL and a strong STUDIO_SESSION_SECRET.');
 const encryptionKey = createHash('sha256').update(config.secret).digest();
 const attempts = new Map();
 let imageQueue = Promise.resolve();
 let delegatedToken = null;
 let contentQueue=Promise.resolve();
 const contentWrite=work=>{const job=contentQueue.then(work);contentQueue=job.catch(()=>undefined);return job;};
 const armReady = () => Boolean(config.tenant && config.editorToken);
 const canDelegate = email => armReady() && Boolean(config.adminEmail && config.serviceEmail && config.servicePassword) && email?.toLowerCase() === config.adminEmail.toLowerCase();

 function seal(value) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
 }
 function session(req) {
  try {
   const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('npc_studio='))?.slice(11);
   if (!cookie || cookie.length > 10000) return null;
   const data = Buffer.from(cookie, 'base64url');
   const decipher = createDecipheriv('aes-256-gcm', encryptionKey, data.subarray(0,12));
   decipher.setAuthTag(data.subarray(12,28));
   const value = JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString());
   return value.until > Date.now() ? value : null;
  } catch { return null; }
 }
 function setSession(res, value) {
  const cookie = value ? seal(value) : '';
  if (cookie.length > 3800) throw new ApiError(500, 'La sesión no se pudo guardar.');
  res.setHeader('Set-Cookie', `npc_studio=${cookie}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${value ? 7*86400 : 0}${config.secure ? '; Secure' : ''}`);
 }
 async function upstream(base, path, token, method = 'GET', data) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (data !== undefined && !(data instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(base.replace(/\/$/,'') + path, { method, headers, body: data === undefined ? undefined : data instanceof FormData ? data : JSON.stringify(data), signal: AbortSignal.timeout(60000), redirect: 'error' });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status === 401 ? 401 : response.status === 403 ? 403 : 502, response.status === 401 ? 'Tu sesión ha terminado. Vuelve a entrar.' : response.status === 403 ? 'Tu cuenta no tiene permiso para esta acción.' : 'El servicio no pudo completar la solicitud. Inténtalo de nuevo.');
  return payload;
 }
 async function crmIdentity(token) {
  if (!armReady()) throw new ApiError(409, 'El espacio ARM de Nathalie todavía no está configurado.');
  const result = await upstream(config.crm, '/auth/me', token);
  if (result?.user?.tenantId !== config.tenant) throw new ApiError(403, 'Esta cuenta no pertenece al espacio de Nathalie.');
  return result.user;
 }
 async function crmTokenFor(s) {
  if(s.crmToken) { await crmIdentity(s.crmToken); return s.crmToken; }
  if(s.mode!=='cms' || !canDelegate(s.email)) throw new ApiError(401,'Conecta tu cuenta ARM para continuar.');
  // Resolve the current Directus identity again; never authorize from a submitted email.
  const profile=await upstream(config.cms,'/users/me?fields=id,email',s.access);
  if(!canDelegate(profile?.data?.email)) throw new ApiError(403,'Esta cuenta no tiene acceso de administración ARM.');
  if(!delegatedToken || delegatedToken.until<Date.now()) {
   const result=await upstream(config.crm,'/auth/login',null,'POST',{email:config.serviceEmail,password:config.servicePassword});
   await crmIdentity(result.token);
   delegatedToken={value:result.token,until:Date.now()+300000};
  }
  await crmIdentity(delegatedToken.value);
  return delegatedToken.value;
 }
 async function authenticated(req, res) {
  const s = session(req);
  if (!s) throw new ApiError(401, 'Entra para continuar.');
  if (s.mode === 'arm') {
   await crmIdentity(s.crmToken); s.access = config.editorToken;
  } else if (s.accessUntil < Date.now() + 15000) {
   const result = await upstream(config.cms, '/auth/refresh', null, 'POST', {refresh_token:s.refresh, mode:'json'});
   s.access = result.data.access_token; s.refresh = result.data.refresh_token; s.accessUntil = Date.now() + result.data.expires;
   setSession(res, s);
  }
  return s;
 }
 async function body(req, limit = 262144) {
  if (Number(req.headers['content-length'] || 0) > limit) throw new ApiError(413, 'El archivo es demasiado grande. El máximo es 25 MB.');
  const chunks=[]; let size=0;
  for await (const chunk of req) { size+=chunk.length; if (size>limit) throw new ApiError(413,'El archivo supera el tamaño permitido.'); chunks.push(chunk); }
  return Buffer.concat(chunks);
 }
 async function jsonBody(req) { try { return JSON.parse((await body(req)).toString() || '{}'); } catch(error) { if(error instanceof ApiError) throw error; throw new ApiError(400,'Revisa los datos del formulario.'); } }
 function send(res, value, status = 200) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(value)); }
 async function textsFor(token) { return (await upstream(config.cms,'/items/site_texts?limit=-1&fields=*',token)).data; }
 async function requireWrite(token,collection,action,needed=[]) {
  const permissions=await upstream(config.cms,'/permissions/me',token);
  const permission=(permissions.data||permissions)?.[collection]?.[action];
  if(!permission?.access || permission.access==='none' || (Array.isArray(permission.fields) && !permission.fields.includes('*') && needed.some(field=>!permission.fields.includes(field))))throw new ApiError(403,'Tu cuenta no tiene permiso para guardar estos cambios.');
 }
 async function persistTexts(rows,current,token) {
  const existing=new Set(current.map(row=>row.id));
  const creates=rows.filter(row=>!existing.has(row.id)),updates=rows.filter(row=>existing.has(row.id));
  if(creates.length)await upstream(config.cms,'/items/site_texts',token,'POST',creates);
  if(updates.length)await upstream(config.cms,'/items/site_texts',token,'PATCH',updates);
 }
 async function prepareSources(sources,current,token) {
  if(!sources.length)return [];
  await requireWrite(token,'site_texts','create',['key','locale','value','source_hash']);
  await requireWrite(token,'site_texts','update',['value','source_hash']);
  let translated;
  try{translated=config.translate?await config.translate(sources):await translateSpanish(sources,{key:config.translationKey,model:config.translationModel});}
  catch(error){throw new ApiError(503,error.message);}
  return translationWrites(sources,translated,current);
 }
 function validate(collection, input, creating) {
  const allowed = new Set([...fields[collection], 'status', 'sort']);
  if (Object.keys(input).some(k => !allowed.has(k))) throw new ApiError(400,'El formulario contiene campos no permitidos.');
  if (input.status && !['draft','published','archived'].includes(input.status)) throw new ApiError(400,'El estado no es válido.');
  if (input.sort !== undefined && (!Number.isInteger(input.sort) || input.sort < 0)) throw new ApiError(400,'El orden no es válido.');
  for (const [key,value] of Object.entries(input)) if (key !== 'sort' && value !== null && (typeof value !== 'string' || value.length>12000)) throw new ApiError(400,'Revisa el contenido del formulario.');
  if (input.image && !uuid.test(input.image)) throw new ApiError(400,'Selecciona una imagen válida.');
  if (input.url) { let link; try {link=new URL(input.url);} catch{} if(!link || link.protocol!=='https:' || link.username || link.password) throw new ApiError(400,'El enlace debe empezar por https://.'); }
  if (input.youtube_id && !/^[A-Za-z\d_-]{11}$/.test(input.youtube_id)) throw new ApiError(400,'Introduce un enlace o identificador de YouTube válido.');
  if (input.date && (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date)))) throw new ApiError(400,'Selecciona una fecha válida.');
  if (input.locale && !locales.includes(input.locale)) throw new ApiError(400,'Selecciona un idioma disponible.');
  if (creating && collection !== 'site_texts' && !input.title?.trim()) throw new ApiError(400,'Escribe un título.');
  return input;
 }
 async function serve(req, res) {
  const url = new URL(req.url, 'http://studio.local'), path=url.pathname;
  res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','same-origin'); res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' blob: data:; style-src 'self'; font-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if (path==='/health') return send(res,{ok:true});
  if (path==='/api/config' && req.method==='GET') return send(res,{armReady:armReady(),preview:config.preview,client:'Nathalie Peña-Comas',includedUntil:config.includedUntil || null,sourceLocale:'es',translationReady:Boolean(config.translationKey||config.translate),translatedLanguages:10});
  if (path.startsWith('/api/')) {
   if (!['GET','POST','PATCH'].includes(req.method)) throw new ApiError(405,'Método no permitido.');
   if (req.method !== 'GET') {
    const expected=config.origin || `${config.secure?'https':'http'}://${req.headers.host}`;
    if (req.headers.origin !== expected) throw new ApiError(403,'Origen de solicitud no permitido.');
   }
   if (path==='/api/logout' && req.method==='POST') { const s=session(req); if(s?.refresh) await upstream(config.cms,'/auth/logout',null,'POST',{refresh_token:s.refresh}).catch(()=>{}); setSession(res,null); return send(res,{ok:true}); }
   if (path==='/api/login' && req.method==='POST') {
    const input=await jsonBody(req);
    if (typeof input.email!=='string' || typeof input.password!=='string' || input.email.length>180 || input.password.length>200) throw new ApiError(400,'Introduce tu correo y contraseña.');
    const ip=(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0];
    const key=ip+':'+input.email.toLowerCase(); const attempt=attempts.get(key);
    if (attempt && attempt.until>Date.now() && attempt.count>=10) throw new ApiError(429,'Espera un minuto antes de volver a intentar.');
    if (attempts.size>1000) attempts.clear(); attempts.set(key,{count:attempt?.until>Date.now()?attempt.count+1:1,until:Date.now()+60000});
    let s;
    if(input.mode==='arm') {
     if(!armReady()) throw new ApiError(409,'El acceso ARM estará disponible al activar el espacio de Nathalie.');
     const result=await upstream(config.crm,'/auth/login',null,'POST',{email:input.email,password:input.password});
     await crmIdentity(result.token);
     s={mode:'arm',crmToken:result.token,access:config.editorToken,email:result.user.email,name:result.user.name};
    } else {
     const result=await upstream(config.cms,'/auth/login',null,'POST',{email:input.email,password:input.password,mode:'json'});
     const profile=await upstream(config.cms,'/users/me?fields=id,email,first_name,last_name',result.data.access_token);
     s={mode:'cms',access:result.data.access_token,refresh:result.data.refresh_token,accessUntil:Date.now()+result.data.expires,email:profile.data.email,name:[profile.data.first_name,profile.data.last_name].filter(Boolean).join(' ')};
    }
    s.until=Date.now()+7*86400000; setSession(res,s); attempts.delete(key); return send(res,{ok:true});
   }
   const s=await authenticated(req,res);
   if(path==='/api/session' && req.method==='GET') {
    const profile=s.mode!=='arm'?await upstream(config.cms,'/users/me?fields=id,email',s.access):null;
    return send(res,{email:s.email,name:s.name,armConnected:Boolean(s.crmToken || canDelegate(profile?.data?.email)),armReady:armReady()});
   }
   if(path==='/api/site-map' && req.method==='GET')return send(res,siteMap);
   const section=path.match(/^\/api\/sections\/([a-z]+)$/);
   if(section && req.method==='POST')return contentWrite(async()=>{
    const definition=siteMap.sections.find(row=>row.id===section[1]);
    if(!definition)throw new ApiError(404,'Sección no encontrada.');
    const input=await jsonBody(req),allowed=new Set(definition.fields.map(field=>field.key));
    if((input.force!==undefined&&typeof input.force!=='boolean') || !Array.isArray(input.texts) || input.texts.length>100 || input.texts.some(row=>!row || !allowed.has(row.key) || typeof row.value!=='string' || row.value.length>12000) || new Set(input.texts.map(row=>row.key)).size!==input.texts.length)throw new ApiError(400,'Revisa los textos de esta sección.');
    const current=await textsFor(s.access);
    const sources=input.texts.flatMap(row=>{
     const existing=current.find(item=>item.key===row.key&&item.locale==='es');
     const baseline=existing?.value??definition.fields.find(item=>item.key===row.key).source;
     return !input.force&&row.value===baseline?[]:[{...row,status:existing?.status||'published'}];
    });
    const writes=await prepareSources(sources,current,s.access);
    await persistTexts(writes,current,s.access);
    return send(res,{ok:true,changed:sources.length,translatedLanguages:sources.length?10:0});
   });
   if(path==='/api/content' && req.method==='GET') {
    const content={};
    // Avoid sending six concurrent expensive requests to the CMS.
    for(const collection of Object.keys(fields)) {
     const image=fields[collection].includes('image')?',image.id,image.title,image.width,image.height':'';
     content[collection]=(await upstream(config.cms,`/items/${collection}?limit=-1&sort=sort,id&fields=*${image}`,s.access)).data;
    }
    return send(res,{content});
   }
   const record=path.match(/^\/api\/content\/([a-z_]+)(?:\/([a-zA-Z\d_-]+))?$/);
   if(record && fields[record[1]] && ['POST','PATCH'].includes(req.method))return contentWrite(async()=>{
    const [,collection,id]=record;
    if(id && !idPattern.test(id)) throw new ApiError(400,'Registro no válido.');
    if((req.method==='PATCH')!==Boolean(id)) throw new ApiError(405,'Método no permitido.');
    const input=validate(collection,await jsonBody(req),!id);
    const data=id?input:{id:randomUUID(),status:'draft',sort:Date.now()%2147483647,...input};
    await requireWrite(s.access,collection,id?'update':'create',Object.keys(input));
    const current=id?(await upstream(config.cms,`/items/${collection}/${encodeURIComponent(id)}?fields=*`,s.access)).data:null;
    const sourceId=id||data.id;
    if(collection==='site_texts') {
     if((input.locale && input.locale!=='es') || (current && current.locale!=='es'))throw new ApiError(400,'Edita el original en español. Las otras lenguas se actualizan automáticamente.');
     if(current && ((input.key && input.key!==current.key) || (input.locale && input.locale!==current.locale)))throw new ApiError(400,'La identidad de este texto no se puede cambiar.');
     const key=current?.key||input.key;
     if(!current && !siteMap.sections.some(section=>section.fields.some(field=>field.key===key)))throw new ApiError(400,'Crea los textos desde la sección correspondiente del sitio.');
     const value=input.value??current?.value??'',status=input.status||current?.status||'draft';
     const texts=await textsFor(s.access);
     if(!current || value!==current.value || status!==current.status) {
      const writes=await prepareSources([{key,value,status}],texts,s.access);
      await persistTexts(writes,texts,s.access);
      return send(res,{data:writes.find(row=>row.locale==='es'),translatedLanguages:10},id?200:201);
     }
     return send(res,{data:current});
    }
    if(localizedFields[collection]) {
     const texts=await textsFor(s.access),status=input.status||current?.status||'draft';
     const needsRepair=field=>{const key=recordTextKey(collection,sourceId,field),bundle=texts.filter(row=>row.key===key);return bundle.some(row=>row.source_hash)&&['es',...targetLocales].some(locale=>bundle.find(row=>row.locale===locale)?.source_hash!==sourceHash(input[field]));};
     const sources=localizedFields[collection].filter(field=>typeof input[field]==='string'&&(input[field]!==current?.[field]||needsRepair(field))).map(field=>({key:recordTextKey(collection,sourceId,field),value:input[field],status}));
     const writes=await prepareSources(sources,texts,s.access);
     // Store translations before changing their source; stale/partial bundles block publication.
     await persistTexts(writes,texts,s.access);
     if(current && input.status && input.status!==current.status) {
      const prefix=`content:${collection}:${id}:`;
      const statuses=texts.filter(row=>row.key?.startsWith(prefix)&&!writes.some(write=>write.id===row.id)).map(row=>({id:row.id,status}));
      if(statuses.length)await upstream(config.cms,'/items/site_texts',s.access,'PATCH',statuses);
     }
    }
    const result=await upstream(config.cms,`/items/${collection}${id?'/'+encodeURIComponent(id):''}`,s.access,req.method,data);
    return send(res,result,id?200:201);
   });
   if(path==='/api/upload' && req.method==='POST') {
    const bytes=await body(req,26*1024*1024);
    const form=await new Response(bytes,{headers:{'Content-Type':req.headers['content-type'] || ''}}).formData().catch(()=>{throw new ApiError(400,'Selecciona una fotografía.');});
    const file=form.get('file');
    if(!file || !['image/jpeg','image/png','image/webp','image/avif'].includes(file.type) || file.size>25*1024*1024) throw new ApiError(400,'Utiliza una foto JPG, PNG, WebP o AVIF de hasta 25 MB.');
    const upload=new FormData(); upload.set('file',file,file.name); upload.set('title',file.name.replace(/\.[^.]+$/,''));
    return send(res,await upstream(config.cms,'/files',s.access,'POST',upload),201);
   }
   const image=path.match(/^\/api\/image\/([a-f\d-]{36})$/i);
   if(image && req.method==='GET') {
    const width=Math.min(1600,Math.max(80,Number(url.searchParams.get('w'))||640));
    const job=imageQueue.then(async()=>{
     const response=await fetch(config.cms.replace(/\/$/,'')+`/assets/${image[1]}?width=${width}&withoutEnlargement=true&format=webp&quality=82`,{headers:{Authorization:`Bearer ${s.access}`},signal:AbortSignal.timeout(60000)});
     if(!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new ApiError(404,'Imagen no disponible.');
     return {type:response.headers.get('content-type'),bytes:Buffer.from(await response.arrayBuffer())};
    });
    imageQueue=job.catch(()=>undefined);const result=await job;
    res.writeHead(200,{'Content-Type':result.type,'Cache-Control':'private, max-age=180','Vary':'Cookie'}); res.end(result.bytes); return;
   }
   const reorder=path.match(/^\/api\/reorder\/(gallery|albums|videos)$/);
   if(reorder && req.method==='POST') {
    const {ids}=await jsonBody(req);
    if(!Array.isArray(ids)||ids.length>1000||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!idPattern.test(id))) throw new ApiError(400,'El orden no es válido.');
    return send(res,await upstream(config.cms,`/items/${reorder[1]}`,s.access,'PATCH',ids.map((id,sort)=>({id,sort}))));
   }
   if(path==='/api/publish' && req.method==='POST')return contentWrite(async()=>{
    if(!config.publishHook) throw new ApiError(503,'La actualización de la vista previa no está configurada.');
    // Check write permission without changing a record, including for read-only accounts.
    const permissions=await upstream(config.cms,'/permissions/me',s.access);
    const own=permissions?.data || permissions;
    if(!Object.keys(fields).some(collection=>own?.[collection]?.update?.access && own[collection].update.access!=='none')) throw new ApiError(403,'Tu cuenta no puede publicar cambios.');
    const texts=(await textsFor(s.access)).filter(row=>row.status==='published');
    const content={};
    if(texts.some(row=>row.source_hash))for(const collection of Object.keys(localizedFields))content[collection]=(await upstream(config.cms,`/items/${collection}?limit=-1&filter[status][_eq]=published`,s.access)).data;
    try{assertTranslationsReady(texts,content);}catch{throw new ApiError(409,'Hay traducciones pendientes o desactualizadas. Vuelve a guardar el original español antes de actualizar la vista previa.');}
    const result=await fetch(config.publishHook,{method:'POST',signal:AbortSignal.timeout(20000)});
    if(!result.ok) throw new ApiError(502,'La vista previa no pudo actualizarse. Inténtalo de nuevo.');
    return send(res,{ok:true,url:config.preview});
   });
   if(path==='/api/arm/connect' && req.method==='POST') {
    if(!armReady()) throw new ApiError(409,'Primero hay que configurar la suscripción ARM de Nathalie.');
    const input=await jsonBody(req);
    const result=await upstream(config.crm,'/auth/login',null,'POST',{email:input.email,password:input.password});
    await crmIdentity(result.token); s.crmToken=result.token; setSession(res,s); return send(res,{ok:true});
   }
   if(path.startsWith('/api/arm/')) {
    const crmToken=await crmTokenFor(s);
    const match=path.match(/^\/api\/arm\/(clients|deals|tasks|pipelines)(?:\/([a-zA-Z\d_-]+))?$/);
    if(!match) throw new ApiError(404,'Recurso no disponible.');
    const [,resource,id]=match;
    const allowed={clients:['name','firstName','email','phone','company','function','notes','clientStatus'],deals:['title','value','currency','pipelineId','stageId','clientId','expectedCloseDate'],tasks:['title','clientId','dueDate','status','priority'],pipelines:[]};
    let data;
    if(req.method!=='GET') {
     data=await jsonBody(req);
     if(resource==='pipelines' || Object.keys(data).some(key=>!allowed[resource].includes(key))) throw new ApiError(400,'Campos no permitidos para esta operación ARM.');
    }
    const result=await upstream(config.crm,`/${resource}${id?'/'+encodeURIComponent(id):''}`,crmToken,req.method,data);
    if(resource==='pipelines' && !id && req.method==='GET') {
     // The list endpoint omits stages; the detail endpoint includes their ordered definitions.
     if(!Array.isArray(result)) throw new ApiError(502,'No se pudieron cargar los pipelines.');
     const pipelines=[];
     for(const pipeline of result) pipelines.push(await upstream(config.crm,'/pipelines/'+encodeURIComponent(pipeline.id),crmToken));
     return send(res,pipelines);
    }
    return send(res,result);
   }
   throw new ApiError(404,'Página no encontrada.');
  }
  if(req.method!=='GET' && req.method!=='HEAD') throw new ApiError(405,'Método no permitido.');
  const staticFiles={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css','/favicon.svg':'favicon.svg','/artist.webp':'artist.webp','/logo-npc.png':'logo-npc.png'};
  const font=path.match(/^\/fonts\/([\w.-]+\.(?:ttf|txt))$/);
  const relative=staticFiles[path] || (font?'fonts/'+font[1]:null);
  if(!relative) throw new ApiError(404,'Página no encontrada.');
  let bytes;
  try{bytes=await readFile(resolve(here,'public',relative));}
  catch(error){
   if(relative==='logo-npc.png' || font) bytes=await readFile(resolve(here,'../../public',relative));
   else throw error;
  }
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.ttf':'font/ttf','.txt':'text/plain'};
  res.writeHead(200,{'Content-Type':mime[extname(relative)],'Cache-Control':['index.html','app.js','style.css'].includes(relative)?'no-store':'public, max-age=3600'});res.end(req.method==='HEAD'?undefined:bytes);
 }
 return http.createServer((req,res)=>serve(req,res).catch(error=>{
  if(res.headersSent){res.end();return;}
  const status=error instanceof ApiError?error.status:500;
  send(res,{error:status===500?'No se pudo completar la solicitud. Inténtalo de nuevo.':error.message},status);
 }));
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const server=createStudioServer();server.listen(Number(process.env.PORT)||4380,'0.0.0.0',()=>console.log('Nathalie Studio ready.'));
}
