// Shared by the private Studio server and its contact import preview.
export const contactFields=['firstName','name','company','function','companySector','clientStatus','email','phone','website','address','notes'];
export const contactTypes=['Programador/a','Teatro / Ópera','Festival','Agencia / Representación','Orquesta / Ensemble','Prensa / Medios','Artista / Colaborador','Producción','Otro'];
export const contactStatuses={PROSPECT:'Por contactar',CLIENT:'Relación activa',LOST:'Inactivo'};
export class ArmError extends Error {constructor(message,status=400){super(message);this.status=status;}}
export const contactName=row=>[row.firstName,row.name].filter(Boolean).join(' ');
export const normalized=value=>String(value??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').trim().replace(/\s+/g,' ').toLowerCase();
export function contactKeys(row){
 const keys=[];
 if(row.email)keys.push('email:'+normalized(row.email));
 if(row.name)keys.push('name:'+normalized(contactName(row))+'|'+normalized(row.company));
 return keys;
}
export function validateContact(input,{partial=false}={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!contactFields.includes(key)))throw new ArmError('La ficha contiene campos no permitidos.');
 const result={};
 for(const [key,value]of Object.entries(input)){
  if(typeof value!=='string')throw new ArmError('Revisa el campo '+key+'.');
  const text=value.trim();
  const limit=key==='notes'?20000:['website','address'].includes(key)?2048:['phone','email'].includes(key)?254:120;
  if(text.length>limit)throw new ArmError('El campo '+key+' supera '+limit+' caracteres.');
  result[key]=key==='email'?text.toLowerCase():text;
 }
 if((!partial||Object.hasOwn(result,'name'))&&!result.name)throw new ArmError('Escribe los apellidos o el nombre profesional.');
 if(result.clientStatus&&!Object.hasOwn(contactStatuses,result.clientStatus))throw new ArmError('Selecciona un estado de relación válido.');
 if(result.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))throw new ArmError('Revisa el correo electrónico.');
 if(result.website){let url;try{url=new URL(result.website);}catch{}if(!url||!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new ArmError('La web debe empezar por https:// o http://.');}
 if(!partial&&!result.clientStatus)result.clientStatus='PROSPECT';
 return result;
}

const aliases={firstName:['nombre','prenom','firstname','first name'],name:['apellidos','apellido','nom','lastname','last name','name','nombre profesional'],company:['organizacion','organización','empresa','company','organisation','organization'],function:['cargo','funcion','función','function','role','poste'],companySector:['tipo','categoria','categoría','sector','companysector','type'],clientStatus:['estado','status','clientstatus'],email:['correo','correo electronico','email','e-mail'],phone:['telefono','teléfono','phone','telephone'],website:['web','website','sitio web','site web'],address:['direccion','dirección','address','adresse','ciudad / pais'],notes:['notas','notes','comentarios']};
const headers=new Map(Object.entries(aliases).flatMap(([key,values])=>[key,...values].map(value=>[normalized(value),key])));
export function csvCells(text){
 if(typeof text!=='string'||text.length>2_000_000)throw new ArmError('El CSV puede ocupar como máximo 2 MB.');
 text=text.replace(/^\uFEFF/,'');
 const first=text.split(/\r?\n/,1)[0];
 const delimiter=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c==='"'&&!cell&&!closed){quoted=true;continue;}
  if(c===delimiter){row.push(cell);cell='';closed=false;continue;}
  if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';closed=false;continue;}
  if(closed&&c.trim())throw new ArmError('El CSV contiene comillas o separadores incorrectos.');
  cell+=c;
 }
 if(quoted)throw new ArmError('El CSV contiene un campo entre comillas sin cerrar.');
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 if(rows.length>501)throw new ArmError('Importa como máximo 500 contactos cada vez.');
 return rows;
}
export function parseContactsCsv(text){
 const [heading,...rows]=csvCells(text);
 if(!heading||!rows.length)throw new ArmError('El archivo necesita una cabecera y al menos un contacto.');
 const mapping=heading.map(value=>headers.get(normalized(value)));
 if(!mapping.includes('name'))throw new ArmError('Añade una columna «Apellidos» o «Nombre profesional». Puedes descargar la plantilla.');
 if(new Set(mapping.filter(Boolean)).size!==mapping.filter(Boolean).length)throw new ArmError('Hay dos columnas asignadas al mismo campo.');
 return rows.map((cells,index)=>{
  const raw=Object.fromEntries(mapping.flatMap((key,i)=>key?[[key,cells[i]||'']]:[]));
  try{
   if(cells.length!==heading.length)throw new ArmError('El número de columnas no coincide con la cabecera.');
   const status=normalized(raw.clientStatus);
   if(status){const match=Object.entries(contactStatuses).find(([key,label])=>normalized(key)===status||normalized(label)===status);if(match)raw.clientStatus=match[0];}
   return {line:index+2,contact:validateContact(raw)};
  }catch(error){return {line:index+2,contact:raw,error:error.message};}
 });
}
export function contactsCsv(rows){
 const cell=value=>'"'+String(value??'').replace(/^[\s]*[=+@-]/,"'$&").replace(/"/g,'""')+'"';
 return '\uFEFF'+[contactFields,...rows.map(row=>contactFields.map(key=>row[key]??''))].map(row=>row.map(cell).join(',')).join('\r\n');
}
