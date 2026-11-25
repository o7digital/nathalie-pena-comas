export const editingKinds={
 seo:{label:'SEO · No tocar',symbol:'!',help:'Este texto influye en el SEO. Consulta al responsable SEO antes de modificarlo.'},
 text:{label:'Texto · Puedes editar',symbol:'✎',help:'Puedes actualizar este texto. Conserva las expresiones protegidas de la sección.'},
 media:{label:'Fotos y vídeos · Subir archivos',symbol:'↑',help:'Sube o reemplaza tus fotografías, portadas y vídeos en las zonas azules.'}
};
export function guidanceBadge(kind){const item=editingKinds[kind];return `<span class="editing-badge" data-editing-kind="${kind}"><span aria-hidden="true">${item.symbol}</span> ${item.label}</span>`;}
export function editingLegend(){return `<aside class="editing-legend" aria-label="Guía de colores para editar"><strong>Antes de editar</strong><div>${Object.keys(editingKinds).map(kind=>`<div class="editing-guide" data-editing-kind="${kind}">${guidanceBadge(kind)}<p>${kind==='seo'?'Rojo: títulos, palabras protegidas y ajustes SEO. No los cambies sin consultar.':kind==='text'?'Verde: textos que puedes modificar. Se traducen al guardar.':'Azul: espacios para subir fotos y vídeos desde tu dispositivo.'}</p></div>`).join('')}</div></aside>`;}
