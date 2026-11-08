import { readFile,writeFile } from 'node:fs/promises';
import ts from 'typescript';
const specs=[
 ['home','Inicio','home','home','Hero','hero'],['about','La artista','photo','about','Story','story'],
 ['voice','Trayectoria','briefcase','voice','International'],['albums','Discografía','album','music','Releases',null,'albums'],
 ['concerts','Agenda','calendar','schedule','Schedule',null,'concerts'],['repertorio','Repertorio','album','repertorio','Repertoire'],
 ['videos','Vídeos','video','media','Videos',null,'videos'],['news','Prensa y noticias','text','news','Editorial','press'],
 ['spirituosi','Spirituosi','people','spirituosi','Spirituosi','spirituosi'],['gallery','Galería','photo','gallery','Gallery',null,'gallery'],
 ['newsletter','Newsletter','text','newsletter','Newsletter'],['contact','Contacto','people','contact','Footer'],
 ['settings','Idiomas y ajustes','layout','home','Header,Dialogs,Privacy'],
];
const translationFile=await readFile('src/data/translations.ts','utf8');
const ast=ts.createSourceFile('translations.ts',translationFile,ts.ScriptTarget.Latest,true);
let original;
for(const statement of ast.statements)if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations)if(declaration.name.getText(ast)==='originalTranslations') {
 const node=ts.isAsExpression(declaration.initializer)?declaration.initializer.expression:declaration.initializer;
 original=Object.fromEntries(node.properties.map(prop=>[prop.name.text,Object.fromEntries(prop.initializer.properties.map(entry=>[entry.name.text,entry.initializer.text]))]));
}
const literal=value=>{const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,value);scanner.scan();return scanner.getTokenValue();};
const calls=/\bl\(\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*(?:,\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*)?\)/g;
const sections=[];
for(const [id,title,icon,anchor,components,image,collection]of specs) {
 const fields=new Map();let count=0;
 for(const component of components.split(',')) {
  const source=await readFile(`src/components/${component}.astro`,'utf8');
  const matches=[...source.matchAll(calls)].map(match=>({key:'copy:'+(match[2]?literal(match[2]):literal(match[1])),source:literal(match[1]),english:match[2]?literal(match[2]):literal(match[1]),index:match.index}));
  for(const match of source.matchAll(/\bt\.([a-zA-Z\d]+)/g))if(original.es[match[1]])matches.push({key:'translation:'+match[1],source:original.es[match[1]],english:original.en[match[1]],index:match.index});
  for(const match of matches.sort((a,b)=>a.index-b.index)) {
   if(fields.has(match.key))continue;
   const before=source.slice(Math.max(0,match.index-180),match.index);
   const tag=(before.match(/<([\w]+)\b[^<>]*>[^<>]*$/)||before.match(/<([\w]+)[^<>]*$/))?.[1];
   const auxiliary=/aria-|alt=|placeholder=|const labels=|data-/.test(before.slice(-70)) || /(?:Anterior|Siguiente|Cerrar|Pausar|Reanudar|Carrusel|Fotografía anterior|Fotografía siguiente|Ampliar)/i.test(match.source);
   const label=tag?.match(/^h[1-6]$/)||(tag==='em'&&/<h[1-6]/.test(before))?'Título':tag==='a'?'Texto del enlace':/class="(?:kicker|eyebrow)"[^<>]*>[^<>]*$/.test(before)?'Antetítulo':match.source.length>110?'Párrafo':match.key==='translation:storyP2'?'Biografía breve':tag==='p'||match.source.length>60?'Descripción':'Texto';
   fields.set(match.key,{key:match.key,source:match.source,english:match.english,label:`${label}${label==='Párrafo'?' '+(++count):''}`,auxiliary});
  }
 }
 sections.push({id,title,icon,anchor,image:image||null,collection:collection||null,fields:[...fields.values()]});
}
const output=JSON.stringify({sourceLocale:'es',sections},null,2)+'\n';
if(process.argv.includes('--check')){if(await readFile('cms/studio/site-map.json','utf8')!==output)throw new Error('Site map is outdated. Run npm run cms:map.');}
else await writeFile('cms/studio/site-map.json',output);
console.log('Site map generated:',sections.length,'sections;',new Set(sections.flatMap(section=>section.fields.map(row=>row.key))).size,'Spanish text fields.');
