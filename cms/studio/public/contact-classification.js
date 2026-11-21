// Shared, explicit classifications. Never infer gender, nationality or interests.
const countryCodes='AD AE AR AT AU BE BG BO BR CA CH CL CN CO CR CU CZ DE DK DO EC EE EG ES FI FR GB GR GT HK HN HR HU ID IE IL IN IS IT JM JP KR LU MA MX NI NL NO NZ PA PE PH PL PR PT PY RO RS RU SA SE SG SI SK SV TH TR TW UA US UY VE VN ZA'.split(' ');
const languageCodes='ar bg ca cs da de el en es et fi fr he hi hr hu id it ja ko nl no pl pt ro ru sk sl sr sv th tr uk vi zh'.split(' ');
const names=type=>new Intl.DisplayNames(['es'],{type});
const countries=countryCodes.map(code=>names('region').of(code)).sort((a,b)=>a.localeCompare(b,'es'));
const languages=languageCodes.map(code=>names('language').of(code)).sort((a,b)=>a.localeCompare(b,'es'));
export const genderLabels={'':'Sin especificar',female:'Mujer',male:'Hombre',nonbinary:'No binario',undisclosed:'Prefiere no indicarlo'};
export const facets={
 relationshipTypes:{label:'Tipos de relación',options:['Programador/a','Teatro / Ópera','Festival','Agencia / Representación','Orquesta / Ensemble','Prensa / Medios','Artista / Colaborador','Producción','Otro']},
 groups:{label:'Grupos',options:['Programación internacional','Colaboradores','Instituciones culturales','Invitados','Prensa','Estudiantes']},
 countries:{label:'Países de residencia',options:countries},
 nationalities:{label:'Nacionalidades / Países de origen',options:countries},
 languages:{label:'Idiomas',options:languages},
 roles:{label:'Cargos / Funciones',options:['Director/a de teatro','Director/a de ópera','Director/a de auditorio','Director/a musical','Director/a de orquesta','Director/a de festival','Programador/a','Agente / Representante','Promotor/a','Productor/a','Periodista / Prensa','Artista','Estudiante']},
 musicGenres:{label:'Tipos de música',options:['Música clásica','Música contemporánea','Ópera','Música sacra','Música de cámara','Música latinoamericana']},
 eventTypes:{label:'Tipos de concierto / Evento',options:['Concierto clásico','Concierto contemporáneo','Ópera / Producción escénica','Concierto de ópera','Concierto sacro','Recital','Festival','Masterclass']},
 venueTypes:{label:'Espacios / Instituciones',options:['Teatro','Teatro de ópera','Auditorio','Auditorio Nacional','Sala de conciertos','Festival','Orquesta','Agencia','Conservatorio / Universidad','Iglesia / Institución religiosa','Medio de comunicación']},
 markets:{label:'Países de actividad / Destino',options:countries},
 campaignTags:{label:'Campañas / Etiquetas',options:['Día de las Madres','Gira Rusia','Gira Japón','Quinto Elemento','Invitación a concierto','Presentación profesional']},
};
export const classificationFields=[...Object.keys(facets),'gender'];
const norm=value=>String(value??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').trim().toLowerCase();
export function facetValues(row,key){
 if(key==='gender')return row.gender?[row.gender]:[];
 if(Array.isArray(row[key]))return row[key];
 return key==='relationshipTypes'&&row.companySector?[row.companySector]:[];
}
export function validateClassifications(input){
 const result={};
 for(const key of classificationFields){
  if(!Object.hasOwn(input,key))continue;
  if(key==='gender'){
   if(typeof input[key]!=='string'||!Object.hasOwn(genderLabels,input[key]))throw Error('Selecciona un género válido.');
   result[key]=input[key];continue;
  }
  if(!Array.isArray(input[key])||input[key].length>40)throw Error('Selecciona como máximo 40 opciones en '+facets[key].label+'.');
  const seen=new Set();result[key]=[];
  for(const value of input[key]){
   if(typeof value!=='string'||!value.trim()||value.trim().length>120||/[\u0000-\u001f|]/.test(value))throw Error('Revisa las opciones de '+facets[key].label+'. No uses el separador |.');
   const text=value.trim().replace(/\s+/g,' '),identity=norm(text);
   if(!seen.has(identity)){seen.add(identity);result[key].push(text);}
  }
 }
 return result;
}
// OR within a facet; AND between facets. Unspecified data never matches a choice.
export function matchesFacets(row,filters={}){
 return Object.entries(filters).every(([key,selected])=>!selected?.length||selected.some(value=>facetValues(row,key).some(current=>norm(current)===norm(value))));
}
