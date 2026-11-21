import {facets,facetValues,genderLabels} from './contact-classification.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=value=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
function picker(key,label,options,values,mode){
 const choices=[...new Set([...values,...options])];
 return `<details class="arm-facet" data-facet="${key}" data-mode="${mode}"><summary>${esc(label)} <span data-facet-count>${values.length?'· '+values.length:''}</span></summary><div class="arm-facet-menu"><input type="search" data-facet-search aria-label="Buscar en ${esc(label)}" placeholder="Buscar una opción…"><div class="arm-facet-options">${choices.map(value=>`<label><input type="checkbox" data-facet-value value="${esc(value)}" ${values.includes(value)?'checked':''}> <span>${esc(key==='gender'?genderLabels[value]||value:value)}</span></label>`).join('')}</div>${mode==='edit'?'<div class="arm-tag-add"><input data-facet-custom maxlength="120" aria-label="Nueva opción de '+esc(label)+'" placeholder="Añadir otra opción…"><button class="button quiet" type="button" data-facet-add>Añadir</button></div>':''}</div></details>`;
}
export function classificationEditor(row){
 return `<section class="arm-form-section"><h3>Clasificación múltiple</h3><p class="arm-help">Marca todas las opciones que correspondan. Puedes añadir tus propios grupos, cargos y etiquetas.</p><div class="arm-facet-grid">${Object.entries(facets).map(([key,facet])=>picker(key,facet.label,facet.options,facetValues(row,key),'edit')).join('')}<label>Género<select name="gender">${Object.entries(genderLabels).map(([key,label])=>`<option value="${key}" ${row.gender===key?'selected':''}>${label}</option>`).join('')}</select></label></div></section>`;
}
export function classificationFilters(rows,filters){
 return `<div class="arm-advanced-filters"><p>Combinar filtros <small>Varias opciones por filtro · Se combinan los criterios</small></p><div class="arm-facet-grid">${[...Object.entries(facets),['gender',{label:'Género',options:Object.keys(genderLabels).filter(Boolean)}]].map(([key,facet])=>picker(key,facet.label,[...new Set(rows.flatMap(row=>facetValues(row,key)))].sort((a,b)=>a.localeCompare(b,'es')),filters[key]||[],'filter')).join('')}</div><div class="arm-filter-selection" aria-live="polite">${filterChips(filters)}</div><button class="arm-text-button" data-arm-clear>Limpiar todos los filtros</button></div>`;
}
export function filterChips(filters){
 return Object.entries(filters).flatMap(([key,values])=>values.map(value=>`<button class="arm-chip" data-filter-remove="${key}" data-filter-value="${esc(value)}" aria-label="Quitar ${esc(genderLabels[value]||value)}">${esc(genderLabels[value]||value)} ×</button>`)).join('');
}
export function readClassification(form){
 return Object.fromEntries(Object.keys(facets).map(key=>[key,[...form.querySelectorAll(`[data-facet="${key}"] [data-facet-value]:checked`)].map(input=>input.value)]));
}
export function classificationSummary(row){
 const entries=[...Object.entries(facets).map(([key,facet])=>[facet.label,facetValues(row,key)]),['Género',row.gender?[genderLabels[row.gender]]:[]]].filter(([,values])=>values.length);
 return `<section class="panel arm-classification-summary"><h3>Grupos e intereses</h3>${entries.length?'<dl>'+entries.map(([label,values])=>`<dt>${esc(label)}</dt><dd>${values.map(value=>`<span class="arm-chip">${esc(value)}</span>`).join('')}</dd>`).join('')+'</dl>':'<p>Añade países, idiomas, funciones y preferencias en «Editar ficha».</p>'}</section>`;
}
export function bindClassificationUI({onFilter,onDirty}){
 document.addEventListener('input',event=>{
  if(!event.target.hasAttribute('data-facet-search'))return;
  const query=norm(event.target.value);
  for(const label of event.target.closest('.arm-facet').querySelectorAll('.arm-facet-options label'))label.hidden=!norm(label.textContent).includes(query);
 });
 document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.hasAttribute('data-facet-custom')){event.preventDefault();event.target.closest('.arm-facet').querySelector('[data-facet-add]').click();}});
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-facet-add]');if(!button)return;
  const picker=button.closest('.arm-facet'),input=picker.querySelector('[data-facet-custom]'),value=input.value.trim();
  if(!value||value.includes('|'))return;
  let checkbox=[...picker.querySelectorAll('[data-facet-value]')].find(item=>norm(item.value)===norm(value));
  if(!checkbox){const label=document.createElement('label');label.innerHTML=`<input type="checkbox" data-facet-value value="${esc(value)}"> <span>${esc(value)}</span>`;picker.querySelector('.arm-facet-options').prepend(label);checkbox=label.querySelector('input');}
  checkbox.checked=true;input.value='';checkbox.dispatchEvent(new Event('change',{bubbles:true}));
 });
 document.addEventListener('change',event=>{
  if(!event.target.hasAttribute('data-facet-value'))return;
  const picker=event.target.closest('.arm-facet'),values=[...picker.querySelectorAll('[data-facet-value]:checked')].map(input=>input.value);
  picker.querySelector('[data-facet-count]').textContent=values.length?'· '+values.length:'';
  if(picker.dataset.mode==='filter')onFilter(picker.dataset.facet,values);else onDirty();
 });
}
