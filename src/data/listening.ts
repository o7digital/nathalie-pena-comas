import catalogue from './listening-catalog.json';
import {albums} from './albums';
import type {ContentImage} from '../lib/cms';
import sombras from '../assets/sombras-cover.jpg';
import esclavo from '../assets/esclavo-cover.jpg';
import portrait from '../assets/official/editorial.jpg';
import {musicIdentity} from '../lib/music-players';

const byUrl=new Map(catalogue.releases.flatMap(release=>[...release.aliases,...release.services.map(service=>service.url)].filter(url=>!url.includes('itunes.apple.com')).map(url=>[musicIdentity(url),release.key])));
export const listeningKey=(url:string)=>byUrl.get(musicIdentity(url));
export const listeningAttributes=(url:string)=>{const key=listeningKey(url);return key?{'data-listen':key}:{};};
export const listeningReleases=catalogue.releases.flatMap(release=>{
 const album=albums.find(album=>listeningKey(album.url)===release.key);
 const single=release.key==='sombras-nada-mas'?sombras:release.key==='esclavo-y-amo'?esclavo:undefined;
 const image:ContentImage|undefined=album?.image||single;
 return image?[{...release,title:album?.title||release.title,image}]:[];
});
export const listeningArtist={key:'nathalie',title:'Nathalie Peña-Comas',artist:'Nathalie Peña-Comas',image:portrait,services:[
 {id:'spotify',url:'https://open.spotify.com/artist/3lDJkwtZmncXJuv2BUpB80'},
 {id:'apple',url:'https://music.apple.com/us/artist/nathalie-pe%C3%B1a-comas/1223241299'},
 {id:'youtube',url:'https://www.youtube.com/channel/UCV9Oc0ONMX89lx1z-4vGZmQ'},
]};
export const serviceNames:Record<string,string>={spotify:'Spotify',apple:'Apple Music',youtube:'YouTube',deezer:'Deezer',amazon:'Amazon Music',tidal:'TIDAL',itunes:'iTunes'};
