// Local date-only calendar. No feeds, external calendars or automatic imports.
export const months=Array.from({length:12},(_,index)=>new Intl.DateTimeFormat('es',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2026,index,1))));
const weekdays=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
export function validDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000'))return false;
 const date=new Date(value+'T12:00:00Z');
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function dateFromParts(day,month,year){
 if(![day,month,year].every(value=>/^\d+$/.test(String(value))))return '';
 const iso=`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
 return validDate(iso)?iso:'';
}
export function moveMonth(month,offset){
 const date=new Date(month+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+offset);
 const value=date.toISOString().slice(0,7);return /^\d{4}-\d{2}$/.test(value)&&!value.startsWith('0000')?value:month;
}
export function monthDays(month){
 const first=new Date(month+'-01T12:00:00Z'),start=new Date(first);
 start.setUTCDate(1-(first.getUTCDay()+6)%7);
 return Array.from({length:42},(_,index)=>{
  const date=new Date(start);date.setUTCDate(start.getUTCDate()+index);
  return date.toISOString().slice(0,10);
 });
}
export const longDate=iso=>new Intl.DateTimeFormat('es',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(iso+'T12:00:00Z'));
export function agendaToolbar(view,month){
 const [year,selectedMonth]=month.split('-');
 return `<div class="agenda-toolbar"><div class="tabs" role="group" aria-label="Vista de la agenda"><button type="button" class="tab ${view==='calendar'?'active':''}" data-agenda-view="calendar" aria-pressed="${view==='calendar'}">Calendario</button><button type="button" class="tab ${view==='list'?'active':''}" data-agenda-view="list" aria-pressed="${view==='list'}">Lista</button></div>${view==='calendar'?`<div class="agenda-month-controls"><button type="button" class="agenda-step" data-agenda-step="-1" aria-label="Mes anterior">‹</button><label>Mes<select id="agenda-month">${months.map((name,index)=>`<option value="${String(index+1).padStart(2,'0')}" ${Number(selectedMonth)===index+1?'selected':''}>${name}</option>`).join('')}</select></label><label>Año<input id="agenda-year" type="number" min="1" max="9999" step="1" value="${year}" required></label><button type="button" class="agenda-step" data-agenda-step="1" aria-label="Mes siguiente">›</button><button type="button" class="button quiet" data-agenda-today>Hoy</button></div>`:''}</div>`;
}
export function calendarMarkup(month,rows,{escapeHtml,badge,today}){
 const days=monthDays(month),title=new Intl.DateTimeFormat('es',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));
 return `<section class="agenda-calendar" aria-labelledby="agenda-month-title"><header class="agenda-calendar-heading"><div><span class="eyebrow">TU AGENDA, A TU RITMO</span><h2 id="agenda-month-title" aria-live="polite">${title}</h2></div><p>Haz clic en un día para añadir una actuación.<br>Tú escribes cada fecha y cada detalle.</p></header><table class="agenda-month-grid"><caption class="agenda-sr-only">Calendario de ${title}. Selecciona un día para añadir o una actuación para editar.</caption><thead><tr>${weekdays.map(name=>`<th scope="col"><abbr title="${name}">${name.slice(0,3)}</abbr></th>`).join('')}</tr></thead><tbody>${Array.from({length:6},(_,week)=>`<tr>${days.slice(week*7,week*7+7).map(date=>{
  if(!validDate(date))return '<td></td>';
  const events=rows.filter(row=>row.date===date),outside=!date.startsWith(month);
  return `<td class="agenda-day ${outside?'outside':''} ${date===today?'is-today':''}" data-calendar-date="${date}"><button type="button" class="agenda-day-add" data-new-date="${date}" aria-label="Añadir actuación el ${longDate(date)}" ${date===today?'aria-current="date"':''}><span>${Number(date.slice(-2))}</span><span aria-hidden="true">＋</span></button><div class="agenda-day-events">${events.map(row=>`<button type="button" class="agenda-event ${row.status==='archived'?'archived':''}" data-edit="${escapeHtml(row.id)}" aria-label="Editar ${escapeHtml(row.title)} · ${longDate(date)}"><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.city||row.venue)}</small>${badge(row.status)}</button>`).join('')}</div></td>`;
 }).join('')}</tr>`).join('')}</tbody></table><p class="agenda-calendar-note">Las fechas se guardan manualmente en tu Studio. Guarda como borrador o incluye la actuación en la vista previa cuando esté lista.</p></section>`;
}
export function dateFields(value=''){
 const [year='',month='',day='']=value.split('-');
 return `<fieldset class="agenda-date-fields"><legend>Fecha de la actuación</legend><input type="hidden" name="date" value="${validDate(value)?value:''}"><div><label>Día<input id="event-day" data-date-part="day" type="number" min="1" max="31" step="1" inputmode="numeric" value="${Number(day)||''}" required></label><label>Mes<select id="event-month" data-date-part="month" required><option value="">Selecciona un mes</option>${months.map((name,index)=>`<option value="${index+1}" ${Number(month)===index+1?'selected':''}>${name}</option>`).join('')}</select></label><label>Año<input id="event-year" data-date-part="year" type="number" min="1" max="9999" step="1" inputmode="numeric" value="${Number(year)||''}" required></label></div><output data-date-description aria-live="polite">${validDate(value)?longDate(value):'Escribe el día, el mes y el año.'}</output></fieldset>`;
}
export function syncDateFields(form){
 const day=form.querySelector('[data-date-part=day]'),month=form.querySelector('[data-date-part=month]'),year=form.querySelector('[data-date-part=year]');
 if(!day||!month||!year)return;
 const iso=dateFromParts(day.value,month.value,year.value),complete=day.value&&month.value&&year.value;
 day.setCustomValidity(complete&&!iso?'Esta fecha no existe. Revisa el día, el mes y el año.':'');
 form.querySelector('[name=date]').value=iso;
 form.querySelector('[data-date-description]').textContent=iso?longDate(iso):complete?'Esta fecha no existe. Revisa el día, el mes y el año.':'Escribe el día, el mes y el año.';
}
