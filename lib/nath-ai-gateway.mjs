import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {ensureKnowledge} from './nath-ai-knowledge.mjs';
const cookieName='nath_ai_session';
const languages=new Set(['es','en','de','fr','it','sv','hu','hr','ru','zh-TW','ja']);
const key=()=>process.env.NATH_AI_GATEWAY_KEY||'';
const sign=value=>createHmac('sha256',key()).update(value).digest('hex');
const equal=(a,b)=>{const left=Buffer.from(a||''),right=Buffer.from(b||'');return left.length===right.length&&timingSafeEqual(left,right);};
export function reply(res,status,body){res.setHeader('Cache-Control','no-store');return res.status(status).json(body);}
function origin(req){return new URL(`https://${req.headers.host}`).origin;}
function session(req){
 const value=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
 const [id,expires,signature]=value.split('.');
 return /^[a-f0-9]{32}$/.test(id||'')&&/^\d+$/.test(expires||'')&&Number(expires)>Date.now()&&equal(signature,sign(`session:${id}.${expires}`))?id:null;
}
function safeOrigin(req,required=false){const given=req.headers.origin;return (!required&&!given||given===origin(req))&&req.headers['sec-fetch-site']!=='cross-site';}
export async function upstream(path,options={}){
 const endpoint=process.env.NATH_AI_GATEWAY_URL;
 if(!endpoint||!key())throw Error('Nath AI is not configured');
 const url=new URL(endpoint);if(url.protocol!=='https:')throw Error('HTTPS gateway required');
 const response=await fetch(endpoint.replace(/\/$/,'')+path,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${key()}`,...options.headers},redirect:'error',signal:AbortSignal.timeout(55000)});
 const data=await response.json();return {status:response.status,data};
}
export async function handle(req,res,action){
 try{
  if(!key()||!process.env.NATH_AI_GATEWAY_URL)return reply(res,503,{error:'Nath AI is not configured'});
  if(!safeOrigin(req))return reply(res,403,{error:'Invalid origin'});
  if(action==='health'&&req.method==='GET'){
   const knowledge=await ensureKnowledge(upstream);
   const result=await upstream('/health');const available=result.status===200&&result.data.version==='3.6.0'&&result.data.site==='nathalie-dev'&&result.data.provider_configured===true;
   return reply(res,available?200:503,{available,version:'3.6.0',name:'Nath AI',responseLanguagePolicy:result.data.response_language_policy||'page',knowledge:{revision:knowledge.revision,publishedAt:knowledge.publishedAt,...knowledge.stats}});
  }
  if(action==='identity'&&req.method==='GET'){
   const id=session(req)||randomBytes(16).toString('hex');const expires=Date.now()+86400000;
   res.setHeader('Set-Cookie',`${cookieName}=${id}.${expires}.${sign(`session:${id}.${expires}`)}; Path=/api/nath-ai; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`);
   return reply(res,200,{clientCode:'nathalie',identity:sign(`widget:${id}`),version:'3.6.0'});
  }
  const id=session(req);
  if(!id||!equal(req.headers['x-olivia-widget-identity'],sign(`widget:${id}`)))return reply(res,401,{error:'Session expired'});
  if(!['chat','conversations'].includes(action))return reply(res,404,{error:'Not found'});
  if(!['GET','POST','PATCH'].includes(req.method)||action==='chat'&&req.method!=='POST')return reply(res,405,{error:'Method not allowed'});
  if(req.method!=='GET'&&!safeOrigin(req,true))return reply(res,403,{error:'Origin required'});
  let payload=req.body;
  if(typeof payload==='string'){if(Buffer.byteLength(payload)>24000)return reply(res,413,{error:'Request too large'});try{payload=JSON.parse(payload);}catch{return reply(res,400,{error:'Invalid JSON'});}}
  if(req.method==='GET')payload=Object.fromEntries(new URL(req.url,origin(req)).searchParams);
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return reply(res,400,{error:'Invalid payload'});
  if(Buffer.byteLength(JSON.stringify(payload))>24000)return reply(res,413,{error:'Request too large'});
  if(payload.clientCode!=='nathalie'||!languages.has(payload.language||'es')||!/^[a-f0-9-]{36}$/i.test(payload.visitorId||''))return reply(res,400,{error:'Invalid client, language or visitor'});
  if(req.method!=='GET'&&payload.metadata?.dataConsent!==true)return reply(res,400,{error:'Consent required'});
  const content=(action==='chat'?payload.message:payload.content)||'';
  if(req.method!=='GET'&&(typeof content!=='string'||!content.trim()||content.length>4000))return reply(res,400,{error:'Invalid message'});
  if(action==='chat')await ensureKnowledge(upstream);
  const conversation_id=sign(`conversation:${id}:${payload.visitorId}`).slice(0,48);
  const body={conversation_id,session_id:id,client_hash:createHash('sha256').update(req.headers['x-vercel-forwarded-for']||id).digest('hex'),language:payload.language||'es',consent:true,...(action==='chat'?{message:content}:{content,model:typeof payload.model==='string'?payload.model.slice(0,100):null})};
  const result=await upstream(req.method==='GET'?`/conversations/${conversation_id}`:`/${action}`,{method:req.method,...(req.method==='GET'?{}:{body:JSON.stringify(body)})});
  if(result.status!==200)return reply(res,result.status===429?429:502,{error:'Nath AI is temporarily unavailable'});
  if(action==='chat'&&(result.data.clientCode!=='nathalie'||result.data.version!=='3.6.0'||typeof result.data.reply!=='string'))return reply(res,502,{error:'Invalid Nath AI response'});
  return reply(res,200,result.data);
 }catch{return reply(res,502,{error:'Nath AI is temporarily unavailable'});}
}
