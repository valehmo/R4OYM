// jarvis-bridge.js — puente con la app Expo (React Native). Fuera de la app no hace nada.
(function(){
if(!window.ReactNativeWebView)return;
const send=o=>window.ReactNativeWebView.postMessage(JSON.stringify(o));
let sid=0;const cbs={};

// Voz de JARVIS con el motor del teléfono (sigue sonando con la app minimizada)
window.hablar=function(t,cb){
  ultHablado=new Set(norm(t).replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>2));finHabla=Infinity;hablando=true;
  const id=++sid;cbs[id]=()=>{finHabla=Date.now();setTimeout(()=>hablando=false,400);if(cb)cb();};
  send({cmd:'speak',id,text:t});
  setTimeout(()=>{const f=cbs[id];if(f){delete cbs[id];f();}},Math.max(10000,t.length*110)); // respaldo
};
window.elegirVoz=function(){};
window.mantenerActivo=function(){send({cmd:'keepAwake'});};
window.pedirWL=function(){};

// GPS nativo (también en segundo plano)
let gpsIniciado=false;
window.iniciarGPS=function(){if(gpsIniciado)return;gpsIniciado=true;gpsOn=true;send({cmd:'startGPS'});};

// Micrófono nativo con vocabulario de JARVIS y nombres de sitios como pistas
function pistas(){
  const base=['JARVIS','sentinela','tráfico','VSWR','fibra','radiografía','5G','reinicia','llévame al sitio','sitios afectados','desactiva','valet','ayuda','cállate','confirma','cancela'];
  return base.concat([...sitios].sort((a,b)=>(b.bad?1:0)-(a.bad?1:0)).slice(0,80).map(s=>s.n));
}
window.iniciarMic=function(){micOn=true;setMic(true);send({cmd:'startMic',hints:pistas()});};
$('bMic').onclick=()=>{if(micOn){micOn=false;send({cmd:'stopMic'});setMic(false);}else window.iniciarMic();};

// Sitios, credenciales y sentinela hacia la app (para que siga avisando en segundo plano)
function enviarSitios(){
  send({cmd:'creds',creds:{appId:APP_ID,key:API_KEY,tabla:TABLA}});
  send({cmd:'sites',list:sitios.map(s=>({n:s.n,la:s.la,lo:s.lo,bad:s.bad}))});
  send({cmd:'hints',list:pistas()});
}
const _cs=window.cargarSitios;
window.cargarSitios=async function(){await _cs.apply(this,arguments);enviarSitios();};
const _ss=window.setSentinela;
window.setSentinela=function(v,voz){_ss(v,voz);send({cmd:'sentinel',on:v});};
const _an=window.anunciar;
window.anunciar=function(s,d,c){
  _an(s,d,c);send({cmd:'vibrate',bad:s.bad});
  send({cmd:'notify',title:s.bad?'🔴 Torre con falla':'🟢 Torre sin fallas',body:s.n+' · a '+Math.round(d)+' m'}); // la app solo la muestra si está minimizada
};

// Eventos que llegan desde la app
window.__nativeEvent=function(e){
  switch(e.type){
    case 'speechEnd':{const f=cbs[e.id];if(f){delete cbs[e.id];f();}break;}
    case 'location':if(!simular)setPos(e.lat,e.lon,e.acc,e.heading,e.speed);break;
    case 'gpsError':log('GPS: '+e.message,'a');break;
    case 'sttState':if(e.status==='denied'){micOn=false;setMic(false);log('Permiso de micrófono/voz denegado','a');}break;
    case 'stt':{
      const m=e.matches;if(!m||!m.length)break;$('cHeard').textContent='🎙 '+m[0];
      if(hablando){const p=preparar(m[0]);if(p.hasJ&&/(callate|silencio|basta|detente)/.test(p.t)&&p.t.split(' ').length<=2)send({cmd:'stopSpeak'});break;} // interrumpe a JARVIS
      if(e.final)manejarVoz(m);break;
    }
  }
};
})();
