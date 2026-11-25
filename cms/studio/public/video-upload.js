import {guidanceBadge} from './editor-guidance.js';
import {videoFileId,videoSourceType,validateVideoFile} from './video-data.js';
import {uploadVideo,uploadPhoto,videoPoster} from './media-upload.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createVideoUploadUI({getImage,onPoster,isSaving=()=>false}){
 let state={},generation=0;
 const $=selector=>document.querySelector(selector);
 function reset(){generation++;state.controller?.abort();if(state.url?.startsWith('blob:'))URL.revokeObjectURL(state.url);$('#video-upload-preview video')?.pause();state={};}
 function sync(){
  const native=$('#video-native-source'),youtube=$('#video-youtube-source');if(!native)return;
  const upload=state.mode==='upload';native.hidden=!upload;youtube.hidden=upload;const input=youtube.querySelector('input');input.disabled=upload;input.required=!upload;
  const preview=$('#video-upload-preview'),src=state.url||(state.id?'/api/video/'+encodeURIComponent(state.id):'');
  if(!upload){preview.querySelector('video')?.pause();preview.innerHTML='';}
  else if(src&&preview.dataset.src!==src){preview.innerHTML=`<video controls playsinline preload="metadata" src="${esc(src)}" aria-label="Vista previa de tu vídeo"></video>`;preview.dataset.src=src;}
  const status=$('#video-upload-status');status.textContent=state.message||'Selecciona un archivo desde tu dispositivo.';
  $('#video-upload-error').textContent=state.error||'';$('#video-upload-progress').hidden=!state.busy;$('#video-upload-progress').value=state.progress||0;
  $('#cancel-video-upload').hidden=!state.busy;$('#retry-video-upload').hidden=state.busy||!state.file||!state.error;
  $('#choose-video-upload').textContent=state.file||state.id?'Subir otro vídeo':'Subir vídeo desde mi dispositivo';
  const save=$('#editor-form [type=submit]');if(save)save.disabled=Boolean(state.busy)||isSaving();
 }
 function cancel(){generation++;state.controller?.abort();state.controller=null;state.busy=false;state.id='';state.error='Carga cancelada. Puedes volver a intentar.';state.message='El archivo no se ha guardado en tu ficha.';sync();}
 async function start(file){
  const job=++generation,controller=new AbortController();state.controller=controller;state.busy=true;state.error='';state.message='Leyendo el vídeo y creando su portada…';state.progress=0;sync();
  try{
   const poster=state.poster||await videoPoster(file,{signal:controller.signal});if(job!==generation)return;state.poster=poster;
   if(!state.id){state.message='Subiendo vídeo…';sync();const uploaded=await uploadVideo(file,{signal:controller.signal,onProgress:progress=>{if(job===generation){state.progress=progress;state.message=`Subiendo vídeo… ${progress}%`;sync();}}});if(job!==generation)return;state.id=uploaded.id;}
   if(getImage()===state.startImage){state.message='Subiendo la fotografía de portada…';sync();const image=await uploadPhoto(poster,{signal:controller.signal});if(job!==generation)return;if(getImage()===state.startImage)onPoster(image.id);}
   if(job!==generation)return;state.message='Vídeo listo. Revisa su portada y guarda los cambios.';
  }catch(error){if(job!==generation)return;state.error=error.name==='AbortError'?'Carga cancelada. Puedes volver a intentar.':error.message;state.message=state.id?'Vídeo subido. Añade o revisa la portada antes de guardar.':'La ficha conserva los textos que has escrito.';}
  finally{if(job===generation){state.busy=false;state.controller=null;sync();}}
 }
 async function choose(file){
  if(!file||!$('#editor')?.open||isSaving())return;
  try{validateVideoFile(file);}catch(error){state.error=error.message;sync();return;}
  generation++;state.controller?.abort();if(state.url?.startsWith('blob:'))URL.revokeObjectURL(state.url);
  state={...state,id:'',file,url:URL.createObjectURL(file),poster:null,startImage:getImage(),mode:'upload',error:'',busy:false};
  const title=$('#editor-form [name=title]');if(title&&!title.value.trim())title.value=file.name.replace(/\.[^.]+$/,'').replace(/[_-]/g,' ');
  sync();await start(file);
 }
 function open(row){
  reset();state={id:videoFileId(row),mode:row.id?videoSourceType(row):'upload',busy:false,message:videoFileId(row)?'Vídeo guardado. Puedes reproducirlo o sustituirlo.':'',error:''};
  const upload=state.mode==='upload';
  return `<fieldset class="video-source-editor" data-editing-kind="media"><legend>Tu vídeo</legend>${guidanceBadge('media')}<label>Cómo quieres añadirlo<select name="source_type" id="video-source-type"><option value="upload" ${upload?'selected':''}>Subir un archivo de vídeo</option><option value="youtube" ${!upload?'selected':''}>Usar un enlace de YouTube</option></select></label><div id="video-native-source" ${upload?'':'hidden'}><div class="video-upload-zone" id="video-dropzone"><button type="button" class="button primary" id="choose-video-upload">${state.id?'Subir otro vídeo':'Subir vídeo desde mi dispositivo'}</button><p>O arrastra aquí un vídeo MP4 o WebM · Hasta 250 MB.</p></div><div id="video-upload-preview"></div><p id="video-upload-status" role="status">${esc(state.message||'Selecciona un archivo desde tu dispositivo.')}</p><progress id="video-upload-progress" max="100" value="0" aria-label="Progreso de subida del vídeo" hidden></progress><div class="video-upload-actions"><button type="button" class="button quiet" id="cancel-video-upload" hidden>Cancelar subida</button><button type="button" class="button quiet" id="retry-video-upload" hidden>Volver a intentar</button></div><p id="video-upload-error" class="form-error" role="alert"></p><p class="editor-help">Se crea una portada con el primer fotograma. Puedes subir otra fotografía como portada antes de guardar.</p></div><div id="video-youtube-source" ${upload?'hidden':''}><label>Enlace de YouTube<input name="youtube_id" type="text" value="${esc(row.youtube_id?'https://www.youtube.com/watch?v='+row.youtube_id:'')}" ${upload?'disabled':'required'} placeholder="https://www.youtube.com/watch?v=…"></label><p class="editor-help">El reproductor se abre cuando el visitante decide ver el vídeo.</p></div></fieldset>`;
 }
 document.addEventListener('click',event=>{
  const id=event.target.closest('button')?.id;
  if(id==='choose-video-upload')$('#editor-video-upload').click();
  if(id==='cancel-video-upload')cancel();
  if(id==='retry-video-upload'&&state.file)start(state.file);
 });
 document.addEventListener('change',event=>{
  if(event.target.id==='editor-video-upload'){choose(event.target.files[0]);event.target.value='';}
  if(event.target.id==='video-source-type'){if(state.busy)cancel();state.mode=event.target.value;const preview=$('#video-upload-preview');preview.dataset.src='';sync();}
 });
 document.addEventListener('dragover',event=>{if(event.target.closest('#video-dropzone'))event.preventDefault();});
 document.addEventListener('drop',event=>{if(!event.target.closest('#video-dropzone'))return;event.preventDefault();const files=[...event.dataTransfer.files];if(files.length!==1){state.error='Selecciona un vídeo cada vez.';sync();return;}choose(files[0]);});
 return {open,mounted:sync,reset,manualCoverSelected:()=>{state.startImage=null;},isBusy:()=>Boolean(state.busy),hasPending:()=>Boolean(state.file),data(form){
  const mode=form.elements.source_type.value;
  if(mode==='upload'){if(state.busy)throw Error('Espera a que termine la subida del vídeo.');if(!state.id)throw Error('Sube un vídeo antes de guardar.');return {source_type:'upload',video_file:state.id,youtube_id:null};}
  return {source_type:'youtube',video_file:null,youtube_id:form.elements.youtube_id.value};
 }};
}
