const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(value,currency)=>new Intl.NumberFormat('es',{style:'currency',currency:currency||'USD'}).format(value/100);
const date=value=>new Intl.DateTimeFormat('es',{dateStyle:'long',timeZone:'UTC'}).format(new Date(value));
export function socialSubscriptionCard(offer={}) {
 const price=money(offer.amountMinor??8900,offer.currency),reference=offer.monthlyReferenceMinor??900,savings=reference*12-(offer.amountMinor??8900),active=offer.status==='ACTIVE';
 return `<section class="panel report-panel social-subscription social-price"><div><span class="eyebrow">O7 PULSE SOCIAL / ANUAL</span><h2>Tus redes, desde O7.</h2><strong class="report-money">${e(price)} <small>/ año</small></strong><p>Doce meses de gestión para Instagram, Facebook, YouTube y X. Un pago anual, con renovación cada año.</p>${savings>0?`<p><strong>Ahorras ${e(money(savings,offer.currency))} al año</strong> frente a ${e(money(reference,offer.currency))} al mes × 12.</p>`:''}<span class="badge accent">${active?'SUSCRIPCIÓN ACTIVA':offer.status==='PAST_DUE'?'PAGO PENDIENTE':offer.subscribed?'CONFIRMACIÓN PENDIENTE':'PLAN ANUAL'}</span>${offer.currentPeriodEnd?`<p>${offer.cancelAtPeriodEnd?'Acceso hasta el':'Período actual hasta el'} ${e(date(offer.currentPeriodEnd))}.${offer.cancelAtPeriodEnd?' Renovación automática cancelada.':''}</p>`:''}<p>El hosting incluido durante doce meses se mantiene independiente. ${offer.subscribed?'Consulta tus facturas, actualiza tu tarjeta o cancela la renovación en el portal de Stripe.':'El primer pago y la renovación solo se activan cuando confirmas la suscripción en Stripe.'}</p>${offer.paymentMode==='test'?'<p class="report-footnote"><strong>Modo de prueba:</strong> no se efectúa ningún cobro real.</p>':''}${!offer.checkoutAvailable&&!offer.subscribed?'<p class="report-footnote">El pago anual se habilitará cuando O7 complete la conexión de Stripe.</p>':''}</div><div class="social-form-actions">${offer.subscribed?'<button class="button primary" data-social-billing="portal">Gestionar mi suscripción ↗</button>':offer.checkoutAvailable?`<button class="button gold" data-social-billing="checkout">${offer.paymentMode==='test'?'Probar pago anual':'Suscribirme por '+e(price)+'/año'} ↗</button>`:''}<a class="button quiet" href="#social">Abrir O7 Pulse Social ↗</a></div><p class="report-error" data-social-billing-error role="alert"></p></section>`;
}
export function bindSocialBilling(root,api,offer={}) {
 const error=root.querySelector('[data-social-billing-error]');
 const request=async(kind,button)=>{
  button.disabled=true;if(error)error.textContent='';
  try{
   const response=await api('/api/social/billing/'+kind,{method:'POST',body:{}}),url=new URL(response.url);
   if(url.protocol!=='https:'||url.username||url.password||url.hostname!==(kind==='portal'?'billing.stripe.com':'checkout.stripe.com'))throw new Error('No se pudo confirmar la página segura de Stripe.');
   location.assign(url.href);
  }catch(failure){if(error)error.textContent=failure.message;button.disabled=false;}
 };
 root.querySelectorAll('[data-social-billing]').forEach(button=>button.addEventListener('click',()=>{
  if(button.dataset.socialBilling==='portal')return request('portal',button);
  const dialog=document.createElement('dialog');dialog.className='social-dialog';
  dialog.innerHTML=`<span class="eyebrow">TU SUSCRIPCIÓN ANUAL O7</span><h2>${e(money(offer.amountMinor??8900,offer.currency))} por doce meses</h2><p>El pago se realiza ahora en Stripe. La suscripción se renueva cada año al mismo precio hasta que canceles la renovación. Puedes gestionarla desde Mi suscripción.</p><p>El hosting incluido no cambia.</p>${offer.paymentMode==='test'?'<p><strong>Prueba sin cobro real.</strong></p>':''}<form><label><input type="checkbox" required> Entiendo el importe anual y la renovación de mi suscripción.</label><div class="social-form-actions"><button type="button" class="button quiet" data-close>Volver</button><button class="button gold" type="submit">Continuar a Stripe ↗</button></div></form>`;
  dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  dialog.querySelector('form').addEventListener('submit',event=>{event.preventDefault();dialog.close();request('checkout',button);});root.append(dialog);dialog.showModal();
 }));
}
