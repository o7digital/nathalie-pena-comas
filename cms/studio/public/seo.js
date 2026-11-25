import {guidanceBadge} from './editor-guidance.js';
import {emptySeoRule,seoChecks,validateSeoInput} from './seo-data.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lines=value=>value.split(/\r?\n/).map(value=>value.trim()).filter(Boolean);
export function createSeoUI({api,sections,rules,content,hasContentDrafts,onSaved,toast}){
 const drafts=new Map(),open=new Set();let saving=false;
 const saved=id=>rules().find(rule=>rule.id===id)||emptySeoRule(id);
 const ruleFor=id=>drafts.get(id)||saved(id);
 const checksFor=(section,rule=ruleFor(section.id))=>seoChecks(rule,section,content());
 const pending=checks=>[...checks.protected,...checks.required].filter(row=>!row.present);
 function statusMarkup(section){
  const rule=ruleFor(section.id),checks=checksFor(section,rule),missing=pending(checks);
  return `<div class="seo-check-heading"><strong>${missing.length?`${missing.length} expresión${missing.length===1?'':'es'} pendiente${missing.length===1?'':'s'}`:checks.protected.length+checks.required.length?'Palabras presentes en el texto':'Sin palabras configuradas'}</strong><span>Comprobación del español · Incluye lo que estás editando</span></div><div class="seo-keyword-checks">${[...checks.protected.map(row=>({...row,kind:'Protegida'})),...checks.required.map(row=>({...row,kind:'Por incorporar'}))].map(row=>`<span class="seo-keyword ${row.present?'present':row.kind==='Protegida'?'missing-protected':'missing-required'}"><b>${row.present?'✓':'!'} ${esc(row.keyword)}</b><small>${row.present?row.kind==='Protegida'?'Protegida':'Incorporada':row.kind==='Protegida'?'Debe conservarse':'Pendiente'}</small></span>`).join('')}</div>`;
 }
 function markup(section){
  const rule=ruleFor(section.id),current=saved(section.id);
  return `<section class="seo-section" aria-label="SEO de ${esc(section.title)}">${current.locked?'<div class="seo-lock-banner" role="status"><strong>Sección fijada</strong><span>Sus textos, traducciones, fotografías y orden están protegidos.</span><button type="button" data-seo-open="'+section.id+'">Gestionar bloqueo</button></div>':''}<details class="seo-panel" data-seo-panel="${section.id}" ${open.has(section.id)?'open':''}><summary><span>SEO · Palabras clave y protección ${guidanceBadge('seo')}</span><span class="seo-summary-state">${current.locked?'Fijada':pending(checksFor(section)).length?'Palabras pendientes':'Configurar'}</span></summary><div class="seo-panel-body"><p class="seo-warning"><strong>SEO · No tocar sin consultar al responsable SEO.</strong>Estas reglas afectan al posicionamiento del sitio. Para actualizar tus textos, utiliza los campos verdes; para subir fotos y vídeos, las zonas azules.</p><p class="seo-intro">Cuida las expresiones importantes de esta sección. Las palabras por incorporar se añaden al texto que tú eliges; el Studio no modifica tu contenido automáticamente.</p><form data-seo-form="${section.id}"><label class="seo-lock-control"><input type="checkbox" name="locked" ${rule.locked?'checked':''}><span><strong>Fijar esta sección</strong><small>Impide editar sus textos, traducciones, fotografías y orden hasta que la desbloquees aquí.</small></span></label><div class="seo-fields"><label>Palabras o expresiones que deben conservarse<textarea name="protected_keywords" rows="4" placeholder="Una expresión por línea" aria-describedby="seo-protected-help-${section.id}">${esc(rule.protected_keywords.join('\n'))}</textarea><small id="seo-protected-help-${section.id}">Deben estar ya presentes en los textos guardados. No se podrá guardar un cambio que elimine su última aparición en la sección.</small></label><label>Palabras o expresiones por incorporar<textarea name="required_keywords" rows="4" placeholder="Una expresión por línea" aria-describedby="seo-required-help-${section.id}">${esc(rule.required_keywords.join('\n'))}</textarea><small id="seo-required-help-${section.id}">Se comprobarán antes de actualizar la vista previa. Añádelas de forma natural al texto español y guarda sus traducciones.</small></label></div><div data-seo-checks="${section.id}">${statusMarkup(section)}</div><p class="seo-language-note">Las protecciones se aplican al original español. Las traducciones conservan su idioma. Hasta 30 expresiones por lista.</p><p class="form-error seo-form-error" role="alert"></p><footer class="seo-save"><span>${current.revision?'Reglas guardadas · Revisión '+current.revision:'Todavía no hay reglas guardadas.'}</span><button class="button primary" type="submit" ${saving?'disabled':''}>Guardar reglas SEO</button></footer></form></div></details></section>`;
 }
 function refresh(){
  for(const node of document.querySelectorAll('[data-seo-checks]')){const section=sections().find(section=>section.id===node.dataset.seoChecks);if(section){node.innerHTML=statusMarkup(section);const summary=node.closest('[data-seo-panel]').querySelector('.seo-summary-state');summary.textContent=saved(section.id).locked?'Fijada':pending(checksFor(section)).length?'Palabras pendientes':'Sin palabras pendientes';}}
 }
 function overview(){
  const all=sections(),locked=rules().filter(rule=>rule.locked).length,required=all.reduce((count,section)=>count+checksFor(section).required.filter(row=>!row.present).length,0);
  return `<section class="seo-overview" aria-label="SEO de todas las secciones"><p class="seo-warning"><strong>SEO · No tocar sin consultar al responsable SEO.</strong>Los bloqueos y las palabras protegidas afectan a todo el contenido de cada sección.</p><div class="seo-metrics"><article><strong>${all.length}</strong><span>Secciones</span></article><article><strong>${locked}</strong><span>Secciones fijadas</span></article><article><strong>${required}</strong><span>Expresiones por incorporar</span></article></div><p class="seo-overview-copy">Elige una sección para proteger su contenido, conservar sus palabras importantes o preparar las expresiones que quieres añadir. Las reglas se guardan en tu Studio.</p><div class="seo-section-grid">${all.map(section=>{
   const rule=saved(section.id),checks=checksFor(section),missing=pending(checks);
   return `<article><div class="seo-card-head"><h2>${esc(section.title)}</h2><span class="seo-card-badge ${rule.locked?'locked':missing.length?'pending':''}">${rule.locked?'Fijada':missing.length?'Pendiente':'Editable'}</span></div><p>${rule.protected_keywords.length} expresiones protegidas · ${rule.required_keywords.length} por incorporar</p>${missing.length?'<p class="seo-card-pending">Faltan: '+missing.map(row=>esc(row.keyword)).join(', ')+'</p>':'<p class="seo-card-ready">'+(rule.revision?'Sin palabras pendientes.':'Configura las palabras de esta sección.')+'</p>'}<a class="button quiet" href="#${section.id}" data-seo-open="${section.id}">Configurar SEO</a></article>`;
  }).join('')}</div></section>`;
 }
 document.addEventListener('toggle',event=>{const id=event.target.dataset?.seoPanel;if(id){if(event.target.open)open.add(id);else open.delete(id);}},true);
 document.addEventListener('click',event=>{const id=event.target.closest('[data-seo-open]')?.dataset.seoOpen;if(!id)return;open.add(id);const panel=document.querySelector(`[data-seo-panel="${id}"]`);if(panel){panel.open=true;panel.scrollIntoView({block:'center',behavior:'smooth'});}});
 document.addEventListener('input',event=>{
  const form=event.target.closest('[data-seo-form]');if(!form)return;
  const id=form.dataset.seoForm,baseline=ruleFor(id),draft={locked:form.elements.locked.checked,protected_keywords:lines(form.elements.protected_keywords.value),required_keywords:lines(form.elements.required_keywords.value),revision:baseline.revision};
  const comparable=rule=>({locked:rule.locked,protected_keywords:rule.protected_keywords,required_keywords:rule.required_keywords});
  if(JSON.stringify(comparable(draft))===JSON.stringify(comparable(saved(id))))drafts.delete(id);else drafts.set(id,{...saved(id),...draft});refresh();
 });
 document.addEventListener('submit',async event=>{
  const form=event.target.closest('[data-seo-form]');if(!form)return;event.preventDefault();if(saving)return;
  const id=form.dataset.seoForm,section=sections().find(section=>section.id===id),button=form.querySelector('[type=submit]'),error=form.querySelector('.seo-form-error');
  error.textContent='';
  try{
   const input=validateSeoInput({locked:form.elements.locked.checked,protected_keywords:lines(form.elements.protected_keywords.value),required_keywords:lines(form.elements.required_keywords.value),revision:ruleFor(id).revision});
   if(input.locked&&hasContentDrafts(section))throw Error('Guarda los cambios de contenido de esta sección antes de fijarla.');
   saving=true;form.setAttribute('aria-busy','true');for(const control of form.querySelectorAll('input,textarea,button'))control.disabled=true;button.textContent='Guardando reglas…';
   const result=await api('/api/seo/'+id,{method:'POST',body:input});drafts.delete(id);saving=false;onSaved(result.rule);toast('Reglas SEO guardadas.');
  }catch(problem){error.textContent=problem.message;}
  finally{saving=false;form.removeAttribute('aria-busy');for(const control of form.querySelectorAll('input,textarea,button'))control.disabled=false;button.textContent='Guardar reglas SEO';}
 });
 return {markup,overview,refresh,isDirty:()=>drafts.size>0||saving,reset(){drafts.clear();open.clear();saving=false;}};
}
