import {createHmac,createHash,timingSafeEqual,randomBytes} from 'node:crypto';
import {Readable} from 'node:stream';

export class SocialMediaError extends Error {constructor(status,message){super(message);this.status=status;}}
export const SOCIAL_MEDIA_FOLDER='5721a51c-a70b-4ef1-9f46-d927ed6b35d8';
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const types={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','video/mp4':'.mp4'};
export function mediaFingerprint(file){return createHash('sha256').update(JSON.stringify([file.id,file.type,String(file.filesize),file.modified_on||file.uploaded_on])).digest('base64url');}
export function mediaSignature(secret,id,nbf,exp,version){return createHmac('sha256',secret).update(`o7:social-media:v1:${id}:${nbf}:${exp}:${version}`).digest('base64url');}
export function verifyMediaLease(secret,url,now=Date.now()){
 const id=url.pathname.split('/').at(-1),nbf=url.searchParams.get('nbf'),exp=url.searchParams.get('exp'),version=url.searchParams.get('v'),sig=url.searchParams.get('sig');
 if(!uuid.test(id||'')||!/^[\d]{10,12}$/.test(nbf||'')||!/^[\d]{10,12}$/.test(exp||'')||!/^[\w-]{43}$/.test(version||'')||!/^[\w-]{43}$/.test(sig||'')||[...url.searchParams.keys()].some(k=>!['nbf','exp','v','sig'].includes(k))||Number(nbf)*1000>now||Number(exp)*1000<now||Number(exp)-Number(nbf)>4*3600)throw new SocialMediaError(403,'El enlace de este medio no es válido o ha caducado.');
 const expected=mediaSignature(secret,id,nbf,exp,version);
 if(!timingSafeEqual(Buffer.from(expected),Buffer.from(sig)))throw new SocialMediaError(403,'El enlace de este medio no es válido.');
 return {id,version};
}
export function createSocialMedia({cms,editorToken,secret,origin}){
 async function request(path,token,options={}){
  const response=await fetch(cms.replace(/\/$/,'')+path,{...options,headers:{...options.headers,Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(180000)});
  if(!response.ok){await response.body?.cancel();throw new SocialMediaError(response.status===403?403:502,'No se pudo acceder al medio en el Studio.');}
  return response;
 }
 async function metadata(id,token){
  if(!uuid.test(id||''))throw new SocialMediaError(400,'Selecciona un medio válido.');
  const data=await(await request('/files/'+id+'?fields=id,type,filesize,modified_on,uploaded_on,title,folder,width,height',token)).json();
  const file=data.data;
  if(!file||!types[file.type]||!Number.isSafeInteger(Number(file.filesize))||Number(file.filesize)<=0||Number(file.filesize)>250*1024*1024)throw new SocialMediaError(400,'Utiliza una imagen o un vídeo MP4 de hasta 250 MB.');
  return file;
 }
 async function prepare(id,token,due=Date.now()){
  let file=await metadata(id,token);
  if(file.type.startsWith('image/')&&(file.type!=='image/jpeg'||Number(file.filesize)>5*1024*1024||file.folder!==SOCIAL_MEDIA_FOLDER||file.width!==1440||file.height!==1440)){
   const response=await request('/assets/'+id+'?width=1440&height=1440&fit=contain&format=jpg&quality=82',token);
   const chunks=[];let size=0;
   for await(const bytes of response.body){size+=bytes.length;if(size>5*1024*1024){await response.body.cancel().catch(()=>{});throw new SocialMediaError(400,'La imagen optimizada supera 5 MB. Selecciona una imagen más pequeña.');}chunks.push(bytes);}
   const form=new FormData();form.set('title',(file.title||'Fotografía')+' · Social');form.set('folder',SOCIAL_MEDIA_FOLDER);form.set('file',new Blob([Buffer.concat(chunks)],{type:'image/jpeg'}),'social.jpg');
   file=(await(await request('/files',token,{method:'POST',body:form})).json()).data;
   file=await metadata(file.id,token);
  }
  if(file.type!=='image/jpeg'&&file.type!=='video/mp4')throw new SocialMediaError(400,'Este formato no se puede publicar.');
  const nbf=Math.floor((due-5*60000)/1000),exp=Math.floor((due+3*3600000)/1000),version=mediaFingerprint(file),sig=mediaSignature(secret,file.id,nbf,exp,version);
  const url=new URL('/social-media/'+file.id,origin);for(const[k,v]of Object.entries({nbf,exp,v:version,sig}))url.searchParams.set(k,String(v));
  return {id:file.id,type:file.type.startsWith('video/')?'video':'image',mime:file.type,size:Number(file.filesize),url:url.href};
 }
 async function upload(req,token){
  const mime=String(req.headers['content-type']||'').split(';')[0],size=Number(req.headers['content-length']);
  const max=mime==='video/mp4'?250*1024*1024:25*1024*1024;
  if(!types[mime]||!Number.isSafeInteger(size)||size<=0||size>max)throw new SocialMediaError(400,'Envía una imagen de hasta 25 MB o un vídeo MP4 de hasta 250 MB.');
  const iterator=req[Symbol.asyncIterator](),first=await iterator.next();
  if(first.done)throw new SocialMediaError(400,'El archivo está vacío.');
  let head=first.value;
  while(head.length<32){const more=await iterator.next();if(more.done)break;head=Buffer.concat([head,more.value]);}
  const valid=mime==='image/jpeg'?head[0]===255&&head[1]===216&&head[2]===255:mime==='image/png'?head.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/webp'?head.toString('ascii',0,4)==='RIFF'&&head.toString('ascii',8,12)==='WEBP':head.toString('ascii',4,8)==='ftyp';
  if(!valid)throw new SocialMediaError(400,'El contenido del archivo no coincide con su formato.');
  const boundary='o7-'+randomBytes(20).toString('hex'),prefix=Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="folder"\r\n\r\n${SOCIAL_MEDIA_FOLDER}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="social${types[mime]}"\r\nContent-Type: ${mime}\r\n\r\n`),suffix=Buffer.from(`\r\n--${boundary}--\r\n`);
  async function* bytes(){
   let count=head.length;if(count>size)throw new SocialMediaError(413,'El archivo supera el tamaño declarado.');yield prefix;yield head;
   for(;;){const part=await iterator.next();if(part.done)break;count+=part.value.length;if(count>size||count>max)throw new SocialMediaError(413,'El archivo supera el tamaño permitido.');yield part.value;}
   if(count!==size)throw new SocialMediaError(400,'La transferencia del archivo está incompleta.');yield suffix;
  }
  const response=await request('/files',token,{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary='+boundary,'Content-Length':String(prefix.length+size+suffix.length)},body:Readable.from(bytes()),duplex:'half'});
  const file=(await response.json()).data;
  return prepare(file.id,token);
 }
 async function stream(req,res,id,token,version){
  const file=await metadata(id,token);
  if(version&&mediaFingerprint(file)!==version)throw new SocialMediaError(409,'Este medio cambió después de aprobar la publicación.');
  const headers={};if(req.headers.range){if(!/^bytes=(?:\d+-\d*|-\d+)$/.test(req.headers.range))throw new SocialMediaError(416,'Rango de vídeo inválido.');headers.Range=req.headers.range;}
  const response=await request('/assets/'+id,token,{method:req.method==='HEAD'?'HEAD':'GET',headers});
  res.writeHead(response.status,{'Content-Type':file.type,'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Accept-Ranges':'bytes',...(response.headers.get('content-length')?{'Content-Length':response.headers.get('content-length')}:{}),...(response.headers.get('content-range')?{'Content-Range':response.headers.get('content-range')}:{}),'Content-Disposition':'inline'});
  if(req.method==='HEAD'){res.end();return;}
  const source=Readable.fromWeb(response.body);res.on('close',()=>source.destroy());source.on('error',()=>res.destroy());source.pipe(res);
 }
 return {prepare,upload,privateStream:(req,res,id,token)=>stream(req,res,id,token),publicStream:(req,res,url)=>{const{id,version}=verifyMediaLease(secret,url);return stream(req,res,id,editorToken,version);}};
}
