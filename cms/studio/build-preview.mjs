import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {annotatePreview,previewPath} from './preview.mjs';
import siteMap from './site-map.json' with {type:'json'};
const snapshot=JSON.parse(await readFile('dist/studio-snapshot.json','utf8'));
await mkdir('dist/_studio/pages',{recursive:true});
let count=0;
for(const locale of snapshot.locales)for(const privacy of [false,true]){
 const page=`/${locale}/${privacy?'privacy/':''}`;
 const html=await readFile(`dist${page}index.html`,'utf8');
 const preview=annotatePreview(html,{texts:snapshot.texts[locale],images:snapshot.images,sections:siteMap.sections,initialSection:privacy?'privacy':'settings'});
 await writeFile(`dist${previewPath(page)}`,JSON.stringify({version:1,page,html:preview}));count++;
}
await rm('dist/studio-snapshot.json');
console.log(`Studio: ${count} visual page previews generated.`);
