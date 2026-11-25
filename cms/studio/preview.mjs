import {parse, parseFragment, serialize} from 'parse5';

export class PreviewError extends Error {
 constructor(status,message){super(message);this.status=status;}
}
const localePattern='(?:es|en|de|fr|it|sv|hu|hr|ru|zh-TW|ja)';
export function previewPath(page){
 if(typeof page!=='string'||!new RegExp(`^/${localePattern}/(?:privacy/)?$`).test(page))throw new PreviewError(400,'Selecciona una página del sitio.');
 return `/_studio/pages/${page.slice(1,-1).replaceAll('/','__')}.json`;
}
const attr=(node,name)=>node.attrs?.find(a=>a.name===name)?.value;
const set=(node,name,value)=>{node.attrs??=[];node.attrs.push({name,value});};
const normalized=value=>value.replace(/\s+/g,' ').trim();
const signature=nodes=>nodes.map(node=>node.nodeName==='#text'?node.value:node.tagName==='br'?'\n':['em','strong'].includes(node.tagName)?`<${node.tagName}>${signature(node.childNodes)}</${node.tagName}>`:'\0').join('');
const inline=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/&lt;(\/?(?:em|strong)|br\s*\/?)&gt;/gi,'<$1>');

export function assetPath(path){
 if(typeof path!=='string'||path.length>500||path.includes('..')||!/^\/(?:(?:_astro|_cms|fonts)\/[\w./-]+\.(?:css|webp|png|jpe?g|avif|svg|ttf|woff2?)|logo-npc\.png|favicon\.svg)$/.test(path))throw new PreviewError(400,'Recurso de vista previa no permitido.');
 return path;
}
export function proxyAsset(value,base,origin){
 let url;try{url=new URL(value,base);}catch{return value;}
 if(url.origin!==new URL(base).origin)return value;
 try{return `${origin}/api/preview-asset?path=${encodeURIComponent(assetPath(url.pathname))}`;}catch{return value;}
}
export function proxyCss(css,path,site,origin){
 return css.replace(/url\(\s*["']?([^"')]+)["']?\s*\)/g,(match,value)=>`url("${proxyAsset(value.trim(),new URL(path,site),origin)}")`);
}

// Only the companion bundle receives annotations. The public page stays intact.
export function annotatePreview(html,{texts=[],images=[],sections=[],initialSection='settings'}={}){
 const document=parse(html),all=texts.map(row=>({...row,signature:normalized(signature(parseFragment(inline(row.value)).childNodes))}));
 const anchors=new Map(sections.filter(s=>s.id!=='settings'&&s.anchor).map(s=>[s.anchor,s.id]));
 for(const [anchor,section]of Object.entries({collection:'albums','music-films':'videos'}))anchors.set(anchor,section);
 const visit=(node,section='settings')=>{
  if(['head','script','style','noscript','svg','template'].includes(node.tagName))return;
  section=anchors.get(attr(node,'id'))||(node.tagName==='footer'?'contact':section);
  const src=attr(node,'src');
  if(node.tagName==='img'){
   const picture=images.find(row=>row.src===src&&row.section===section);
   if(picture)set(node,'data-studio-image',JSON.stringify({collection:picture.collection,id:picture.id,key:picture.key}));
  }
  if(node.childNodes?.length&&node.tagName){
   const candidates=all.filter(row=>row.section===section||row.section==='settings');
   const match=candidates.find(row=>row.signature&&row.signature===normalized(signature(node.childNodes)));
   if(match){set(node,'data-studio-text',JSON.stringify(match.target));return;}
   // Match text nodes independently so headings retain their original em/br markup.
   node.childNodes=node.childNodes.map(child=>{
    if(child.nodeName!=='#text'||!normalized(child.value))return child;
    const row=candidates.find(row=>row.signature===normalized(child.value));if(!row)return child;
    const wrapper=parseFragment('<npc-edit></npc-edit>').childNodes[0];
    set(wrapper,'data-studio-text',JSON.stringify(row.target));wrapper.childNodes=[child];wrapper.parentNode=node;child.parentNode=wrapper;return wrapper;
   });
  }
  for(const child of node.childNodes||[])if(!attr(child,'data-studio-text'))visit(child,section);
 };
 visit(document,initialSection);
 return serialize(document);
}

export function previewDocument(bundle,page,site,{assetOrigin}={}){
 previewPath(page);
 if(bundle?.page!==page||typeof bundle.html!=='string'||bundle.html.length>5_000_000)throw new PreviewError(502,'La vista de esta página no está disponible.');
 const document=parse(bundle.html),remove=new Set(['script','iframe','object','embed','base','noscript','template']);
 const walk=node=>{
  node.childNodes=(node.childNodes||[]).filter(child=>!remove.has(child.tagName)&&!(child.tagName==='meta'&&attr(child,'http-equiv'))&&!(child.tagName==='link'&&['modulepreload','preload','prefetch'].includes(attr(child,'rel'))));
  for(const child of node.childNodes){
   if(child.attrs)child.attrs=child.attrs.filter(a=>!/^on/i.test(a.name)&&!['srcdoc','autofocus','formaction','action','target','ping','download','nonce'].includes(a.name)&&!(['href','src','xlink:href'].includes(a.name)&&/^\s*(javascript|vbscript):/i.test(a.value)));
   if(assetOrigin)for(const attribute of child.attrs||[]){
    if(['src','poster'].includes(attribute.name)||(attribute.name==='href'&&child.tagName==='link'&&['stylesheet','icon'].includes(attr(child,'rel'))))attribute.value=proxyAsset(attribute.value,new URL(page,site),assetOrigin);
    if(attribute.name==='srcset')attribute.value=attribute.value.replace(/(\S+)(\s+\d+[wx])?(\s*,\s*|$)/g,(match,path,size='',separator='')=>proxyAsset(path,new URL(page,site),assetOrigin)+size+separator);
    if(attribute.name==='style')attribute.value=proxyCss(attribute.value,page,site,assetOrigin);
   }
   walk(child);
  }
 };
 walk(document);
 const head=document.childNodes.find(n=>n.tagName==='html').childNodes.find(n=>n.tagName==='head');
 const element=(name,attrs,text)=>{const node=parseFragment(`<${name}></${name}>`).childNodes[0];node.attrs=Object.entries(attrs).map(([name,value])=>({name,value}));node.parentNode=head;if(text!==undefined)node.childNodes=[{nodeName:'#text',value:text,parentNode:node}];return node;};
 head.childNodes.unshift(element('base',{href:new URL(page,site).href}));
 head.childNodes.push(element('meta',{name:'robots',content:'noindex,nofollow'}),element('meta',{name:'nathalie-preview',content:page}));
 head.childNodes.push(element('style',{},`html{scroll-behavior:auto!important}body{min-width:0}*,*::before,*::after{animation:none!important;transition:none!important}.fade-in,.reveal{opacity:1!important;transform:none!important}[class*="olivia"],.cookie-banner,.consent-banner,.back-to-top{display:none!important}[data-studio-editable]{outline:none;cursor:text;white-space:pre-wrap}[data-studio-editable]:hover{outline:2px solid #527b65;outline-offset:4px}[data-studio-editable]:focus,[data-studio-selected]{outline:2px solid #af8954!important;outline-offset:4px}[data-studio-photo]{cursor:pointer}[data-studio-photo]:hover{outline:3px solid #527b65;outline-offset:-3px}body[data-studio-readonly] [data-studio-editable]:hover,body[data-studio-readonly] [data-studio-photo]:hover{outline:none}[data-studio-editable][data-studio-kind=seo]{background:#c23b4514;outline:1px dashed #c23b4590;outline-offset:3px}[data-studio-editable][data-studio-kind=text]{background:#32834c0a;outline:1px dashed #32834c80;outline-offset:3px}[data-studio-editable][data-studio-kind=seo]:hover,[data-studio-editable][data-studio-kind=seo]:focus,[data-studio-editable][data-studio-kind=seo][data-studio-selected]{outline:2px solid #c23b45!important}[data-studio-editable][data-studio-kind=text]:hover,[data-studio-editable][data-studio-kind=text]:focus,[data-studio-editable][data-studio-kind=text][data-studio-selected]{outline:2px solid #32834c!important}[data-studio-photo]:hover,[data-studio-photo][data-studio-selected]{outline:3px solid #286bc1!important;outline-offset:-3px}[data-studio-locked]{outline:2px dashed #c23b45!important}body[data-studio-readonly] [data-studio-editable],body[data-studio-readonly] [data-studio-photo],body[data-studio-readonly] [data-studio-locked]{outline:none!important;background:transparent}npc-edit{display:inline}a,button{cursor:default}`));
 return serialize(document);
}
