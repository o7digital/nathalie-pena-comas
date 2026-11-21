import {validateVideoFile} from './video-data.js';
const cancelled=()=>new DOMException('Carga cancelada.','AbortError');
function transfer(path,body,{mime,signal,onProgress=()=>{}}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(cancelled());
  const xhr=new XMLHttpRequest(),abort=()=>xhr.abort();
  const finish=(error,value)=>{signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
  xhr.open('POST',path);xhr.timeout=15*60*1000;if(mime)xhr.setRequestHeader('Content-Type',mime);
  xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress(Math.min(99,Math.round(event.loaded/event.total*100)));};
  xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{return finish(Error('El servidor no confirmó el archivo. Vuelve a intentar.'));}if(xhr.status<200||xhr.status>=300)return finish(Error(data.error||'No se pudo subir el archivo.'));if(!data.data?.id)return finish(Error('El servidor no confirmó el archivo.'));onProgress(100);finish(null,data.data);};
  xhr.onerror=()=>finish(Error('No se pudo subir el archivo. Comprueba la conexión y vuelve a intentar.'));
  xhr.ontimeout=()=>finish(Error('La subida tardó demasiado. Comprueba la conexión y vuelve a intentar.'));
  xhr.onabort=()=>finish(cancelled());signal?.addEventListener('abort',abort,{once:true});onProgress(0);xhr.send(body);
 });
}
export function uploadPhoto(file,options={}){
 if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)||!file.size||file.size>25*1024*1024)return Promise.reject(Error('Selecciona una fotografía JPG, PNG, WebP o AVIF de hasta 25 MB.'));
 const form=new FormData();form.set('file',file);return transfer('/api/upload',form,options);
}
export function uploadVideo(file,options={}){return transfer('/api/media/upload',file,{...options,mime:validateVideoFile(file)});}
export function videoPoster(file,{signal}={}){
 validateVideoFile(file);
 return new Promise((resolve,reject)=>{
  const video=document.createElement('video'),url=URL.createObjectURL(file);let settled=false;
  const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);video.onloadeddata=null;video.onerror=null;video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);};
  const finish=(error,value)=>{if(settled)return;settled=true;cleanup();error?reject(error):resolve(value);};
  const abort=()=>finish(cancelled()),timer=setTimeout(()=>finish(Error('No se pudo leer el vídeo. Usa un archivo MP4 o WebM que se reproduzca en este navegador.')),20000);
  if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
  video.muted=true;video.playsInline=true;video.preload='auto';
  video.onerror=()=>finish(Error('Este vídeo no se puede reproducir en el navegador. Selecciona otro MP4 o WebM.'));
  video.onloadeddata=()=>{
   if(!video.videoWidth||!video.videoHeight)return finish(Error('El archivo no contiene una imagen de vídeo válida.'));
   const canvas=document.createElement('canvas');canvas.width=Math.min(1280,video.videoWidth);canvas.height=Math.max(1,Math.round(canvas.width*video.videoHeight/video.videoWidth));
   const context=canvas.getContext('2d');if(!context)return finish(Error('No se pudo crear la portada del vídeo.'));
   context.drawImage(video,0,0,canvas.width,canvas.height);
   canvas.toBlob(blob=>blob?finish(null,new File([blob],file.name.replace(/\.[^.]+$/,'')+'-portada.jpg',{type:'image/jpeg'})):finish(Error('No se pudo crear la portada del vídeo.')),'image/jpeg',.88);
  };
  video.src=url;video.load();
 });
}
