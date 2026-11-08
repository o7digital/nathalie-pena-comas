import { createHash, createSign } from 'node:crypto';

export class ReportingError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const providers = ['ga4','instagram','facebook','youtube','tiktok','linkedin','x','apple-music','shopify'];
export const metricLabels = {
 sessions:'Visitas al sitio', page_views:'Páginas vistas', social_sessions:'Visitas desde redes',
 reach:'Alcance', impressions:'Impresiones', profile_visits:'Visitas al perfil', link_clicks:'Clics en enlaces',
 engagements:'Interacciones', video_views:'Visualizaciones de vídeo', new_followers:'Nuevos seguidores',
 streams:'Escuchas', downloads:'Descargas', royalties:'Royalties declaradas', orders:'Pedidos', net_payments:'Cobros netos de pedidos',
};
const socialMetrics=['reach','impressions','profile_visits','link_clicks','engagements','video_views','new_followers'];
export function dateOnly(value) {
 return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
}
export function dateRange(start,end) {
 if(!dateOnly(start)||!dateOnly(end)||start>end || (Date.parse(end)-Date.parse(start))/86400000>365) throw new ReportingError(400,'Elige un período válido de hasta 366 días.');
 return {start,end};
}
export function parseCsv(text) {
 if(typeof text!=='string'||Buffer.byteLength(text)>240000)throw new ReportingError(400,'Importa un CSV de hasta 240 KB.');
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++) {
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c==='"'){if(cell||closed)throw new ReportingError(400,'CSV inválido.');quoted=true;continue;}
  if(c===','||c==='\n'||c==='\r'){row.push(cell);cell='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v!==''))rows.push(row);row=[];}continue;}
  if(closed)throw new ReportingError(400,'CSV inválido.');cell+=c;
 }
 if(quoted)throw new ReportingError(400,'CSV con comillas sin cerrar.');
 if(cell||row.length){row.push(cell);if(row.some(v=>v!==''))rows.push(row);}
 if(rows.length<2||rows.length>2001)throw new ReportingError(400,'El CSV debe contener entre 1 y 2000 filas.');
 rows[0][0]=rows[0][0].replace(/^\uFEFF/,'');
 if(rows[0].join(',')!=='date,channel,metric,value,currency')throw new ReportingError(400,'Utiliza la plantilla: date,channel,metric,value,currency.');
 return rows.slice(1);
}
export function importRows(provider,csv,source,now=new Date().toISOString()) {
 if(!providers.includes(provider)||['ga4','shopify'].includes(provider))throw new ReportingError(400,'Selecciona una fuente de importación disponible.');
 if(typeof source!=='string'||!source.trim()||source.length>120)throw new ReportingError(400,'Indica el origen del informe.');
 const seen=new Set();
 return parseCsv(csv).map((cells,index)=>{
  const [date,channel,metric,value,currency]=cells.map(v=>v.trim());
  const financial=metric==='royalties';
  if(cells.length!==5||!dateOnly(date)||!channel||channel.length>120||!(provider==='apple-music'?['streams','downloads','royalties']:socialMetrics).includes(metric)||!/^[-]?\d+(?:\.\d{1,6})?$/.test(value)||!Number.isFinite(Number(value))||Math.abs(Number(value))>1e12||(!financial&&(!Number.isSafeInteger(Number(value))||Number(value)<0))||(financial?!['USD','EUR','MXN','CAD','GBP','CHF','JPY','SEK'].includes(currency):currency!==''))throw new ReportingError(400,`Revisa la fila ${index+2}: fecha, métrica, valor o moneda inválidos.`);
  const id=createHash('sha256').update(JSON.stringify([provider,date,channel,metric,currency])).digest('hex');
  if(seen.has(id))throw new ReportingError(400,`La fila ${index+2} repite una métrica del mismo día y canal.`);seen.add(id);
  return {id,date,provider,payload:{date,provider,channel,metric,value:Number(value),currency:currency||null,source:source.trim(),updatedAt:now,method:'import'}};
 });
}
export function toCsv(rows) {
 const quote=v=>'"'+String(v??'').replace(/^[\s]*[=+\-@]/,m=>"'"+m).replaceAll('"','""')+'"';
 return '\uFEFF'+['date,provider,channel,metric,value,currency,source,updatedAt',...rows.map(r=>[r.date,r.provider,r.channel,r.metric,String(r.value),r.currency,r.source,r.updatedAt].map((v,i)=>i===4?String(Number(v)):quote(v)).join(','))].join('\r\n');
}
async function requestJson(url,options={},fetcher=fetch) {
 let response;
 try{response=await fetcher(url,{...options,signal:AbortSignal.timeout(25000),redirect:'error'});}catch{throw new ReportingError(502,'No se pudo consultar esta fuente. Inténtalo de nuevo.');}
 const result=await response.json().catch(()=>null);
 if(!response.ok||!result||result.errors)throw new ReportingError(502,'La fuente rechazó la consulta. Revisa los permisos y las credenciales del conector.');
 return result;
}
export function createReportingConnectors(env=process.env,fetcher=fetch) {
 let googleToken;
 const configured={ga4:Boolean(env.GA4_PROPERTY_ID&&env.GA4_SERVICE_ACCOUNT_JSON),shopify:Boolean(env.SHOPIFY_STORE_DOMAIN&&env.SHOPIFY_ADMIN_TOKEN)};
 async function ga4(start,end) {
  if(!/^\d+$/.test(env.GA4_PROPERTY_ID||''))throw new ReportingError(503,'Configura el identificador numérico de la propiedad GA4.');
  if(!googleToken||googleToken.until<Date.now()) {
   let account;try{account=JSON.parse(env.GA4_SERVICE_ACCOUNT_JSON);}catch{throw new ReportingError(503,'Revisa la cuenta de servicio GA4.');}
   if(!/^[^@\s]+@[^@\s]+\.gserviceaccount\.com$/.test(account.client_email||'')||!account.private_key)throw new ReportingError(503,'Revisa la cuenta de servicio GA4.');
   const now=Math.floor(Date.now()/1000),encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
   const unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,scope:'https://www.googleapis.com/auth/analytics.readonly',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
   let signature;try{signature=createSign('RSA-SHA256').update(unsigned).sign(account.private_key,'base64url');}catch{throw new ReportingError(503,'La clave de servicio GA4 no es válida.');}
   const data=await requestJson('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signature})},fetcher);
   if(!data.access_token)throw new ReportingError(502,'GA4 no autorizó la consulta.');googleToken={token:data.access_token,until:Date.now()+Math.min(Number(data.expires_in)||3600,3600)*1000-60000};
  }
  const report=await requestJson(`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:runReport`,{method:'POST',headers:{Authorization:'Bearer '+googleToken.token,'Content-Type':'application/json'},body:JSON.stringify({dateRanges:[{startDate:start,endDate:end}],dimensions:[{name:'date'},{name:'sessionSource'},{name:'sessionDefaultChannelGroup'}],metrics:[{name:'sessions'},{name:'screenPageViews'}],limit:10000})},fetcher);
  if(Number(report.rowCount)>10000)throw new ReportingError(422,'El informe GA4 es demasiado grande. Reduce el período.');
  return (report.rows||[]).flatMap(r=>{
   const [raw,channel,group]=r.dimensionValues.map(v=>v.value),date=raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6,8);
   const base={date,provider:'ga4',channel,source:'Google Analytics 4',method:'api',updatedAt:new Date().toISOString(),currency:null};
   return [{...base,metric:'sessions',value:Number(r.metricValues[0].value)},{...base,metric:'page_views',value:Number(r.metricValues[1].value)},...(['Organic Social','Paid Social'].includes(group)?[{...base,metric:'social_sessions',value:Number(r.metricValues[0].value)}]:[])];
  });
 }
 async function shopify(start,end) {
  if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(env.SHOPIFY_STORE_DOMAIN||''))throw new ReportingError(503,'Utiliza el dominio privado de la tienda .myshopify.com.');
  // Avoid silently incomplete history with Shopify's default 60-day permission.
  const scopes=await requestJson(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/oauth/access_scopes.json`,{headers:{'X-Shopify-Access-Token':env.SHOPIFY_ADMIN_TOKEN}},fetcher);
  const handles=(scopes.access_scopes||[]).map(s=>s.handle);
  if(!handles.includes('read_orders')&&!handles.includes('write_orders'))throw new ReportingError(403,'Shopify necesita el permiso read_orders.');
  if(Date.parse(start)<Date.now()-59*86400000&&!handles.includes('read_all_orders'))throw new ReportingError(422,'Shopify permite 60 días de historial. Para fechas anteriores, autoriza read_all_orders.');
  const query='query ReportingOrders($after:String,$query:String!){orders(first:100,after:$after,query:$query,sortKey:CREATED_AT){nodes{createdAt test netPaymentSet{shopMoney{amount currencyCode}}}pageInfo{hasNextPage endCursor}}}';
  let after=null;const rows=[];
  for(let page=0;page<50;page++) {
   const result=await requestJson(`https://${env.SHOPIFY_STORE_DOMAIN}/admin/api/2026-10/graphql.json`,{method:'POST',headers:{'X-Shopify-Access-Token':env.SHOPIFY_ADMIN_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query,variables:{after,query:`created_at:>=${start}T00:00:00Z created_at:<=${end}T23:59:59Z`}})},fetcher);
   const orders=result.data?.orders;if(!orders?.pageInfo||!Array.isArray(orders.nodes))throw new ReportingError(502,'La respuesta de Shopify no es válida.');
   for(const order of orders.nodes)if(!order.test){
    const base={date:order.createdAt.slice(0,10),provider:'shopify',channel:env.SHOPIFY_STORE_DOMAIN,source:'Shopify · pedidos creados en el período (UTC)',method:'api',updatedAt:new Date().toISOString()};
    rows.push({...base,metric:'orders',value:1,currency:null},{...base,metric:'net_payments',value:Number(order.netPaymentSet.shopMoney.amount),currency:order.netPaymentSet.shopMoney.currencyCode});
   }
   if(!orders.pageInfo.hasNextPage)return rows;
   if(!orders.pageInfo.endCursor||after===orders.pageInfo.endCursor)throw new ReportingError(502,'Shopify no pudo paginar los pedidos.');after=orders.pageInfo.endCursor;
  }
  throw new ReportingError(422,'Más de 5000 pedidos. Reduce el período para obtener un informe completo.');
 }
 return {configured,ga4,shopify};
}

export function createReporting({read,write,connectors}) {
 const cache=new Map();
 return {
  async report(start,end) {
   dateRange(start,end);
   const imported=await read(start,end);
   const rows=imported.map(r=>r.payload),sources=[];
   for(const provider of providers) {
    const own=rows.filter(r=>r.provider===provider),status={provider,mode:['ga4','shopify'].includes(provider)?'api':'import',status:own.length?'imported':'pending',updatedAt:own.map(r=>r.updatedAt).sort().at(-1)||null};
    if(connectors.configured[provider]) {
     try {
      const key=provider+start+end;let entry=cache.get(key);
      if(!entry||entry.until<Date.now()){entry={rows:await connectors[provider](start,end),until:Date.now()+60000};if(cache.size>24)cache.clear();cache.set(key,entry);}
      rows.push(...entry.rows);status.status='connected';status.updatedAt=entry.rows[0]?.updatedAt||new Date().toISOString();
     }catch(error){status.status='error';status.error=error instanceof ReportingError?error.message:'No se pudo consultar esta fuente.';}
    }
    sources.push(status);
   }
   return {start,end,rows,sources,metrics:metricLabels,generatedAt:new Date().toISOString()};
  },
  async import(input) {
   const rows=importRows(input.provider,input.csv,input.source);
   await write(rows);cache.clear();return {ok:true,rows:rows.length};
  },
 };
}
