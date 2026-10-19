export {};
type Message = { role:'user'|'assistant'|'operator'; content:string; id?:string };
type Session = { visitorId:string; consent:boolean; open:boolean; messages:Message[] };
const root=document.querySelector<HTMLElement>('[data-olivia]');
if(root){
 const api='https://suitesmine-bot.vercel.app';
 const clientCode='nathalie';
 const key='npc-olivia-v2';
 const lang=root.dataset.language!;
 const dialog=root.querySelector<HTMLDialogElement>('#olivia-dialog')!;
 const log=root.querySelector<HTMLElement>('[data-olivia-messages]')!;
 const form=root.querySelector<HTMLFormElement>('[data-olivia-form]')!;
 const input=root.querySelector<HTMLTextAreaElement>('textarea')!;
 const consent=root.querySelector<HTMLInputElement>('[data-olivia-consent]')!;
 const submit=form.querySelector<HTMLButtonElement>('[type=submit]')!;
 const status=root.querySelector<HTMLElement>('[data-olivia-status]')!;
 const reset=root.querySelector<HTMLButtonElement>('[data-olivia-reset]')!;
 let identity='',busy=false;
 let session:Session={visitorId:crypto.randomUUID(),consent:false,open:false,messages:[]};
 try{
  const saved=JSON.parse(sessionStorage.getItem(key)??'null');
  if(saved && typeof saved.visitorId==='string' && Array.isArray(saved.messages)){
   session={visitorId:saved.visitorId,consent:saved.consent===true,open:saved.open===true,messages:saved.messages.filter((m:Message)=>['user','assistant','operator'].includes(m.role)&&typeof m.content==='string').slice(-24)};
  }
 }catch{/* Keep chat usable when browser storage is blocked. */}
 consent.checked=session.consent;
 function save(){try{sessionStorage.setItem(key,JSON.stringify(session));}catch{}}
 function bubble(message:Message){
  const p=document.createElement('p');p.className='olivia-message';p.dataset.role=message.role;
  // Render model output as text, with ordinary HTTP(S) links only.
  const pattern=/https?:\/\/[^\s<>"\]\)]+/g;
  let end=0;
  for(const match of message.content.matchAll(pattern)){
   p.append(document.createTextNode(message.content.slice(end,match.index)));
   const a=document.createElement('a');a.href=match[0];a.textContent=match[0];a.target='_blank';a.rel='noopener noreferrer';p.append(a);end=match.index!+match[0].length;
  }
  p.append(document.createTextNode(message.content.slice(end)));log.append(p);
 }
 function render(){log.replaceChildren();bubble({role:'assistant',content:root!.dataset.greeting!});session.messages.forEach(bubble);log.scrollTop=log.scrollHeight;}
 function open(){session.open=true;save();dialog.showModal();}
 function close(){dialog.close();}
 root.querySelector('[data-olivia-open]')?.addEventListener('click',open);
 root.querySelector('[data-olivia-close]')?.addEventListener('click',close);
 root.querySelector('.olivia-contact')?.addEventListener('click',close);
 dialog.addEventListener('close',()=>{session.open=false;save();});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();}});
 reset.addEventListener('click',()=>{if(busy)return;session={visitorId:crypto.randomUUID(),consent:false,open:true,messages:[]};consent.checked=false;status.textContent='';save();render();input.focus();});
 consent.addEventListener('change',()=>{session.consent=consent.checked;save();});
 async function request(path:string,method='GET',body?:unknown){
  const response=await fetch(api+path,{method,headers:{'Content-Type':'application/json',...(identity?{'X-Olivia-Widget-Identity':identity}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000),cache:'no-store',credentials:'omit'});
  const data=await response.json();if(!response.ok)throw new Error('Olivia request failed');return data;
 }
 async function identify(){
  const data=await request('/api/widget/identity');
  if(data.clientCode!==clientCode||typeof data.identity!=='string')throw new Error('Unregistered site');
  identity=data.identity;
 }
 async function sync(){
  if(!dialog.open||busy||!session.consent||!session.messages.length||document.hidden)return;
  try{
   if(!identity)await identify();
   const data=await request('/api/widget/conversations?'+new URLSearchParams({clientCode,visitorId:session.visitorId}));
   if(data.status==='manual')status.textContent=root!.dataset.manual!;
   else if(status.textContent===root!.dataset.manual)status.textContent='';
   for(const message of data.messages??[]){
    if(message.role==='operator'&&typeof message.id==='string'&&!session.messages.some(m=>m.id===message.id)){
     session.messages.push({role:'operator',content:String(message.content),id:message.id});save();render();
    }
   }
  }catch{/* A storage outage does not replace an existing conversation. */}
 }
 const timer=window.setInterval(sync,8000);
 window.addEventListener('pagehide',()=>clearInterval(timer));
 form.addEventListener('submit',async event=>{
  event.preventDefault();const message=input.value.trim();if(!message||busy||!consent.checked)return;
  busy=true;submit.disabled=true;reset.disabled=true;status.textContent=root!.dataset.thinking!;
  session.consent=true;
  const history=session.messages.filter(m=>m.role!=='operator').map(({role,content})=>({role,content})).slice(-12);
  session.messages.push({role:'user',content:message});input.value='';save();render();
  const pageContent=document.querySelector('main')?.textContent?.replace(/\s+/g,' ').slice(0,5000)??'';
  const metadata={language:lang,pageUrl:location.href,pageTitle:document.title,pageContent,dataConsent:true,dataConsentAt:new Date().toISOString(),consentVersion:'npc-olivia-v2-2026-10-15'};
  const common={clientCode,visitorId:session.visitorId,language:lang,source:'website',metadata};
  try{
   await identify();
   const stored=await request('/api/widget/conversations','POST',{...common,content:message}).catch(()=>null);
   if(stored?.conversation?.status==='manual'){status.textContent=root!.dataset.manual!;return;}
   const data=await request('/api/olivia/chat','POST',{...common,message,history});
   if(data.clientCode!==clientCode||data.language!==lang||typeof data.reply!=='string'||!data.model)throw new Error('Olivia v2 unavailable');
   session.messages.push({role:'assistant',content:data.reply});session.messages=session.messages.slice(-24);save();render();status.textContent='';
   await request('/api/widget/conversations','PATCH',{...common,content:data.reply,model:data.model}).catch(()=>null);
  }catch{session.messages.pop();save();render();status.textContent=root!.dataset.error!;if(!input.value)input.value=message;}
  finally{busy=false;submit.disabled=false;reset.disabled=false;input.focus();}
 });
 render();if(session.open)open();
}
