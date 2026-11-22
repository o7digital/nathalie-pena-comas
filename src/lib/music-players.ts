// Only official, recognized music URLs can become embedded players.
export function musicEmbed(value:string):{src:string;height:number;provider:string}|undefined {
 let url:URL;try{url=new URL(value);}catch{return;}
 if(url.protocol!=='https:'||url.username||url.password)return;
 const path=url.pathname.replace(/^\/intl-[\w-]+/,'');
 if(url.hostname==='open.spotify.com'){
  const match=path.match(/^\/(album|track|artist|playlist)\/([a-zA-Z\d]{22})\/?$/);
  if(match)return {src:`https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator`,height:match[1]==='track'?152:352,provider:'Spotify'};
 }
 if(['music.apple.com','geo.music.apple.com'].includes(url.hostname)&&/^\/[a-z]{2}\/album\/(?:[^/]+\/)?\d+\/?$/.test(path)){
  const track=url.searchParams.get('i');
  return {src:'https://embed.music.apple.com'+path+(track&&/^\d+$/.test(track)?'?i='+track:''),height:450,provider:'Apple Music'};
 }
 if(['www.deezer.com','deezer.com'].includes(url.hostname)){
  const match=path.match(/^\/(?:[a-z]{2}\/)?(album|track)\/(\d+)\/?$/);
  if(match)return {src:`https://widget.deezer.com/widget/auto/${match[1]}/${match[2]}`,height:match[1]==='track'?152:352,provider:'Deezer'};
 }
 if(['www.youtube.com','youtube.com','music.youtube.com','youtu.be'].includes(url.hostname)){
  const list=url.searchParams.get('list'),video=url.hostname==='youtu.be'?path.slice(1):url.searchParams.get('v');
  if(list&&/^[a-zA-Z\d_-]{10,100}$/.test(list))return {src:'https://www.youtube-nocookie.com/embed/videoseries?list='+list+'&autoplay=0',height:352,provider:'YouTube'};
  if(video&&/^[a-zA-Z\d_-]{11}$/.test(video))return {src:'https://www.youtube-nocookie.com/embed/'+video+'?autoplay=0',height:352,provider:'YouTube'};
 }
}

export function musicIdentity(value:string):string {
 try{
  const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)return '';
  const path=url.pathname.replace(/^\/intl-[\w-]+/,'').replace(/\/$/,'');
  if(['music.apple.com','geo.music.apple.com','geo.itunes.apple.com'].includes(url.hostname))return 'apple:'+path.split('/').at(-1)+(url.searchParams.get('i')?':'+url.searchParams.get('i'):'');
  if(['www.youtube.com','youtube.com','music.youtube.com','youtu.be'].includes(url.hostname))return 'youtube:'+(url.searchParams.get('list')||url.searchParams.get('v')||path.slice(1));
  if(['www.deezer.com','deezer.com'].includes(url.hostname))return 'deezer:'+path.replace(/^\/[a-z]{2}\//,'/');
  return url.hostname+path;
 }catch{return '';}
}

export function musicDuration(milliseconds:number):string {
 const seconds=Math.floor(milliseconds/1000);return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
}
