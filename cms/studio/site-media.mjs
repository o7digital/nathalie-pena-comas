import {Readable} from 'node:stream';
import {randomBytes} from 'node:crypto';
import {VIDEO_LIMIT,VIDEO_TYPES,videoFileId,videoSourceType} from './public/video-data.js';
export class SiteMediaError extends Error{constructor(status,message){super(message);this.status=status;}}
export const SITE_VIDEO_FOLDER='a33c4117-c069-435a-9cb8-6374f2342cf0';
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const identifier=/^[a-zA-Z\d_-]{1,200}$/;
export function createSiteMedia({cms,editorToken}){
 const base=cms.replace(/\/$/,'');
 async function request(path,token,options={}){
  const response=await fetch(base+path,{...options,headers:{...options.headers,Authorization:'Bearer '+token},redirect:'error',signal:options.signal||AbortSignal.timeout(30000)});
  if(!response.ok){await response.body?.cancel();throw new SiteMediaError([401,403,404,416].includes(response.status)?response.status:502,'No se pudo acceder al vídeo en el Studio.');}return response;
 }
 async function metadata(id,token){
  if(!uuid.test(id||''))throw new SiteMediaError(400,'Selecciona un vídeo válido.');
  const file=(await(await request('/files/'+id+'?fields=id,title,type,filesize,folder',token)).json()).data;
  if(!file||!VIDEO_TYPES[file.type]||file.folder!==SITE_VIDEO_FOLDER||!Number.isSafeInteger(Number(file.filesize))||Number(file.filesize)<=0||Number(file.filesize)>VIDEO_LIMIT)throw new SiteMediaError(400,'Selecciona un vídeo MP4 o WebM subido para este sitio, de hasta 250 MB.');
  return file;
 }
 async function upload(req,token){
  const mime=String(req.headers['content-type']||'').split(';')[0],size=Number(req.headers['content-length']);
  if(!VIDEO_TYPES[mime]||!Number.isSafeInteger(size)||size<=0||size>VIDEO_LIMIT)throw new SiteMediaError(400,'Envía un vídeo MP4 o WebM de hasta 250 MB.');
  const iterator=req[Symbol.asyncIterator]();let first=await iterator.next();if(first.done)throw new SiteMediaError(400,'El archivo está vacío.');let head=first.value;
  while(head.length<16){first=await iterator.next();if(first.done)break;head=Buffer.concat([head,first.value]);}
  const valid=mime==='video/mp4'?head.length>=12&&head.toString('ascii',4,8)==='ftyp':head.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  if(!valid)throw new SiteMediaError(400,'El contenido del archivo no coincide con su formato de vídeo.');
  const boundary='npc-'+randomBytes(18).toString('hex'),prefix=Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="folder"\r\n\r\n${SITE_VIDEO_FOLDER}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="video${VIDEO_TYPES[mime]}"\r\nContent-Type: ${mime}\r\n\r\n`),suffix=Buffer.from(`\r\n--${boundary}--\r\n`);
  async function* chunks(){
   let count=head.length;if(count>size)throw new SiteMediaError(413,'El vídeo supera el tamaño declarado.');yield prefix;yield head;
   for(;;){const part=await iterator.next();if(part.done)break;count+=part.value.length;if(count>size||count>VIDEO_LIMIT)throw new SiteMediaError(413,'El vídeo supera el tamaño permitido.');yield part.value;}
   if(count!==size)throw new SiteMediaError(400,'La transferencia del vídeo está incompleta.');yield suffix;
  }
  const controller=new AbortController(),cancel=()=>controller.abort();req.on('aborted',cancel);
  try{
   const response=await request('/files',token,{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary='+boundary,'Content-Length':String(prefix.length+size+suffix.length)},body:Readable.from(chunks()),duplex:'half',signal:controller.signal});
   const file=(await response.json()).data;return metadata(file?.id,token);
  }finally{req.off('aborted',cancel);}
 }
 async function stream(req,res,id,token,isPublic=false){
  const file=await metadata(id,token),headers={};
  if(req.headers.range){if(!/^bytes=(?:\d+-\d*|-\d+)$/.test(req.headers.range))throw new SiteMediaError(416,'Rango de vídeo inválido.');headers.Range=req.headers.range;}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);let response;
  try{response=await request('/assets/'+id,token,{method:req.method==='HEAD'?'HEAD':'GET',headers,signal:controller.signal});}finally{clearTimeout(timer);}
  const output={'Content-Type':file.type,'Cache-Control':'no-store','Accept-Ranges':'bytes','Content-Disposition':'inline','X-Robots-Tag':'noindex, nofollow',...(isPublic?{'Access-Control-Allow-Origin':'*'}:{Vary:'Cookie'})};
  for(const header of ['content-length','content-range'])if(response.headers.get(header))output[header]=response.headers.get(header);
  res.writeHead(response.status,output);if(req.method==='HEAD'){res.end();return;}
  const source=Readable.fromWeb(response.body);res.on('close',()=>{controller.abort();source.destroy();});source.on('error',()=>res.destroy());source.pipe(res);
 }
 async function publicStream(req,res,recordId,id){
  if(!identifier.test(recordId)||!uuid.test(id)||!editorToken)throw new SiteMediaError(404,'Vídeo no disponible.');
  const row=(await(await request('/items/videos/'+encodeURIComponent(recordId)+'?fields=id,status,source_type,video_file',editorToken)).json()).data;
  if(!row||row.status!=='published'||videoSourceType(row)!=='upload'||videoFileId(row)!==id)throw new SiteMediaError(404,'Vídeo no disponible.');
  return stream(req,res,id,editorToken,true);
 }
 return {upload,metadata,privateStream:stream,publicStream};
}
