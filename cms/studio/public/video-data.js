export const VIDEO_LIMIT=250*1024*1024;
export const VIDEO_TYPES={'video/mp4':'.mp4','video/webm':'.webm'};
export const videoFileId=row=>typeof row?.video_file==='string'?row.video_file:row?.video_file?.id||'';
export const videoSourceType=row=>row?.source_type||(videoFileId(row)?'upload':'youtube');
export function videoMime(file){return file.type==='video/x-m4v'&&/\.m4v$/i.test(file.name)?'video/mp4':file.type;}
export function validateVideoFile(file){
 const mime=videoMime(file);
 if(!VIDEO_TYPES[mime])throw Error('Selecciona un vídeo MP4 o WebM.');
 if(!file.size||file.size>VIDEO_LIMIT)throw Error('El vídeo puede ocupar hasta 250 MB.');
 return mime;
}
