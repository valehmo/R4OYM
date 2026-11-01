// jarvis-nav.js — navegación giro por giro tipo Waze. Se carga DESPUÉS de jarvis-ia-mapa.html (web y app).
(function(){
// ================= 1) Navegación giro por giro =================
const css=document.createElement('style');
css.textContent='#navbar{display:flex;align-items:center;gap:10px;background:#0b3a2a;border:2px solid #22c55e;border-radius:14px;padding:8px 12px}#nvIco{font-size:34px}#nvTxt{flex:1;font-size:14px}#nvInfo{color:#8aa0b8;font-size:12px}#nvX{padding:6px 10px}';
document.head.appendChild(css);
const nb=document.createElement('div');nb.id='navbar';nb.style.display='none';
nb.innerHTML='<div id="nvIco">⬆️</div><div id="nvTxt"><b id="nvMan">—</b><br><span id="nvInfo"></span></div><button id="nvX">✖</button>';
document.querySelector('.bar').prepend(nb);
const chipV=document.createElement('span');chipV.className='chip';chipV.id='cVel';chipV.textContent='🚗 0 km/h';document.querySelector('.top').appendChild(chipV);

const NAV={pasos:[],ruta:[],dest:null,i:0,aviso:{},fuera:0,dist:0,dur:0};
const MOD={'right':'a la derecha','left':'a la izquierda','slight right':'ligeramente a la derecha','slight left':'ligeramente a la izquierda','sharp right':'cerrado a la derecha','sharp left':'cerrado a la izquierda','straight':'recto','uturn':'en U'};
const ICO={'right':'➡️','left':'⬅️','slight right':'↗️','slight left':'↖️','sharp right':'↘️','sharp left':'↙️','straight':'⬆️','uturn':'↩️'};
const fmtD=d=>d<1000?(Math.round(d/(d>150?50:10))*(d>150?50:10))+' metros':(d/1000).toFixed(1)+' kilómetros';
function textoPaso(st){
  const m=st.maneuver||{},t=m.type,mod=m.modifier,via=st.name?' por '+st.name:'';
  if(t==='arrive')return 'llegarás a tu destino';
  if(t==='depart')return 'inicia el recorrido'+via;
  if(t==='roundabout'||t==='rotary'||t==='roundabout turn')return ('en la glorieta toma la salida '+(m.exit||'')).trim()+via;
  if(mod==='uturn')return 'da vuelta en U'+via;
  if(mod==='straight'||t==='continue')return 'continúa recto'+via;
  if(t==='merge')return 'incorpórate '+(MOD[mod]||'')+via;
  if(t==='fork')return 'toma la bifurcación '+(MOD[mod]||'')+via;
  if(t==='off ramp')return 'toma la salida '+(MOD[mod]||'')+via;
  return 'gira '+(MOD[mod]||'')+via;
}
function distARuta(p,pts){ // distancia mínima (m) de un punto a la polilínea de la ruta
  let min=1e9;const k=Math.cos(p.la*Math.PI/180);
  for(let i=0;i<pts.length-1;i++){
    const ax=(pts[i][1]-p.lo)*k*111320,ay=(pts[i][0]-p.la)*111320,bx=(pts[i+1][1]-p.lo)*k*111320,by=(pts[i+1][0]-p.la)*111320;
    const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;let t=l2?-(ax*dx+ay*dy)/l2:0;t=Math.max(0,Math.min(1,t));
    const d=Math.hypot(ax+t*dx,ay+t*dy);if(d<min)min=d;
  }
  return min;
}
async function trazarRuta(s,voz,reroute){
  try{
    const r=await fetch(`https://router.project-osrm.org/route/v1/driving/${me.lo},${me.la};${s.lo},${s.la}?overview=full&geometries=geojson&steps=true`);
    const d=await r.json(),rt=d.routes[0];capaRuta.clearLayers();
    const pts=rt.geometry.coordinates.map(c=>[c[1],c[0]]);
    L.polyline(pts,{color:'#facc15',weight:6,opacity:.9}).addTo(capaRuta);
    Object.assign(NAV,{pasos:rt.legs[0].steps,ruta:pts,dest:s,i:0,aviso:{},fuera:0,dist:rt.distance,dur:rt.duration});
    destino=s;
    if(!reroute){desactivarSeguir();map.fitBounds(L.polyline(pts).getBounds(),{padding:[60,60]});setTimeout(activarSeguir,3500);}
    const km=(rt.distance/1000).toFixed(1),mn=Math.round(rt.duration/60);
    log(`Ruta a ${s.n}: ${km} km, ${mn} min · ${s.bad?'CON FALLA':'SIN FALLA'}`,s.bad?'a':'k');
    const al=$('alert');al.textContent=(s.bad?'🔴 ':'🟢 ')+s.n+(s.bad?' · CON FALLA':' · SIN FALLA')+` · ${km} km`;al.className='show '+(s.bad?'bad':'ok');setTimeout(()=>al.classList.remove('show'),7000);
    if(voz&&!reroute)hablar(`Ruta a ${s.n}. El sitio está ${s.bad?'con falla, estado caído':'sin falla'}. Distancia ${km} kilómetros, ${mn} minutos.`);
  }catch(e){log('No se pudo trazar la ruta: '+e.message,'a');if(voz)hablar('No pude trazar la ruta.');}
}
window.rutaA=async function(key,voz){
  const s=sitios.find(x=>x.key===key);if(!s)return;
  if(!me){const m='Necesito tu ubicación para trazar la ruta.';log(m,'a');if(voz)hablar(m);return;}
  await trazarRuta(s,voz,false);
};
function ocultarNav(){NAV.dest=null;NAV.pasos=[];nb.style.display='none';}
$('nvX').onclick=()=>{capaRuta.clearLayers();destino=null;ocultarNav();hablar('Ruta cancelada.');};
function navTick(){
  if(!destino||!NAV.dest||!NAV.pasos.length||!me){if(NAV.dest&&!destino)ocultarNav();return;}
  const P=NAV.pasos;
  while(NAV.i<P.length-2){const l=P[NAV.i+1].maneuver.location;if(dist(me.la,me.lo,l[1],l[0])<25)NAV.i++;else break;} // pasó la maniobra
  const nxt=P[NAV.i+1];if(!nxt)return;
  const l=nxt.maneuver.location,dN=dist(me.la,me.lo,l[1],l[0]);
  for(const u of [60,200,500]){ // un aviso por umbral y por maniobra: a 500 m, 200 m y 60 m
    if(dN<=u&&!NAV.aviso[NAV.i+'_'+u]){[60,200,500].filter(x=>x>=u).forEach(x=>NAV.aviso[NAV.i+'_'+x]=1);
      hablar((u===60?'Ahora, ':'En '+fmtD(dN)+', ')+textoPaso(nxt));break;}
  }
  let rest=dN;for(let j=NAV.i+2;j<P.length;j++)rest+=P[j].distance;
  const seg=NAV.dist?NAV.dur*rest/NAV.dist:0;
  nb.style.display='flex';$('nvIco').textContent=nxt.maneuver.type==='arrive'?'🏁':(/roundabout|rotary/.test(nxt.maneuver.type)?'🔄':(ICO[nxt.maneuver.modifier]||'⬆️'));
  $('nvMan').textContent=fmtD(dN)+' · '+textoPaso(nxt);
  $('nvInfo').textContent=`${(rest/1000).toFixed(1)} km · ${Math.round(seg/60)} min · llegada ${new Date(Date.now()+seg*1000).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}`;
  if(distARuta(me,NAV.ruta)>60){if(++NAV.fuera>=3){NAV.fuera=-6;hablar('Recalculando ruta.');log('Fuera de ruta: recalculando…','a');trazarRuta(NAV.dest,false,true);}}else NAV.fuera=Math.max(0,NAV.fuera);
}
const _setPos=window.setPos;
window.setPos=function(){_setPos.apply(this,arguments);try{navTick();chipV.textContent='🚗 '+Math.round(vel)+' km/h';}catch(e){}};
})();
