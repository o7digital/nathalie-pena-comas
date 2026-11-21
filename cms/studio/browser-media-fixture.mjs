// Synthetic, browser-generated media for upload checks; no customer assets.
export async function browserMediaFixture(browser){
 const page=await browser.newPage();
 try{
  const result=await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;const context=canvas.getContext('2d');context.fillStyle='#234a87';context.fillRect(0,0,160,90);
   const photo=Array.from(new Uint8Array(await(await new Promise(resolve=>canvas.toBlob(resolve,'image/png'))).arrayBuffer()));
   const stream=canvas.captureStream(10),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});
   const stopped=new Promise(resolve=>{recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};recorder.onstop=resolve;});
   recorder.start();let frame=0;const timer=setInterval(()=>{context.fillStyle=++frame%2?'#234a87':'#305b9a';context.fillRect(0,0,160,90);context.fillStyle='#fff';context.font='16px sans-serif';context.fillText('Studio QA',28,50);},80);
   await new Promise(resolve=>setTimeout(resolve,650));clearInterval(timer);recorder.stop();await stopped;stream.getTracks().forEach(track=>track.stop());
   return {photo,video:Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer()))};
  });
  return {photo:Buffer.from(result.photo),video:Buffer.from(result.video)};
 }finally{await page.close();}
}
