import { readContent, contentImage, externalLink, type ContentImage } from '../lib/cms';
import tierra from '../assets/official/tierra.jpg';
import alta from '../assets/official/alta-gracia.jpg';
import mujer from '../assets/official/una-mujer.jpg';
import souvenir from '../assets/official/souvenir.jpg';
const localAlbums=[
 {title:'Quinto Elemento: Tierra',image:tierra,url:'https://orcd.co/quintoelemento',detail:'Nathalie Peña-Comas'},
 {title:'Alta Gracia',image:alta,url:'https://open.spotify.com/album/186pleEY4aQjMXNuA8Z7xZ',detail:'Bratislava Festival Orchestra · Pablo Boggiano'},
 {title:'Una Mujer',image:mujer,url:'https://music.apple.com/us/album/una-mujer/1223241296',detail:'Nathalie Peña-Comas'},
 {title:'Souvenir Latino',image:souvenir,url:'https://music.apple.com/ca/album/souvenir-latino/1268832661',detail:'Ensemble Spirituosi'},
];

const cmsAlbums = await readContent('albums');
export const albums: { title: string; image: ContentImage; url: string; detail: string; category: string }[] = cmsAlbums === null ? localAlbums.map((row, i) => ({ ...row, category: [1,3].includes(i) ? 'classical' : 'contemporary' })) : cmsAlbums.map(row => ({title: row.title, image: contentImage(row.image), url: externalLink(row.url), detail: row.detail || '', category: row.category || (['album-2','album-4'].includes(row.id) ? 'classical' : 'contemporary')}));
if (!albums.length) throw new Error('Publish at least one album before building the site.');
