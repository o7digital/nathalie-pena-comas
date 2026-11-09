export {};
const params=new URLSearchParams(location.search),state=params.get('state'),code=params.get('code'),denied=params.has('error');
// Keep short-lived authorization codes out of history and subsequent request referrers.
history.replaceState(null,'','/social-callback.html');
const statusNode=document.querySelector('#oauth-status');
async function complete(){
 if(denied){statusNode.textContent='Has cancelado la autorización. Tus conexiones no han cambiado.';return;}
 if(!state||!code){statusNode.textContent='La autorización no está completa. Vuelve al Studio para conectar tu cuenta.';return;}
 try{
  const response=await fetch('/api/social/oauth/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,code})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudo completar la conexión.');
  sessionStorage.setItem('o7-social-attempt',data.attemptId);location.replace('/#social');
 }catch(error){statusNode.textContent=error.message+' No se ha publicado ningún contenido. Vuelve a iniciar sesión y repite la conexión si es necesario.';}
}
complete();
