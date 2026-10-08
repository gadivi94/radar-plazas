/* Radar de Plazas · web. Necesita geo.js (mapa de Cataluña), espana.js (provincias), sectores.js y cumple.js. */
const API=(window.RADAR_API||"").replace(/\/$/,"");
const $=id=>document.getElementById(id);
function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
const ls={get(k,d=null){try{const v=localStorage.getItem(k);return v===null?d:v}catch(_){return d}},set(k,v){try{localStorage.setItem(k,v)}catch(_){}},del(k){try{localStorage.removeItem(k)}catch(_){}}};

// ---------- Idioma (castellano / catalán) ----------
let LANG=ls.get("rp_lang","es");
const CA={
  "Nuevas":"Noves","Todas abiertas":"Totes obertes","Mis candidaturas":"Les meves candidatures","Descartadas":"Descartades",
  "Me interesa":"M'interessa","Presentada":"Presentada","Admitido":"Admès","Examen":"Examen","Aprobado":"Aprovat","En bolsa":"A la borsa","Descartar":"Descartar",
  "Sector":"Sector","Subcategoría":"Subcategoria","Estudios":"Estudis","Dificultad":"Dificultat","Grupo":"Grup","Lugar":"Lloc",
  "Todos":"Tots","Fácil":"Fàcil","Media":"Mitjana","Difícil":"Difícil","Sin especificar":"Sense especificar",
  "Cualquier nivel":"Qualsevol nivell","Sin titulación":"Sense titulació","Con ESO":"Amb ESO","Con bachillerato o FP medio":"Amb batxillerat o FP mitjà","Con FP superior":"Amb FP superior","Con carrera":"Amb carrera",
  "Solo las que cumplo":"Només les que compleixo","Mi perfil":"El meu perfil","Mis alertas":"Les meves alertes","Mi cuenta":"El meu compte",
  "Borrar filtros":"Esborrar filtres","plaza":"plaça","plazas":"places","con estos filtros":"amb aquests filtres",
  "Presentar solicitud":"Presentar sol·licitud","Ficha":"Fitxa","Oficial":"Oficial","Compartir":"Compartir","Calendario":"Calendari",
  "nueva":"nova","días":"dies","día":"dia","sin":"sense","plazo":"termini","cerrada":"tancada","hasta":"fins al","aún sin":"encara sense",
  "Entrar":"Entrar","Seguimiento":"Seguiment","Etapa":"Etapa","Documentos":"Documents","Notas":"Notes",
  "nuevas sin revisar":"noves sense revisar","nuevas esta semana":"noves aquesta setmana","cierran en ≤ 7 días":"tanquen en ≤ 7 dies","en seguimiento":"en seguiment",
  "Mapa":"Mapa","Cataluña":"Catalunya","España":"Espanya","Toda España":"Tot Espanya",
  "Por sector":"Per sector","Estadísticas":"Estadístiques","Guías":"Guies","Sueldos":"Sous",
  "Cumples":"Compleixes","Te falta":"Et falta","Revisa":"Revisa",
  "Crear":"Crear","Crear cuenta gratis":"Crear compte gratis","Activa":"Activa","Pausada":"Pausada","Borrar":"Esborrar",
  "Nueva alerta con los filtros de arriba":"Nova alerta amb els filtres de dalt",
  "Convocatorias, bolsas e interinos de toda España. Se revisa cada mañana y, con tu cuenta gratuita, las alertas te avisan por correo cuando entra algo que encaja.":"Convocatòries, borses i interins de tot Espanya. Es revisa cada matí i, amb el teu compte gratuït, les alertes t'avisen per correu quan entra alguna cosa que encaixa.",
  "Información recopilada de fuentes oficiales (BOE, CIDO de la Diputació de Barcelona y TMB). Radar de Plazas no es un organismo oficial: comprueba siempre requisitos y plazos en la convocatoria publicada.":"Informació recollida de fonts oficials (BOE, CIDO de la Diputació de Barcelona i TMB). Radar de Places no és un organisme oficial: comprova sempre requisits i terminis a la convocatòria publicada.",
  "Rellena tu perfil y marcaremos en cada plaza si cumples los requisitos que detectamos. Se guarda en este dispositivo y, si entras, en tu cuenta.":"Omple el teu perfil i marcarem a cada plaça si compleixes els requisits que detectem. Es desa en aquest dispositiu i, si entres, al teu compte.",
  "Nivel de estudios":"Nivell d'estudis","Edad":"Edat","Carné de conducir":"Carnet de conduir","Catalán":"Català","Nacionalidad":"Nacionalitat",
  "Española":"Espanyola","De otro país de la UE":"D'un altre país de la UE","De fuera de la UE":"De fora de la UE","Ninguno":"Cap",
  "Prepárate con OPOS 365":"Prepara't amb OPOS 365","No hay plazas abiertas que encajen con tus criterios ahora mismo.":"Ara mateix no hi ha places obertes que encaixin amb els teus criteris.",
  "Prueba a quitar algún filtro.":"Prova de treure algun filtre.","Aquí aparecerán las plazas que encajen con tus criterios.":"Aquí apareixeran les places que encaixin amb els teus criteris.",
};
function t(s){return LANG==="ca"&&CA[s]||s}
function traducirEstatico(){
  for(const el of document.querySelectorAll("[data-i18n]")){if(!el.dataset.es)el.dataset.es=el.textContent.trim();el.textContent=t(el.dataset.es)}
  document.documentElement.lang=LANG;$("lang").textContent=LANG==="ca"?"ES":"CA";$("lang").setAttribute("aria-label",LANG==="ca"?"Ver en castellano":"Veure en català");
}

// ---------- Datos fijos ----------
const TABS=[["nuevas","Nuevas"],["todas","Todas abiertas"],["mias","Mis candidaturas"],["descartada","Descartadas"]];
const ETAPAS=[["interesa","Me interesa"],["presentada","Presentada"],["admitido","Admitido"],["examen","Examen"],["aprobado","Aprobado"],["bolsa","En bolsa"]];
const SEGUIMIENTO=new Set(ETAPAS.map(e=>e[0]));
const DOCS=[["dni","DNI o NIE"],["titulo","Título"],["tasa","Pago de la tasa"],["idioma","Certificado de idioma"],["carne","Carné de conducir"],["medico","Certificado médico"],["meritos","Méritos y experiencia"]];
const SISTEMA={concurso:"Concurso de méritos","concurso-oposicion":"Concurso-oposición",oposicion:"Oposición",bolsa:"Bolsa de trabajo"};
const COMUNIDADES=["Andalucía","Aragón","Asturias","Baleares","Canarias","Cantabria","Castilla y León","Castilla-La Mancha","Cataluña","Comunidad Valenciana","Extremadura","Galicia","La Rioja","Madrid","Murcia","Navarra","País Vasco","Ceuta","Melilla","Estatal"];
const SECT=Object.fromEntries(SECTORES.map(s=>[s.k,s]));
const CORTO={seguridad:"Seguridad",justicia:"Justicia",sanidad:"Sanidad",educacion:"Educación",social:"Social",transporte:"Transporte",empresas:"Empresas públicas",militar:"Militar",subalterno:"Conserjes",administrativo:"Administración",oficios:"Oficios",tecnico:"Técnicos",otros:"Otros"};
const ICONO={seguridad:"🚓",justicia:"⚖️",sanidad:"🩺",educacion:"🎒",social:"🤝",transporte:"🚇",empresas:"📮",militar:"🎖️",subalterno:"🗝️",administrativo:"🗂️",oficios:"🔧",tecnico:"💻",otros:"✳️"};
const FUENTE={BOE:"BOE",TMB:"TMB",EMPRESA:"web de la empresa"};
const SUBN=Object.fromEntries(SECTORES.flatMap(s=>s.subs.map(([k,n])=>[k,{n,s:s.k}])));
const NIV_OPC=[["","Cualquier nivel"],["0","Sin titulación"],["1","Con ESO"],["2","Con bachillerato o FP medio"],["3","Con FP superior"],["4","Con carrera"]];
const DIF=[[1,"Fácil"],[2,"Media"],[3,"Difícil"]];
const GRUPOS=[["AP","AP"],["C2","C2"],["C1","C1"],["B","B"],["A2","A2"],["A1","A1"],["?","Sin especificar"]];
const normTxt=s=>(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();

// ---------- Estado ----------
const S={q:"",m3:false,clasico:false,ofertas:[],alertas:null,meta:null,tab:"nuevas",sec:"",subs:[],niv:null,solo:false,dif:[],grp:[],etapa:"",busy:new Set(),ses:"",yo:null,adm:null,perfil:null,mapa:"cat",abiertos:new Set()};
try{S.tab=ls.get("rp_tab","nuevas");if(!TABS.some(x=>x[0]===S.tab))S.tab="nuevas";
  leerFiltros(JSON.parse(ls.get("rp_f","{}")));S.ses=ls.get("rp_ses","");S.perfil=JSON.parse(ls.get("rp_perfil","null"));S.mapa=ls.get("rp_mapa","cat");
}catch(e){S.place={kind:"ccaa",id:"Cataluña"}}
function leerFiltros(f){S.dif=f.dif||[];S.grp=f.grp||[];S.sec=f.sec||"";S.subs=f.subs||[];S.niv=f.niv??null;S.solo=!!f.solo;S.place=f.place===undefined?{kind:"ccaa",id:"Cataluña"}:f.place}
function guardarFiltros(){ls.set("rp_f",JSON.stringify({dif:S.dif,grp:S.grp,place:S.place,sec:S.sec,subs:S.subs,niv:S.niv,solo:S.solo}));marcarCambio()}

function grupoDe(o){const g=(o.grupo||"").toUpperCase();return /^(AP|C2|C1|B|A2|A1)$/.test(g)?g:"?"}
function dificultad(o){return o.dificultad||2}
function cumpleDe(o){return S.perfil&&window.RadarCumple?RadarCumple.cumple(o,S.perfil):null}
/* Filtros de la barra (sin el lugar, que lo aplica el mapa/desplegable). `sin` permite contar cada grupo de chips sin su propio filtro. */
function pasaFiltros(o,sin){
  if(S.q){const h=o._h||(o._h=normTxt(`${o.titulo} ${o.organismo||""} ${o.municipio||""} ${o.provincia||""} ${o.comunidad||""} ${SUBN[o.subtipo]?.n||""} ${SECT[o.tipo]?.n||""}`));
    for(const w of normTxt(S.q).split(/\s+/))if(w&&!h.includes(w))return false}
  if(sin!=="sec"&&S.sec&&(o.tipo||"otros")!==S.sec)return false;
  if(sin!=="sec"&&sin!=="sub"&&S.subs.length&&!S.subs.includes(o.subtipo))return false;
  if(S.niv!=null&&o.nivel!=null&&o.nivel>S.niv)return false;
  if(sin!=="dif"&&S.dif.length&&!S.dif.includes(dificultad(o)))return false;
  if(sin!=="grp"&&S.grp.length&&!S.grp.includes(grupoDe(o)))return false;
  if(S.solo){const c=cumpleDe(o);if(c&&c.estado==="no")return false;
    const int=S.perfil?.intereses||[];if(int.length&&!int.includes(o.tipo||"otros"))return false}
  return true;
}

function today(){const d=new Date();d.setHours(0,0,0,0);return d}
function daysLeft(o){if(!o.terminiFecha)return null;const d=new Date(o.terminiFecha+"T00:00:00");return Math.round((d-today())/864e5)}
function isOpen(o){const n=daysLeft(o);return n===null||n>=0}
function toast(m){const el=$("toast");el.textContent=m;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2400)}
function fmtDate(iso){if(!iso)return"";const [y,m,d]=iso.split("-");return `${d}/${m}/${y}`}

const SEMANA=Date.now()-7*864e5;
function esNueva(o){const m=o.marca||"nueva";return S.ses?m==="nueva":Date.parse(o.encontrada||0)>=SEMANA}
function inTab(o){
  const m=o.marca||"nueva";
  if(S.tab==="nuevas")return esNueva(o)&&isOpen(o);
  if(S.tab==="todas")return m!=="descartada"&&isOpen(o);
  if(S.tab==="mias")return SEGUIMIENTO.has(m)&&(!S.etapa||m===S.etapa);
  return m===S.tab;
}
function counts(){
  const c={nuevas:0,todas:0,mias:0,descartada:0};
  for(const o of S.ofertas){const m=o.marca||"nueva";
    if(esNueva(o)&&isOpen(o))c.nuevas++;
    if(m!=="descartada"&&isOpen(o))c.todas++;
    if(SEGUIMIENTO.has(m))c.mias++; if(m==="descartada")c.descartada++;}
  return c;
}
function render(){
  const c=counts();
  $("tabs").innerHTML=TABS.map(([k,l])=>`<button type="button" data-tab="${k}" aria-pressed="${S.tab===k}">${t(l)}<span class="n">${c[k]}</span></button>`).join("");
  $("etapas").hidden=S.tab!=="mias";
  if(S.tab==="mias"){const ce=k=>S.ofertas.filter(o=>o.marca===k).length;
    $("etapas").innerHTML=`<button type="button" data-etapa="" aria-pressed="${!S.etapa}">${t("Todas")}</button>`+ETAPAS.map(([k,l])=>`<button type="button" data-etapa="${k}" aria-pressed="${S.etapa===k}">${t(l)}<small>${ce(k)}</small></button>`).join("")}
  const base=S.ofertas.filter(inTab);
  // Recuentos de cada grupo de botones en una sola pasada por grupo (rápido con miles de plazas)
  const enLugar=base.filter(lugarActivo);
  const contarPor=(sin,clave)=>{const m=new Map();for(const o of enLugar)if(pasaFiltros(o,sin)){const k=clave(o);m.set(k,(m.get(k)||0)+1)}return m};
  const cSec=contarPor("sec",o=>o.tipo||"otros"),cSub=contarPor("sub",o=>o.subtipo),cDif=contarPor("dif",dificultad),cGrp=contarPor("grp",grupoDe);
  const cuenta=(sin,fn)=>{const m={sec:cSec,sub:cSub,dif:cDif,grp:cGrp}[sin];let n=0;for(const [k,v] of m)if(fn({tipo:k,subtipo:k,dificultad:k,grupo:k,_k:k}))n+=v;return n};
  let tot=0;for(const v of cSec.values())tot+=v;
  $("fsec").innerHTML=SECTORES.map(s=>{const n=cSec.get(s.k)||0;return n||S.sec===s.k?`<button type="button" data-sec="${S.sec===s.k?"":s.k}" aria-pressed="${S.sec===s.k}" title="${n} ${n===1?"plaza":"plazas"}"><span class="i" aria-hidden="true">${ICONO[s.k]||"•"}</span>${esc(CORTO[s.k]||s.n)}</button>`:""}).join("");
  const subs=S.sec?SECT[S.sec]?.subs||[]:[];
  $("fsub").hidden=!subs.length;
  $("fsub").innerHTML=subs.map(([k,n])=>{const x=cSub.get(k)||0;return x||S.subs.includes(k)?`<button type="button" class="chip" data-sub="${k}" aria-pressed="${S.subs.includes(k)}">${esc(n)}<small>${x}</small></button>`:""}).join("");
  $("fniv").innerHTML=NIV_OPC.map(([v,l])=>`<option value="${v}">${t(l)}</option>`).join("");$("fniv").value=S.niv==null?"":String(S.niv);
  $("fdif").innerHTML=DIF.map(([v,l])=>`<button type="button" data-dif="${v}" aria-pressed="${S.dif.includes(v)}">${t(l)}<small>${cDif.get(v)||0}</small></button>`).join("");
  $("fgrp").innerHTML=GRUPOS.map(([v,l])=>`<button type="button" data-grp="${v}" aria-pressed="${S.grp.includes(v)}">${t(l)}<small>${cGrp.get(v)||0}</small></button>`).join("");
  $("soloCumplo").checked=S.solo;$("soloNota").textContent=S.perfil?.nivel!=null?"":"(completa tu perfil)";
  const av=$("avisoPerfil"),sinPerfil=S.perfil?.nivel==null;let cerrado=false;try{cerrado=!!sessionStorage.getItem("rp_avp")}catch(_){}
  av.hidden=!(sinPerfil&&!cerrado)&&!(!sinPerfil&&!S.solo&&!cerrado);
  av.innerHTML=sinPerfil?`<span>Dinos tus estudios e intereses y te enseñamos solo lo que encaja contigo.</span><button type="button" data-ir-perfil>Completar perfil</button><button type="button" class="x" data-cerrar-aviso aria-label="Cerrar">✕</button>`
    :`<span>Tienes el perfil hecho. ¿Ver solo las plazas que encajan contigo?</span><button type="button" data-solo-perfil>Ver solo las mías</button><button type="button" class="x" data-cerrar-aviso aria-label="Cerrar">✕</button>`;
  if(S.meta){$("lastrun").textContent=`${LANG==="ca"?"Última revisió":"Última revisión"}: ${new Date(S.meta.fecha).toLocaleString(LANG==="ca"?"ca-ES":"es-ES",{dateStyle:"medium",timeStyle:"short"})} · ${S.meta.recogidas??0} ${t("nuevas")} · ${S.meta.completadas??0} ${LANG==="ca"?"fitxes llegides":"fichas leídas"}`}
  S.mapRows=base.filter(o=>pasaFiltros(o));
  if(S.clasico){drawPins();renderInfo();drawEs()}
  renderLugar();
  window.Mapa3D&&S.m3&&Mapa3D.actualizar(S.mapRows,S.place);
  const rows=S.mapRows.filter(lugarActivo)
    .sort(S.place?.kind==="cerca"?(a,b)=>distOferta(a)-distOferta(b):(a,b)=>{const da=daysLeft(a),db=daysLeft(b);if(da===null&&db===null)return 0;if(da===null)return 1;if(db===null)return -1;return da-db});
  const activos=S.dif.length+S.grp.length+(S.place?1:0)+(S.sec?1:0)+S.subs.length+(S.niv!=null?1:0)+(S.solo?1:0);
  $("fclear").hidden=!activos;
  $("hTotal").textContent=rows.length.toLocaleString("es-ES");
  $("hTexto").textContent=(rows.length===1?"plaza ":"plazas ")+(S.tab==="nuevas"?(S.ses?"nuevas sin revisar":"nuevas esta semana"):S.tab==="mias"?"en seguimiento":S.tab==="descartada"?"descartadas":"abiertas")+" "+nombreLugar(S.place);
  renderActivos();
  if(!rows.length){
    const sinCuenta=!S.ses&&["mias","descartada"].includes(S.tab);
    const msg=sinCuenta?"Entra con tu correo para seguir plazas y verlas aquí en cualquier dispositivo.":{nuevas:S.ses?"No hay plazas nuevas sin revisar. Cuando la revisión diaria encuentre algo, aparecerá aquí y te llegará un aviso.":"No han entrado plazas nuevas esta semana con estos filtros.",
      mias:"Pulsa «Me interesa» en una plaza para seguirla aquí: etapas, documentos, notas y recordatorio antes de que cierre.",
      todas:t("No hay plazas abiertas que encajen con tus criterios ahora mismo."),descartada:"Nada descartado."}[S.tab]+(activos?" "+t("Prueba a quitar algún filtro."):"");
    $("list").innerHTML=`<div class="empty">${S.ofertas.length||S.loaded?msg:t("Aquí aparecerán las plazas que encajen con tus criterios.")}</div>`;return;
  }
  $("list").innerHTML=rows.slice(0,S.mostrar||60).map(card).join("")+(rows.length>(S.mostrar||60)?`<button type="button" class="mas" id="verMas">Ver ${Math.min(60,rows.length-(S.mostrar||60))} más (de ${rows.length-(S.mostrar||60)})</button>`:"");
}
function nombreLugar(p){
  if(!p)return "en toda España";
  if(p.kind==="ccaa")return p.id==="Estatal"?"de ámbito estatal":"en "+p.id;
  if(p.kind==="prov")return "en la provincia de "+(PROV_NOM[p.id]||"");
  if(p.kind==="provES")return "en la provincia de "+p.id;
  if(p.kind==="com")return "en "+(COM_NOM[p.id]||"la comarca");
  if(p.kind==="toda")return "válidas en toda Cataluña";
  if(p.kind==="cerca")return `a menos de ${p.km} km de ${p.id}`;
  return "en "+p.id;
}
function renderActivos(){
  const a=[];
  if(S.q)a.push(["q",`“${S.q}”`]);
  if(S.place)a.push(["place",S.place.kind==="cerca"?`A ${S.place.km} km de ${S.place.id}`:nombreLugar(S.place).replace(/^en (la provincia de )?/,"")]);
  if(S.sec)a.push(["sec",SECT[S.sec]?.n||S.sec]);
  for(const k of S.subs)a.push(["sub:"+k,SUBN[k]?.n||k]);
  if(S.niv!=null)a.push(["niv",NIV_OPC.find(x=>x[0]===String(S.niv))?.[1]]);
  for(const d of S.dif)a.push(["dif:"+d,DIF[d-1][1]]);
  for(const g of S.grp)a.push(["grp:"+g,g==="?"?"Sin grupo":"Grupo "+g]);
  if(S.solo)a.push(["solo","Encaja con mi perfil"]);
  $("activos").innerHTML=a.map(([k,l])=>`<button type="button" class="activo" data-quitar="${esc(k)}" aria-label="Quitar filtro ${esc(l)}">${esc(l)}</button>`).join("");
}
function renderM3info(rows){
  const box=$("m3info");
  if(!S.place){box.hidden=true;return}
  const pronto=rows.filter(o=>{const n=daysLeft(o);return n!==null&&n>=0&&n<=7}).length;
  box.hidden=false;
  box.innerHTML=`<div><b>${esc(nombreLugar(S.place).replace(/^en (la provincia de )?/,""))}</b><span>${rows.length} ${rows.length===1?"plaza":"plazas"}${pronto?` · ${pronto} cierran en 7 días`:""}</span></div>
    <div class="acc"><button type="button" class="si" id="m3ver">Ver lista</button><button type="button" id="m3quitar" aria-label="Quitar el lugar y ver toda España">✕</button></div>`;
}
function promoOpos(o){return o.tipo==="seguridad"&&(o.subtipo==="mossos"||(o.comunidad==="Cataluña"&&["policia-local","agente-civico","vigilante"].includes(o.subtipo)))}
function card(o){
  const n=daysLeft(o), m=o.marca||"nueva";
  let due;
  if(n===null)due=`<div class="due none"><small>${esc(t(o.estado==="pendiente"?"aún sin":"sin"))}</small><small>${t("plazo")}</small></div>`;
  else if(n<0)due=`<div class="due none"><small>${t("cerrada")}</small></div>`;
  else if(n===0)due=`<div class="due urgent"><b class="hoy">${LANG==="ca"?"Avui":"Hoy"}</b><small>${LANG==="ca"?"últim dia":"último día"}</small></div>`;
  else{const cls=n<=3?"urgent":n<=7?"soon":"";due=`<div class="due ${cls}" title="${t("hasta")} ${fmtDate(o.terminiFecha)}"><b>${n}</b><small>${t(n===1?"día":"días")}</small></div>`}
  const tags=[];
  if(esNueva(o)&&isOpen(o))tags.push(`<span class="tag new">${t("nueva")}</span>`);
  const sec=SECT[o.tipo||"otros"];tags.push(`<span class="tag prio">${esc(o.subtipo&&SUBN[o.subtipo]?SUBN[o.subtipo].n:sec?.n||"Otros")}</span>`);
  if(S.place?.kind==="cerca"){const d=distOferta(o);if(d!==null)tags.push(`<span class="tag dist">a ${d<1?"menos de 1":Math.round(d)} km${o._aprox?" (aprox.)":""}</span>`)}
  const c=cumpleDe(o);
  if(c)tags.push(c.estado==="si"?`<span class="tag ok">✓ ${t("Cumples")}</span>`:c.estado==="no"?`<span class="tag ko" title="${esc(c.faltan.join(" · "))}">✗ ${t("Te falta")}: ${esc(c.faltan[0])}${c.faltan.length>1?` +${c.faltan.length-1}`:""}</span>`:`<span class="tag">? ${t("Revisa")} ${esc(c.dudas.join(", "))}</span>`);
  const dv=dificultad(o);
  const meta=[o.zona,o.sistema,o.grupo?`${LANG==="ca"?"grup":"grupo"} ${o.grupo}`:"",o.tipoPersonal,o.terminiFecha?`${t("hasta")} ${fmtDate(o.terminiFecha)}`:o.terminiTexto||""].filter(Boolean);
  const dis=!S.busy.has(o.id)?"":"disabled";
  const sigue=SEGUIMIENTO.has(m);
  const ruta=esc(o.ruta?API+o.ruta:o.url);
  const segui=S.ses&&sigue?seguimiento(o):"";
  return `<article class="card ${isOpen(o)?"":"closed"}" id="c-${esc(o.id.replace(/[^a-zA-Z0-9]/g,"-"))}">${due}<button type="button" class="descartar" data-id="${esc(o.id)}" data-marca="descartada" aria-pressed="${m==="descartada"}" aria-label="${t(m==="descartada"?"Recuperar":"Descartar")}" title="${t(m==="descartada"?"Recuperar":"Descartar")}" ${dis}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button><div class="body">
    <div class="ens"><span aria-hidden="true">${ICONO[o.tipo||"otros"]||""}</span><span>${esc(o.ens)}</span></div>
    <h2 class="titulo"><a href="${ruta}">${esc(o.titulo)}</a></h2>
    <p class="meta">${meta.map(esc).join(" · ")}</p>
    <div class="tags">${tags.join("")}</div>
    <div class="acts">${o.tramiteUrl&&isOpen(o)?`<a class="primary" href="${esc(o.tramiteUrl)}" target="_blank" rel="noopener">${t("Presentar solicitud")}</a>`:""}
      <button type="button" class="sigo" data-id="${esc(o.id)}" data-marca="interesa" aria-pressed="${sigue}" ${dis}>${sigue?"★ "+t(ETAPAS.find(e=>e[0]===m)?.[1]||"Me interesa"):"☆ "+t("Me interesa")}</button>
      <span class="ico">
        <button type="button" data-share="${esc(o.id)}" aria-label="${t("Compartir")}" title="${t("Compartir")}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v10M6 7l4-4 4 4M4 12v4h12v-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        ${o.terminiFecha&&isOpen(o)?`<a href="${API}/api/ics/${esc(o.id.split(":")[0])}/${encodeURIComponent(o.id.split(":").slice(1).join(":"))}" aria-label="${t("Calendario")}" title="${t("Calendario")}"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4.5" width="14" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 8.5h14M7 3v3M13 3v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></a>`:""}
      </span></div>
    ${promoOpos(o)?`<a class="promo" href="https://opos365.com" target="_blank" rel="noopener">${t("Prepárate con OPOS 365")}: temario y tests</a>`:""}
    ${segui}
  </div></article>`;
}
function seguimiento(o){
  const docs=o.docs||{},abierto=S.abiertos.has(o.id);
  const hist=(o.historia||[]).slice(-2).reverse().map(h=>`<li>${esc(new Date(h.fecha).toLocaleDateString("es-ES"))}: ${esc(h.texto)}</li>`).join("");
  return `<details class="segui" data-segui="${esc(o.id)}" ${abierto?"open":""}><summary>${t("Seguimiento")}${o.notas?" · 📝":""}${Object.values(docs).filter(Boolean).length?` · ${Object.values(docs).filter(Boolean).length}/${DOCS.length} docs`:""}</summary>
    <label class="mini-l">${t("Etapa")} <select data-etapa-de="${esc(o.id)}">${ETAPAS.map(([k,l])=>`<option value="${k}" ${o.marca===k?"selected":""}>${t(l)}</option>`).join("")}</select></label>
    <div class="docs"><span class="mini-l">${t("Documentos")}</span>${DOCS.map(([k,l])=>`<label><input type="checkbox" data-doc="${k}" data-de="${esc(o.id)}" ${docs[k]?"checked":""}> ${esc(l)}</label>`).join("")}</div>
    <label class="mini-l">${t("Notas")}<textarea data-notas="${esc(o.id)}" maxlength="2000" rows="2" placeholder="Fechas, dudas, contraseña de la sede…">${esc(o.notas||"")}</textarea></label>
    ${hist?`<ul class="hist">${hist}</ul>`:""}
  </details>`;
}
function resumenFiltros(f){
  const p=[];
  if(f.cerca)p.push(`A menos de ${f.cerca.km} km de ${f.cerca.etiqueta||"tu ubicación"}`);
  else if(f.zonas?.length)p.push(f.zonas.length>4?`${f.zonas.length} municipios`:f.zonas.join(", "));
  else if(f.provincias?.length)p.push(f.provincias.join(", "));
  else if(f.comunidades?.length)p.push(f.comunidades.join(", "));else p.push("Toda España");
  if(f.subtipos?.length)p.push(f.subtipos.map(k=>SUBN[k]?.n||k).join(", "));
  else if(f.tipos?.length)p.push(f.tipos.length>4?"varios sectores":f.tipos.map(k=>SECT[k]?.n||k).join(", "));
  if(f.nivelMax!=null)p.push(NIV_OPC.find(x=>x[0]===String(f.nivelMax))?.[1]||"");
  if(f.palabras?.length)p.push(`“${f.palabras.slice(0,3).join("”, “")}”${f.palabras.length>3?"…":""}`);
  if(f.dificultades?.length)p.push(f.dificultades.map(d=>DIF[d-1][1]).join("/"));
  if(f.grupos?.length)p.push(f.grupos.map(g=>g==="?"?"sin grupo":g).join("/"));
  return p.join(" · ");
}
function filtrosActuales(){
  const f={soloAbiertas:true};
  if(S.dif.length)f.dificultades=[...S.dif];
  if(S.grp.length)f.grupos=[...S.grp];
  if(S.sec)f.tipos=[S.sec];
  if(S.subs.length)f.subtipos=[...S.subs];
  if(S.niv!=null)f.nivelMax=S.niv;
  const pl=S.place;
  if(pl?.kind==="ccaa")f.comunidades=[pl.id];
  else if(pl?.kind==="provES")f.provincias=[pl.id];
  else if(pl?.kind==="muniES")f.zonas=[pl.id];
  else if(pl?.kind==="cerca")f.cerca={lat:pl.lat,lon:pl.lon,km:pl.km,etiqueta:pl.id};
  else if(pl?.kind==="muni")f.zonas=[pl.id];
  else if(pl?.kind==="com")f.zonas=GEO.munis.filter(m=>m[1]===pl.id).map(m=>m[0]);
  else if(pl?.kind==="prov"){f.comunidades=["Cataluña"];f.zonas=GEO.munis.filter(m=>m[2]===pl.id).map(m=>m[0])}
  return f;
}

// ---------- Mapa ----------
const PROV_NOM={8:"Barcelona",17:"Girona",25:"Lleida",43:"Tarragona"};
const COM_NOM=Object.fromEntries(GEO.comarques.map(c=>[c.id,c.nom]));
const nn=s=>(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/’/g,"'").replace(/^(el|la|els|les)\s+|^l'/,"").trim();
const MUNI=new Map(GEO.munis.map(m=>[nn(m[0]),{nom:m[0],com:m[1],prov:m[2],x:m[3],y:m[4]}]));
function muniDe(o){if(o._mc!==undefined)return o._mc;return o._mc=muniDe0(o)}
function muniDe0(o){
  if(o.comunidad&&o.comunidad!=="Cataluña")return null;
  let m=MUNI.get(nn(o.zona));if(m)return m;
  const e=(o.ens||"").match(/^Ajuntament (?:de l'|de la |dels |de les |del |de |d')([^-–]+?)(?:\s+[-–].*)?$/i);
  if(e&&(m=MUNI.get(nn(e[1]))))return m;
  const p=(o.titulo||"").match(/\(([^()]+)\)\s*$/);
  if(p&&(m=MUNI.get(nn(p[1]))))return m;
  return null;
}
const FULL={x:-12,y:-12,w:1024,h:GEO.h+24};
let VB={...FULL};
const svg=$("map");
const NS="http://www.w3.org/2000/svg";
function initMap(){
  const lbl=(t,x,y,size)=>`<text class="provlbl" x="${x}" y="${y}" font-size="${size}">${t}</text>`;
  svg.innerHTML=`<g id="lyr-com">${GEO.comarques.map(c=>`<path class="com" data-com="${c.id}" d="${c.d}"><title>${esc(c.nom)}</title></path>`).join("")}</g>
    <path class="b-com" d="${GEO.com}"/><path class="b-prov" d="${GEO.prov}"/><path class="b-out" d="${GEO.outer}"/>
    <g id="provlbls">${lbl("Lleida",150,330,26)}${lbl("Girona",760,250,26)}${lbl("Barcelona",470,560,26)}${lbl("Tarragona",210,760,26)}</g>
    <g id="pins"></g>`;
  setVB(FULL);
}
function setVB(v){
  const asp=FULL.h/FULL.w;
  v.w=Math.min(FULL.w*1.2,Math.max(60,v.w)); v.h=v.w*asp;
  v.x=Math.min(FULL.x+FULL.w-v.w*0.3,Math.max(FULL.x-v.w*0.7,v.x)); v.y=Math.min(FULL.y+FULL.h-v.h*0.3,Math.max(FULL.y-v.h*0.7,v.y));
  VB=v; svg.setAttribute("viewBox",`${v.x} ${v.y} ${v.w} ${v.h}`);
  svg.style.touchAction=v.w<FULL.w*0.98?"none":"pan-y";
  drawPins();
}
function unit(){return VB.w/(svg.clientWidth||600)}
function zoomAt(f,cx,cy){
  if(cx==null){cx=VB.x+VB.w/2;cy=VB.y+VB.h/2}
  const w=VB.w*f,h=VB.h*f;
  setVB({x:cx-(cx-VB.x)*f,y:cy-(cy-VB.y)*f,w,h});
}
function zoomProv(code){
  const ms=GEO.munis.filter(m=>m[2]===code);
  const xs=ms.map(m=>m[3]),ys=ms.map(m=>m[4]);
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const w=Math.max(x1-x0,(y1-y0)*FULL.w/FULL.h)*1.15;
  setVB({x:(x0+x1)/2-w/2,y:(y0+y1)/2-w*FULL.h/FULL.w/2,w,h:0});
}
function urgClass(n){return n===null?"none":n<=3?"urgent":n<=7?"soon":"ok"}
S.mapRows=[];S.sel=null;
function grupos(){
  const pins=new Map(),coms=new Map(),toda=[];let fuera=0;
  for(const o of S.mapRows){
    if(o.comunidad&&o.comunidad!=="Cataluña"){fuera++;continue}
    const m=muniDe(o);
    if(!m){toda.push(o);continue}
    if(!pins.has(m.nom))pins.set(m.nom,{m,items:[]});
    pins.get(m.nom).items.push(o);
    coms.set(m.com,(coms.get(m.com)||0)+1);
  }
  return {pins,coms,toda,fuera};
}
function drawPins(){
  if(!svg.firstChild||S.mapa!=="cat")return;
  const {pins,coms,toda,fuera}=grupos();
  const fb=$("fuera");fb.hidden=!fuera;fb.textContent=`${fuera} fuera de Cataluña → ver España`;
  for(const p of svg.querySelectorAll(".com")){
    const n=coms.get(+p.dataset.com)||0;
    p.setAttribute("class","com"+(n>=3?" h3":n===2?" h2":n===1?" h1":"")+(S.sel?.kind==="com"&&S.sel.id===+p.dataset.com?" sel":""));
  }
  const u=unit(),zoomed=VB.w<FULL.w*0.6;
  // Las plazas más grandes y urgentes primero, para que sus etiquetas tengan prioridad.
  const arr=[...pins.values()].map(g=>{
    const ds=g.items.map(daysLeft).filter(d=>d!==null&&d>=0);
    return {...g,near:ds.length?Math.min(...ds):null,r:(8+3*Math.sqrt(g.items.length-1))*u};
  }).sort((a,b)=>b.items.length-a.items.length||(a.near??999)-(b.near??999));
  const cajas=arr.map(g=>({x0:g.m.x-g.r,x1:g.m.x+g.r,y0:g.m.y-g.r,y1:g.m.y+g.r}));
  const choca=b=>cajas.some(c=>b.x0<c.x1&&b.x1>c.x0&&b.y0<c.y1&&b.y1>c.y0);
  const html=arr.map(g=>{
    const {m,items,near,r}=g;
    const sel=S.sel?.kind==="muni"&&S.sel.id===m.nom;
    const w=m.nom.length*6.6*u,hh=14*u;
    let lbl="";
    for(const lado of [1,-1]){
      const x=lado>0?m.x+r+3*u:m.x-r-3*u-w;
      const box={x0:x,x1:x+w,y0:m.y-hh/2,y1:m.y+hh/2};
      if(box.x1>VB.x+VB.w||box.x0<VB.x)continue;
      if(!sel&&choca(box))continue;
      cajas.push(box);
      lbl=`<text x="${lado>0?x:x+w}" y="${m.y+4*u}" font-size="${12*u}" stroke-width="${3*u}" text-anchor="${lado>0?"start":"end"}">${esc(m.nom)}</text>`;
      break;
    }
    return `<g class="pin ${urgClass(near)}${sel?" sel":""}" data-muni="${esc(m.nom)}" tabindex="0" role="button" aria-label="${esc(m.nom)}: ${items.length} plaza${items.length>1?"s":""}">
      <circle cx="${m.x}" cy="${m.y}" r="${r}"/>
      ${items.length>1?`<text class="n" x="${m.x}" y="${m.y}" font-size="${11*u}">${items.length}</text>`:""}${lbl}</g>`;
  });
  // Se pintan de abajo arriba para que los puntos del sur no tapen a los del norte.
  $("pins").innerHTML=html.map((h,i)=>[h,arr[i].m.y]).sort((a,b)=>a[1]-b[1]).map(x=>x[0]).join("");
  const t=$("toda");
  if(toda.length){t.hidden=false;t.textContent=`+${toda.length} válida${toda.length>1?"s":""} en toda Cataluña`}else t.hidden=true;
  for(const lbl of svg.querySelectorAll(".provlbl"))lbl.setAttribute("font-size",String(Math.min(26,13*u)));
  $("provlbls").style.display=VB.w<FULL.w*0.45?"none":"";
}
function miniRow(o){
  const n=daysLeft(o),c=urgClass(n);
  return `<a class="mini" href="${esc(o.url)}" target="_blank" rel="noopener"><b class="${c}">${n===null?"sin<br>plazo":n}</b><span>${esc(o.titulo)}<br><small class="note">${esc(o.ens)}${o.terminiFecha?" · hasta "+fmtDate(o.terminiFecha):o.terminiTexto?" · "+esc(o.terminiTexto):""}</small></span></a>`;
}
function renderInfo(){
  const box=$("mapinfo"),sel=S.sel;
  if(!sel){box.innerHTML=`<p class="note">Toca un punto para ver las plazas de ese municipio, o una comarca para filtrar la lista. Arrastra para moverte y usa ＋ / － para acercar.</p>`;return}
  const {pins,toda}=grupos();
  if(sel.kind==="muni"){
    const g=pins.get(sel.id);
    if(!g){S.sel=null;return renderInfo()}
    box.innerHTML=`<h3>${esc(g.m.nom)}</h3><p class="note sub">${esc(COM_NOM[g.m.com]||"")} · provincia de ${PROV_NOM[g.m.prov]} · ${g.items.length} plaza${g.items.length>1?"s":""}</p>
      ${g.items.map(miniRow).join("")}<button type="button" class="linkbtn" data-place="muni">Ver en la lista</button>`;
  }else if(sel.kind==="com"){
    const items=S.mapRows.filter(o=>muniDe(o)?.com===sel.id);
    const munis=new Set(items.map(o=>muniDe(o).nom));
    box.innerHTML=`<h3>${esc(COM_NOM[sel.id])}</h3><p class="note sub">${items.length?`${items.length} plaza${items.length>1?"s":""} en ${munis.size} municipio${munis.size>1?"s":""}`:"No hay plazas en esta comarca con la vista actual."}</p>
      ${items.slice(0,6).map(miniRow).join("")}${items.length?`<button type="button" class="linkbtn" data-place="com">Ver en la lista</button>`:""}`;
  }else{
    box.innerHTML=`<h3>Toda Cataluña</h3><p class="note sub">Plazas que no dependen de un municipio concreto.</p>${toda.map(miniRow).join("")}`;
  }
}

// ---------- Lugar (desplegable) y mapa de España ----------
const PROV_ES=ESP.provs.map(p=>p.n);
function lugarActivo(o){
  if(!S.place)return true;
  if(S.place.kind==="ccaa")return (o.comunidad||"Cataluña")===S.place.id;
  if(S.place.kind==="provES")return normTxt(o.provincia)===normTxt(S.place.id)||o.comunidad==="Estatal";
  if(S.place.kind==="muniES")return normTxt(o.municipio)===normTxt(S.place.id);
  if(S.place.kind==="cerca"){const d=distOferta(o);return d!==null&&d<=S.place.km}
  if(o.comunidad&&o.comunidad!=="Cataluña")return false;
  const m=muniDe(o);
  if(S.place.kind==="toda")return !m;
  if(!m)return S.place.kind==="prov"; // las plazas válidas en toda Cataluña se ven en cualquier provincia
  return S.place.kind==="muni"?m.nom===S.place.id:S.place.kind==="com"?m.com===S.place.id:m.prov===S.place.id;
}
function placeKey(p){return p?`${p.kind}:${p.id}`:""}
function renderLugar(){
  const sel=$("lugarsel");
  const base=S.mapRows;
  const porProv=new Map(),porCom=new Map(),porMuni=new Map(),porEs=new Map();let toda=0;
  for(const o of base){if(o.provincia)porEs.set(o.provincia,(porEs.get(o.provincia)||0)+1);
    if(o.comunidad&&o.comunidad!=="Cataluña")continue;const m=muniDe(o);if(!m){toda++;continue}
    porProv.set(m.prov,(porProv.get(m.prov)||0)+1);porCom.set(m.com,(porCom.get(m.com)||0)+1);porMuni.set(m.nom,(porMuni.get(m.nom)||0)+1)}
  const opt=(v,l,n)=>`<option value="${esc(v)}">${esc(l)}${n!=null?` (${n})`:""}</option>`;
  const byName=(a,b)=>a[0].localeCompare(b[0],"ca");
  const porCcaa=new Map();for(const o of base){const c=o.comunidad||"Cataluña";porCcaa.set(c,(porCcaa.get(c)||0)+1)}
  let h=opt("",t("Toda España"),base.length);
  h+=`<optgroup label="Comunidades">${COMUNIDADES.filter(c=>c==="Cataluña"||porCcaa.get(c)).map(c=>opt("ccaa:"+c,c==="Estatal"?"Estatal (toda España)":c,porCcaa.get(c)||0)).join("")}</optgroup>`;
  const esConPlazas=[...porEs].filter(([p])=>!["Barcelona","Girona","Lleida","Tarragona"].includes(p)).sort(byName);
  if(esConPlazas.length)h+=`<optgroup label="Provincias">${esConPlazas.map(([p,n])=>opt("provES:"+p,p,n)).join("")}</optgroup>`;
  h+=`<optgroup label="Provincias de Cataluña">${[8,17,25,43].map(c=>opt("prov:"+c,PROV_NOM[c],porProv.get(c)||0)).join("")}</optgroup>`;
  if(porCom.size)h+=`<optgroup label="Comarcas con plazas">${[...porCom].map(([c,n])=>[COM_NOM[c],c,n]).sort(byName).map(([l,c,n])=>opt("com:"+c,l,n)).join("")}</optgroup>`;
  if(porMuni.size)h+=`<optgroup label="Localidades con plazas">${[...porMuni].sort(byName).map(([l,n])=>opt("muni:"+l,l,n)).join("")}</optgroup>`;
  if(toda)h+=`<optgroup label="Sin municipio">${opt("toda:1","Válidas en toda Cataluña",toda)}</optgroup>`;
  if(S.place?.kind==="cerca")h+=opt(placeKey(S.place),`A ${S.place.km} km de ${S.place.id}`,null);
  const k=placeKey(S.place);
  if(k&&!h.includes(`value="${esc(k)}"`))h+=opt(k,(["muni","ccaa","provES","muniES"].includes(S.place.kind)?S.place.id:S.place.kind==="com"?COM_NOM[S.place.id]:PROV_NOM[S.place.id])||"Lugar elegido",0);
  sel.innerHTML=h;sel.value=k;
}
$("lugarsel").addEventListener("change",e=>{
  const v=e.target.value;
  if(v.startsWith("cerca:"))return;
  if(!v){S.place=null;setVB({...FULL})}
  else{const [kind,id]=v.split(/:(.*)/s);S.place={kind,id:["muni","ccaa","provES","muniES"].includes(kind)?id:kind==="toda"?"1":+id};
    if(kind==="ccaa"||kind==="provES"){setVB({...FULL});if(kind==="provES"||(kind==="ccaa"&&id!=="Cataluña"))cambiarMapa("es")}
    if(kind==="prov"){cambiarMapa("cat");zoomProv(+id)}
    else if(kind==="muni"){cambiarMapa("cat");const m=MUNI.get(nn(id));if(m){const w=FULL.w*0.3;setVB({x:m.x-w/2,y:m.y-w*FULL.h/FULL.w/2,w,h:0});S.sel={kind:"muni",id}}}
    else if(kind==="com"){cambiarMapa("cat");const ms=GEO.munis.filter(m=>m[1]===+id),xs=ms.map(m=>m[3]),ys=ms.map(m=>m[4]);
      const w=Math.max(Math.max(...xs)-Math.min(...xs),(Math.max(...ys)-Math.min(...ys))*FULL.w/FULL.h)*1.6+40;
      setVB({x:(Math.max(...xs)+Math.min(...xs))/2-w/2,y:(Math.max(...ys)+Math.min(...ys))/2-w*FULL.h/FULL.w/2,w,h:0});S.sel={kind:"com",id:+id}}}
  guardarFiltros();render();window.Mapa3D&&S.m3&&Mapa3D.enfocar(S.place);
});
function cambiarMapa(v){
  S.mapa=v;ls.set("rp_mapa",v);
  // (los SVG no tienen la propiedad hidden: se usa el atributo)
  $("map").toggleAttribute("hidden",v!=="cat");$("mapEs").toggleAttribute("hidden",v!=="es");
  $("zooms").hidden=v!=="cat";$("leyCat").hidden=v!=="cat";$("leyEs").hidden=v!=="es";$("mapinfo").hidden=v!=="cat";
  $("toda").hidden=true;$("fuera").hidden=true;
  for(const b of document.querySelectorAll("[data-mapa]"))b.setAttribute("aria-pressed",String(b.dataset.mapa===v));
  if(v==="cat")drawPins();else drawEs();
}
function drawEs(){
  if(S.mapa!=="es")return;
  const por=new Map();let estatal=0;
  for(const o of S.mapRows){if(o.comunidad==="Estatal"){estatal++;continue}if(o.provincia)por.set(normTxt(o.provincia),(por.get(normTxt(o.provincia))||0)+1)}
  const max=Math.max(1,...por.values());
  const sel=S.place?.kind==="provES"?normTxt(S.place.id):"";
  $("mapEs").setAttribute("viewBox",`0 0 ${ESP.w} ${ESP.h}`);
  $("mapEs").innerHTML=ESP.provs.map(p=>{const n=por.get(normTxt(p.n))||0,lv=n?Math.min(3,1+Math.floor(2.99*n/max)):0;
      return `<path class="prv${lv?" h"+lv:""}${sel===normTxt(p.n)?" sel":""}" data-prv="${esc(p.n)}" d="${p.d}"><title>${esc(p.n)}: ${n}</title></path>`}).join("")+
    ESP.provs.filter(p=>por.get(normTxt(p.n))).map(p=>`<text class="prvn" x="${p.x}" y="${p.y}">${por.get(normTxt(p.n))}</text>`).join("")+
    `<rect class="canarias" x="2" y="${ESP.h-200}" width="330" height="190"/>`;
  $("mapinfoEs").textContent=`${estatal?`${estatal} de ámbito estatal (toda España) no salen en el mapa. `:""}Toca una provincia para ver sus plazas.`;
}
$("mapEs").addEventListener("click",e=>{
  const p=e.target.closest("[data-prv]");if(!p)return;
  const id=p.dataset.prv;
  if(["Barcelona","Girona","Lleida","Tarragona"].includes(id)){S.place={kind:"prov",id:{Barcelona:8,Girona:17,Lleida:25,Tarragona:43}[id]};cambiarMapa("cat");zoomProv(S.place.id)}
  else S.place={kind:"provES",id};
  guardarFiltros();render();$("list").scrollIntoView({behavior:"smooth",block:"start"});
});

// Arrastrar, pellizcar y rueda
const ptrs=new Map();let drag=null,moved=false;
function toSvg(e){const r=svg.getBoundingClientRect();return {x:VB.x+(e.clientX-r.left)/r.width*VB.w,y:VB.y+(e.clientY-r.top)/r.height*VB.h,r}}
svg.addEventListener("pointerdown",e=>{
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false;
  if(ptrs.size===1)drag={x:e.clientX,y:e.clientY,vb:{...VB}};
  if(e.pointerType==="mouse"||VB.w<FULL.w*0.98||ptrs.size>1){try{svg.setPointerCapture(e.pointerId)}catch(_){}}
});
svg.addEventListener("pointermove",e=>{
  if(!ptrs.has(e.pointerId))return;
  const prev=ptrs.get(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===2){
    const [a,b]=[...ptrs.values()];const pa=e.pointerId===[...ptrs.keys()][0]?prev:a,pb=e.pointerId===[...ptrs.keys()][1]?prev:b;
    const d0=Math.hypot(pa.x-pb.x,pa.y-pb.y),d1=Math.hypot(a.x-b.x,a.y-b.y);
    if(d0>0&&d1>0){const c=toSvg({clientX:(a.x+b.x)/2,clientY:(a.y+b.y)/2});zoomAt(d0/d1,c.x,c.y)}
    moved=true;return;
  }
  if(!drag)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(Math.hypot(dx,dy)>6)moved=true;
  if(!moved)return;
  if(e.pointerType!=="mouse"&&VB.w>=FULL.w*0.98)return; // en el móvil, sin zoom, se deja hacer scroll a la página
  svg.classList.add("dragging");
  const r=svg.getBoundingClientRect();
  setVB({x:drag.vb.x-dx/r.width*drag.vb.w,y:drag.vb.y-dy/r.height*drag.vb.h,w:drag.vb.w,h:0});
});
function endPtr(e){
  ptrs.delete(e.pointerId);svg.classList.remove("dragging");
  if(ptrs.size===0){
    if(!moved&&e.type==="pointerup"){
      const pin=e.target.closest?.("[data-muni]"),com=e.target.closest?.("[data-com]");
      if(pin)S.sel={kind:"muni",id:pin.dataset.muni};else if(com)S.sel={kind:"com",id:+com.dataset.com};else S.sel=null;
      drawPins();renderInfo();
    }
    drag=null;
  }else if(ptrs.size===1){const [p]=ptrs.values();drag={x:p.x,y:p.y,vb:{...VB}}}
}
svg.addEventListener("pointerup",endPtr);svg.addEventListener("pointercancel",endPtr);
svg.addEventListener("wheel",e=>{e.preventDefault();const c=toSvg(e);zoomAt(e.deltaY>0?1.2:1/1.2,c.x,c.y)},{passive:false});
svg.addEventListener("dblclick",e=>{const c=toSvg(e);zoomAt(0.5,c.x,c.y)});
svg.addEventListener("keydown",e=>{const pin=e.target.closest?.("[data-muni]");if(pin&&(e.key==="Enter"||e.key===" ")){e.preventDefault();S.sel={kind:"muni",id:pin.dataset.muni};drawPins();renderInfo()}});
window.addEventListener("resize",()=>drawPins());
initMap();

// ---------- Alertas, cuenta y perfil ----------
function renderCrit(){
  const box=$("critBody"),al=S.alertas;
  if(!S.ses){box.innerHTML=`<div class="cta"><p class="note">Crea una cuenta gratis con tu correo y te avisamos por email (o por Telegram) cada vez que salga una plaza que encaje con tus filtros: sector, subcategoría, lugar, estudios, dificultad y grupo.</p><button type="button" class="linkbtn" data-acceso="alertas">${t("Crear cuenta gratis")}</button></div>`;return}
  if(!al){box.innerHTML=`<p class="note">Cargando alertas…</p>`;return}
  const max=S.yo?.limite_alertas??3,lleno=al.length>=max&&!S.yo?.admin;
  box.innerHTML=`<p class="note">Cada mañana se revisan el BOE, el CIDO y TMB. Si sale una plaza que encaja con una alerta activa, ${S.yo?.avisos_email===false?"la verás aquí (tienes los avisos por correo desactivados en Mi cuenta)":`te llega ${S.yo?.frecuencia==="semanal"?"un resumen cada lunes":"un correo"} a <b>${esc(S.yo?.email||"tu correo")}</b>`}${S.yo?.telegram?" y un mensaje por Telegram":""}.</p>
    ${al.map(a=>`<div class="alerta"><div><b>${esc(a.nombre)}</b><span class="note">${esc(resumenFiltros(a.filtros||{}))}</span></div>
      <button type="button" data-al-on="${esc(a.id)}" aria-pressed="${!!a.activa}">${t(a.activa?"Activa":"Pausada")}</button>
      <button type="button" data-al-edit="${esc(a.id)}">Editar</button>
      <button type="button" data-al-del="${esc(a.id)}">${S.borrando===a.id?"¿Borrar?":t("Borrar")}</button></div>`).join("")||'<p class="note">Aún no tienes alertas. Crea una con las palabras y las comunidades que te interesan.</p>'}
    ${lleno?`<p class="note">Has llegado al máximo de ${max} alertas de la cuenta gratuita. Borra una para crear otra.</p>`:`<button type="button" class="linkbtn" data-nueva-alerta>Crear una alerta</button>${S.yo&&!S.yo.admin?`<p class="note">${al.length} de ${max} alertas de la cuenta gratuita.</p>`:""}`}`;
}
const IDIOMAS=[["catalan","Catalán"],["valenciano","Valenciano"],["euskera","Euskera"],["gallego","Gallego"],["ingles","Inglés"],["frances","Francés"],["aleman","Alemán"]];
function completitud(p){if(!p)return 0;let n=0;if(p.nivel!=null)n+=35;if(p.intereses?.length)n+=25;if(Object.values(p.idiomas||{}).some(Boolean)||p.catalan)n+=15;if(p.edad)n+=10;if(p.carne?.length)n+=10;if(p.nacionalidad)n+=5;return Math.min(100,n)}
function renderPerfil(){
  const p=S.perfil||{},carne=p.carne||[],idi=p.idiomas||(p.catalan?{catalan:p.catalan}:{}),int=p.intereses||p.prefs?.intereses||[],pc=completitud(p);
  $("perfilBody").innerHTML=`<p class="note">Con tu perfil marcamos en cada plaza si cumples los requisitos y, si quieres, te enseñamos solo lo que encaja contigo. Se guarda en este dispositivo y, si entras, en tu cuenta.</p>
    <div class="progreso" role="progressbar" aria-valuenow="${pc}" aria-valuemin="0" aria-valuemax="100" aria-label="Perfil completado"><i style="width:${pc}%"></i></div>
    <div class="pgrupo"><h3>Estudios terminados</h3><select class="sel" data-pf="nivel"><option value="">Elige tu nivel…</option>${NIVELES.map((n,i)=>`<option value="${i}" ${p.nivel===i?"selected":""}>${esc(n)}</option>`).join("")}</select></div>
    <div class="pgrupo"><h3>Idiomas</h3><div class="idiomas">${IDIOMAS.map(([k,l])=>`<label>${l}<select data-idioma="${k}"><option value="">No</option>${["A1","A2","B1","B2","C1","C2"].map(n=>`<option ${idi[k]===n?"selected":""}>${n}</option>`).join("")}</select></label>`).join("")}</div></div>
    <div class="pgrupo"><h3>¿Qué te interesa?</h3><div class="intereses">${SECTORES.filter(x=>x.k!=="otros").map(x=>`<label><input type="checkbox" data-interes="${x.k}" ${int.includes(x.k)?"checked":""}> ${ICONO[x.k]||""} ${esc(x.n)}</label>`).join("")}</div></div>
    <div class="pform">
      <label>${t("Edad")}<input data-pf="edad" type="number" inputmode="numeric" min="14" max="80" value="${p.edad??""}"></label>
      <label>${t("Nacionalidad")}<select data-pf="nacionalidad"><option value="es" ${p.nacionalidad!=="ue"&&p.nacionalidad!=="otra"?"selected":""}>${t("Española")}</option><option value="ue" ${p.nacionalidad==="ue"?"selected":""}>${t("De otro país de la UE")}</option><option value="otra" ${p.nacionalidad==="otra"?"selected":""}>${t("De fuera de la UE")}</option></select></label>
    </div>
    <div class="docs"><span class="mini-l">${t("Carné de conducir")}</span>${["A","A2","B","C","D","BTP"].map(c=>`<label><input type="checkbox" data-carne="${c}" ${carne.includes(c)?"checked":""}> ${c}</label>`).join("")}</div>
    <label class="encaja"><input type="checkbox" id="soloPerfil" ${S.solo?"checked":""} ${p.nivel==null?"disabled":""}><span>Mostrar solo las plazas que encajan con mi perfil<small>Oculta las que piden estudios, idiomas o carnés que no tienes y, si marcas intereses, las de otros sectores.</small></span></label>`;
}
function guardarPerfil(){
  const p={...(S.perfil||{})};
  for(const el of document.querySelectorAll("#perfilBody [data-pf]")){const v=el.value;if(v===""){delete p[el.dataset.pf];continue}p[el.dataset.pf]=["nivel","edad"].includes(el.dataset.pf)?+v:v}
  p.carne=[...document.querySelectorAll("#perfilBody [data-carne]:checked")].map(x=>x.dataset.carne);
  p.idiomas=Object.fromEntries([...document.querySelectorAll("#perfilBody [data-idioma]")].filter(x=>x.value).map(x=>[x.dataset.idioma,x.value]));
  p.intereses=[...document.querySelectorAll("#perfilBody [data-interes]:checked")].map(x=>x.dataset.interes);
  delete p.catalan;
  if(p.prefs)p.prefs={...p.prefs,intereses:p.intereses};
  S.perfil=p;ls.set("rp_perfil",JSON.stringify(p));
  if(S.ses)api("/cuenta",{method:"PATCH",body:JSON.stringify({perfil:p})}).catch(()=>{});
  render();renderPerfil();
}
function renderCuenta(){
  const box=$("cuentaBox"),btn=$("btnCuenta");
  btn.textContent=S.yo?(S.yo.nombre||S.yo.email.split("@")[0]):t("Entrar");btn.classList.toggle("in",!!S.yo);
  box.hidden=!S.yo;if(!S.yo)return;
  const y=S.yo,ad=S.adm;
  const cal=y.calendario?`<p class="note">📅 Tus plazas en el calendario del móvil: <a href="${esc(y.calendario.replace(/^https:/,"webcal:"))}">Suscribirme</a> · <button type="button" class="linkish" data-copiar="${esc(y.calendario)}">Copiar enlace</button></p>`:`<button type="button" id="crearCal">📅 Ver mis plazas en el calendario del móvil</button>`;
  const tg=y.telegram_url?(y.telegram?`<p class="note">✅ Telegram conectado. <button type="button" class="linkish" id="tgOff">Desconectar</button></p>`:`<a class="tgbtn" href="${esc(y.telegram_url)}" target="_blank" rel="noopener">✈️ Recibir avisos por Telegram</a>`):"";
  const vias=["correo",y.google?"Google":"",y.apple?"Apple":""].filter(Boolean).join(", ");
  $("cuentaBody").innerHTML=`<form id="fNombre" class="add nombre"><label for="nombreIn">Cómo quieres que te saludemos</label><input id="nombreIn" maxlength="40" autocomplete="given-name" placeholder="Tu nombre" value="${esc(y.nombre||"")}"><button type="submit">Guardar</button></form>
    <p class="note">Has entrado como <b>${esc(y.email)}</b> · ${y.admin?"administración":"cuenta gratuita"} · puedes entrar con ${esc(vias)}. Tus filtros, perfil, alertas, plazas seguidas y la conversación con el tutor se sincronizan en todos tus dispositivos.</p>
    <label class="check"><input type="checkbox" id="avisosEmail" ${y.avisos_email?"checked":""}><span>Recibir por correo las plazas nuevas de mis alertas, los cambios en las que sigo y el aviso 3 días antes de que cierren</span></label>
    <label class="mini-l">Frecuencia de las alertas <select id="frecuencia"><option value="diaria" ${y.frecuencia!=="semanal"?"selected":""}>Cada día que haya novedades</option><option value="semanal" ${y.frecuencia==="semanal"?"selected":""}>Resumen semanal (lunes)</option></select></label>
    <label class="check"><input type="checkbox" id="boletin" ${y.boletin?"checked":""}><span>Boletín semanal con las plazas destacadas de toda España</span></label>
    <div class="acts">${tg}${cal}</div>
    <div class="acts"><button type="button" id="misDatos">Descargar mis datos</button><button type="button" id="salir">Cerrar sesión</button><button type="button" class="peligro" id="borrarCuenta">${S.borrarCuenta?"Toca otra vez para borrarlo todo":"Borrar mi cuenta"}</button></div>
    <p class="note">Borrar la cuenta elimina al momento tus alertas, marcas, notas y correo. ¿Dudas? <a href="contacto.html">Escríbenos</a>.</p>
    ${y.admin?"":`<button type="button" class="linkish" id="soyAdmin" style="opacity:.6">Tengo una clave de administración</button>`}
    ${ad?`<div class="adm"><h3>Administración</h3><div class="nums"><span><b>${ad.usuarios}</b>usuarios</span><span><b>${ad.nuevos7}</b>nuevos esta semana</span><span><b>${ad.alertas}</b>alertas activas</span><span><b>${ad.sinLeer}</b>mensajes sin leer</span></div>
      ${ad.correo?"":`<p class="note">⚠️ El envío de correos aún no está activado (falta RESEND_API_KEY).</p>`}
      ${ad.ia?"":`<p class="note">⚠️ La IA no está activada en este despliegue.</p>`}
      ${ad.telegram?`<button type="button" class="linkish" id="tgWebhook">Activar el bot de Telegram (webhook)</button>`:`<p class="note">Telegram: falta el secreto TELEGRAM_BOT_TOKEN.</p>`}
      ${(ad.mensajes||[]).slice(0,10).map(m=>`<div class="msg ${m.leido?"":"nuevo"}"><small>${esc(new Date(m.fecha).toLocaleString("es-ES",{dateStyle:"short",timeStyle:"short"}))} · ${esc(m.nombre||"")} &lt;<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>&gt;</small><div style="white-space:pre-wrap">${esc(m.mensaje)}</div></div>`).join("")}
      ${ad.sinLeer?`<button type="button" class="linkish" id="leidos">Marcar mensajes como leídos</button>`:""}</div>`:""}`;
}
function abrirAcceso(motivo){
  const f=$("acceso");f.hidden=false;
  if(motivo)$("accesoMotivo").textContent=motivo;
  $("accesoErr").textContent="";
  f.scrollIntoView({behavior:"smooth",block:"start"});
  setTimeout(()=>($("fCodigo").hidden?$("email"):$("codigo")).focus({preventScroll:true}),300);
}
async function marcar(o,next,extra={}){
  if(!S.ses){ls.set("rp_pend",o.id);abrirAcceso("Crea tu cuenta gratis para seguir plazas: etapas, documentos, notas y aviso antes de que cierren.");return false}
  S.busy.add(o.id);
  try{await api(`/ofertas/${encodeURIComponent(o.id)}`,{method:"PATCH",body:JSON.stringify({marca:next,...extra})});o.marca=next;Object.assign(o,extra);window.dispatchEvent(new Event("radar:marca"));return true}
  catch(err){toast(err.message||"No se pudo guardar. Inténtalo de nuevo.");return false}
  finally{S.busy.delete(o.id)}
}
async function compartir(o){
  const url=(API||location.origin)+(o.ruta||"/");
  if(navigator.share){try{await navigator.share({title:o.titulo,text:o.titulo,url});return}catch(_){return}}
  try{await navigator.clipboard.writeText(url);toast("Enlace copiado")}catch(_){window.open("https://wa.me/?text="+encodeURIComponent(o.titulo+" "+url),"_blank")}
}

// ---------- Eventos ----------
document.addEventListener("click",async e=>{
  const tg=e.target.closest("button");if(!tg)return;
  if(tg.id==="lang"){LANG=LANG==="ca"?"es":"ca";ls.set("rp_lang",LANG);marcarCambio();renderSaludo();traducirEstatico();render();renderCrit();renderCuenta();renderPerfil();return}
  if(tg.id==="btnCuenta"){if(S.yo){const c=$("cuentaBox");c.open=true;c.scrollIntoView({behavior:"smooth"})}else abrirAcceso();return}
  if(tg.dataset.acceso){abrirAcceso("Crea tu cuenta gratis para recibir alertas por correo. Te enviamos un código de 6 cifras, sin contraseñas.");return}
  if(tg.id==="accesoX"){$("acceso").hidden=true;return}
  if(tg.id==="otroEmail"){$("fCodigo").hidden=true;$("fEmail").hidden=false;$("accesoErr").textContent="";$("email").focus();return}
  if(tg.dataset.irPerfil!==undefined){const d=$("perfil");d.open=true;d.scrollIntoView({behavior:"smooth",block:"start"});return}
  if(tg.dataset.soloPerfil!==undefined){S.solo=true;guardarFiltros();render();renderPerfil();toast("Ahora ves solo las plazas que encajan contigo");return}
  if(tg.dataset.cerrarAviso!==undefined){try{sessionStorage.setItem("rp_avp","1")}catch(_){}$("avisoPerfil").hidden=true;return}
  if(tg.id==="verMas"){S.mostrar=(S.mostrar||60)+60;render();return}
  if(tg.dataset.mapa){cambiarMapa(tg.dataset.mapa);return}
  if(tg.id==="salir"){try{await api("/auth/logout",{method:"POST"})}catch(_){}cerrarSesion();toast("Sesión cerrada");return}
  if(tg.id==="borrarCuenta"){if(!S.borrarCuenta){S.borrarCuenta=true;renderCuenta();return}
    try{await api("/cuenta",{method:"DELETE"});cerrarSesion();toast("Cuenta borrada")}catch(err){toast(err.message)}S.borrarCuenta=false;return}
  if(tg.id==="misDatos"){try{const r=await fetch(`${API}/api/cuenta/datos`,{headers:{Authorization:`Bearer ${S.ses}`}});const blob=await r.blob();
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="radar-plazas-mis-datos.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}catch(err){toast("No se pudo descargar")}return}
  if(tg.id==="leidos"){try{await api("/admin/leidos",{method:"POST"});S.adm=await api("/admin/resumen");renderCuenta()}catch(err){toast(err.message)}return}
  if(tg.id==="tgWebhook"){try{const r=await api("/admin/telegram",{method:"POST"});toast(r.ok?"Bot de Telegram activado":"Telegram: "+(r.description||"error"))}catch(err){toast(err.message)}return}
  if(tg.id==="tgOff"){try{await api("/cuenta",{method:"PATCH",body:JSON.stringify({telegram:false})});S.yo.telegram=false;renderCuenta();toast("Telegram desconectado")}catch(err){toast(err.message)}return}
  if(tg.id==="crearCal"){try{const r=await api("/cuenta/calendario",{method:"POST"});S.yo.calendario=r.url;renderCuenta();location.href=r.url.replace(/^https:/,"webcal:")}catch(err){toast(err.message)}return}
  if(tg.dataset.copiar){try{await navigator.clipboard.writeText(tg.dataset.copiar);toast("Enlace copiado")}catch(_){prompt("Copia el enlace",tg.dataset.copiar)}return}
  if(tg.id==="soyAdmin"){const clave=prompt("Clave de administración");if(!clave)return;
    try{await api("/cuenta/admin",{method:"POST",body:JSON.stringify({clave:clave.trim()})});toast("Ahora eres administrador");await cargar()}catch(err){toast(err.message)}return}
  if(tg.dataset.tab){S.tab=tg.dataset.tab;S.mostrar=0;ls.set("rp_tab",S.tab);marcarCambio();render();return}
  if(tg.dataset.etapa!==undefined&&tg.closest("#etapas")){S.etapa=tg.dataset.etapa;render();return}
  if(tg.dataset.sec!==undefined){S.sec=S.sec===tg.dataset.sec?"":tg.dataset.sec;S.subs=[];S.mostrar=0;guardarFiltros();render();return}
  if(tg.dataset.sub){const v=tg.dataset.sub;S.subs=S.subs.includes(v)?S.subs.filter(x=>x!==v):[...S.subs,v];guardarFiltros();render();return}
  if(tg.dataset.dif){const v=+tg.dataset.dif;S.dif=S.dif.includes(v)?S.dif.filter(x=>x!==v):[...S.dif,v];guardarFiltros();render();return}
  if(tg.dataset.grp){const v=tg.dataset.grp;S.grp=S.grp.includes(v)?S.grp.filter(x=>x!==v):[...S.grp,v];guardarFiltros();render();return}
  if(tg.id==="fclear"){S.dif=[];S.grp=[];S.place=null;S.sec="";S.subs=[];S.niv=null;S.solo=false;guardarFiltros();setVB({...FULL});render();return}
  if(tg.dataset.zoom){
    const z=tg.dataset.zoom;
    if(z==="in")zoomAt(0.6);else if(z==="out")zoomAt(1/0.6);else if(z==="all")setVB({...FULL});else zoomProv(+z);
    if(z!=="in"&&z!=="out")for(const b of document.querySelectorAll("#zooms [data-zoom]"))if(b.dataset.zoom!=="in"&&b.dataset.zoom!=="out")b.setAttribute("aria-pressed",String(b===tg));
    return}
  if(tg.id==="toda"){S.sel={kind:"toda"};drawPins();renderInfo();return}
  if(tg.id==="fuera"){cambiarMapa("es");return}
  if(tg.dataset.place){
    if(tg.dataset.place==="clear")S.place=null;
    else if(S.sel&&S.sel.kind!=="toda")S.place={kind:S.sel.kind,id:S.sel.id};
    guardarFiltros();render();
    if(S.place)$("list").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
    return}
  if(tg.dataset.share){const o=S.ofertas.find(x=>x.id===tg.dataset.share);if(o)compartir(o);return}
  if(tg.dataset.marca){
    const o=S.ofertas.find(x=>x.id===tg.dataset.id);if(!o||S.busy.has(o.id))return;
    const quiere=tg.dataset.marca, actual=o.marca||"nueva";
    const next=quiere==="interesa"?(SEGUIMIENTO.has(actual)?"visto":"interesa"):(actual==="descartada"?"visto":"descartada");
    render();
    if(await marcar(o,next)){if(next==="interesa")S.abiertos.add(o.id);toast({interesa:"Guardada en Mis candidaturas: te avisaremos antes de que cierre",descartada:"Descartada",visto:"Marca quitada"}[next])}
    render();return}
  if(tg.dataset.alOn){const a=S.alertas.find(x=>x.id===tg.dataset.alOn);if(!a)return;
    try{await api(`/alertas/${a.id}`,{method:"PUT",body:JSON.stringify({activa:!a.activa})});a.activa=a.activa?0:1;toast(a.activa?"Alerta activada":"Alerta pausada")}catch(err){toast(err.message)}
    renderCrit();return}
  if(tg.dataset.alDel){const id=tg.dataset.alDel;
    if(S.borrando!==id){S.borrando=id;renderCrit();return}
    try{await api(`/alertas/${id}`,{method:"DELETE"});S.alertas=S.alertas.filter(x=>x.id!==id);toast("Alerta borrada")}catch(err){toast(err.message)}
    S.borrando=null;renderCrit();return}
});
document.addEventListener("toggle",e=>{const d=e.target;if(d.dataset?.segui){d.open?S.abiertos.add(d.dataset.segui):S.abiertos.delete(d.dataset.segui)}},true);
document.addEventListener("change",async e=>{
  const el=e.target;
  if(el.id==="fniv"){S.niv=el.value===""?null:+el.value;guardarFiltros();render();return}
  if(el.id==="soloCumplo"){S.solo=el.checked;if(S.solo&&S.perfil?.nivel==null){$("perfil").open=true;$("perfil").scrollIntoView({behavior:"smooth"});toast("Primero rellena tu perfil")}guardarFiltros();render();return}
  if(el.closest&&el.closest("#perfilBody")&&(el.dataset.pf!==undefined||el.dataset.carne||el.dataset.idioma||el.dataset.interes)){guardarPerfil();toast("Perfil guardado");return}
  if(el.id==="soloPerfil"){S.solo=el.checked;guardarFiltros();render();toast(S.solo?"Ahora ves solo las plazas que encajan contigo":"Ves todas las plazas");return}
  if(el.dataset.etapaDe){const o=S.ofertas.find(x=>x.id===el.dataset.etapaDe);if(o&&await marcar(o,el.value)){S.abiertos.add(o.id);toast("Etapa: "+ETAPAS.find(x=>x[0]===el.value)[1]);render()}return}
  if(el.dataset.doc){const o=S.ofertas.find(x=>x.id===el.dataset.de);if(!o)return;const docs={...(o.docs||{}),[el.dataset.doc]:el.checked};
    if(await marcar(o,o.marca,{docs}))S.abiertos.add(o.id);return}
  if(el.dataset.notas){const o=S.ofertas.find(x=>x.id===el.dataset.notas);if(!o||o.notas===el.value)return;if(await marcar(o,o.marca,{notas:el.value}))toast("Nota guardada");return}
  if(el.id==="avisosEmail"){const v=el.checked;try{await api("/cuenta",{method:"PATCH",body:JSON.stringify({avisos_email:v})});S.yo.avisos_email=v;toast(v?"Avisos por correo activados":"Avisos por correo desactivados");renderCrit()}catch(err){el.checked=!v;toast(err.message)}return}
  if(el.id==="frecuencia"){try{await api("/cuenta",{method:"PATCH",body:JSON.stringify({frecuencia:el.value})});S.yo.frecuencia=el.value;toast(el.value==="semanal"?"Recibirás un resumen cada lunes":"Recibirás los avisos cada día");renderCrit()}catch(err){toast(err.message)}return}
  if(el.id==="boletin"){try{await api("/cuenta",{method:"PATCH",body:JSON.stringify({boletin:el.checked})});S.yo.boletin=el.checked;toast(el.checked?"Suscrito al boletín semanal":"Baja del boletín")}catch(err){toast(err.message)}return}
});
document.addEventListener("submit",async e=>{
  if(e.target.id==="fEmail"){e.preventDefault();const email=$("email").value.trim(),btn=e.target.querySelector("button");btn.disabled=true;$("accesoErr").textContent="";
    try{const r=await api("/auth/start",{method:"POST",body:JSON.stringify({email})});S.email=email;S.nuevo=!!r.nuevo;
      $("emailVis").textContent=email;$("aceptaBox").hidden=!S.nuevo;$("fEmail").hidden=true;$("fCodigo").hidden=false;$("codigo").value="";$("codigo").focus()}
    catch(err){$("accesoErr").textContent=err.message}finally{btn.disabled=false}return}
  if(e.target.id==="fCodigo"){e.preventDefault();const code=$("codigo").value.replace(/\D/g,"");$("accesoErr").textContent="";
    if(S.nuevo&&!$("acepta").checked){$("accesoErr").textContent="Para crear la cuenta, marca que aceptas las condiciones y la privacidad.";return}
    const clave=ls.get("rp_key","");
    try{const r=await api("/auth/verify",{method:"POST",body:JSON.stringify({email:S.email,code,acepta:$("acepta").checked,...(clave?{clave}:{})})});
      $("fCodigo").hidden=true;$("fEmail").hidden=false;await trasEntrar(r)}
    catch(err){if(err.acepta===false)$("aceptaBox").hidden=false;$("accesoErr").textContent=err.message}return}
  if(e.target.id==="nuevaAlerta"){e.preventDefault();const nombre=$("nombreAlerta").value.trim();if(!nombre)return;
    try{await api("/alertas",{method:"POST",body:JSON.stringify({nombre,filtros:filtrosActuales()})});toast("Alerta creada");S.alertas=await api("/alertas");S.yo&&(S.yo.alertas=S.alertas.length)}catch(err){toast(err.message)}
    renderCrit()}
});

// ---------- Servidor ----------
async function api(path,init={}){
  const h={"Content-Type":"application/json",...(init.headers||{})};if(S.ses)h.Authorization=`Bearer ${S.ses}`;
  const r=await fetch(`${API}/api${path}`,{...init,headers:h});
  const b=await r.json().catch(()=>({}));
  if(r.status===401&&b.sesion===false&&S.ses&&!path.startsWith("/auth/")){cerrarSesion();toast("Tu sesión ha caducado. Vuelve a entrar.")}
  if(!r.ok){const er=new Error(b.error||`Error ${r.status}`);Object.assign(er,b);throw er}
  return b;
}
function cerrarSesion(){S.ses="";S.yo=null;S.adm=null;S.alertas=null;ls.del("rp_ses");renderSaludo();
  for(const o of S.ofertas)o.marca="nueva";render();renderCrit();renderCuenta();cargar()}
function adaptar(o){
  const cat=o.comunidad==="Cataluña";
  return {...o,ens:o.organismo||o.fuente,tramiteUrl:o.tramite_url,terminiFecha:o.plazo_fin,terminiTexto:o.plazo_texto,
    zona:o.municipio||(cat?"Toda Cataluña":o.provincia||o.comunidad),
    sistema:SISTEMA[o.sistema]||o.sistema||"",tipoPersonal:o.interino?"Interino / bolsa":""};
}
async function cargar(){
  try{
    const [o,e]=await Promise.all([api("/ofertas"),api("/estado")]);
    S.loaded=true;S.ofertas=o.items.map(adaptar);S.meta=e.ultima_ejecucion;
    try{ls.set("rp_cache",JSON.stringify({t:Date.now(),items:o.items.slice(0,800),meta:e.ultima_ejecucion}))}catch(_){}
    if(S.ses){
      const [a,y]=await Promise.all([api("/alertas"),api("/cuenta")]);S.alertas=a;S.yo=y;sincronizar(y.ajustes);
      if(y.perfil&&(!S.perfil||JSON.stringify(y.perfil)!==JSON.stringify(S.perfil))){S.perfil=y.perfil;ls.set("rp_perfil",JSON.stringify(y.perfil));renderPerfil()}
      else if(!y.perfil&&S.perfil)api("/cuenta",{method:"PATCH",body:JSON.stringify({perfil:S.perfil})}).catch(()=>{});
      S.adm=y.admin?await api("/admin/resumen").catch(()=>null):null;
    }
    render();renderCrit();renderCuenta();renderSaludo();
    window.dispatchEvent(new Event("radar:cargado"));
  }catch(err){
    // Sin conexión: lo último que se cargó en este dispositivo
    const c=JSON.parse(ls.get("rp_cache","null")||"null");
    if(c&&!S.ofertas.length){S.ofertas=c.items.map(adaptar);S.meta=c.meta;S.loaded=true;render();$("lastrun").textContent=`Sin conexión: mostrando lo guardado el ${new Date(c.t).toLocaleString("es-ES",{dateStyle:"short",timeStyle:"short"})}`}
    else $("lastrun").textContent=`No se pudieron cargar las plazas: ${err.message}`;
  }
}
async function seguirPendiente(){
  const id=ls.get("rp_pend","");if(!id||!S.ses)return;ls.del("rp_pend");
  const o=S.ofertas.find(x=>x.id===id);if(o&&await marcar(o,"interesa")){S.tab="mias";S.abiertos.add(o.id);render();toast("Plaza guardada en Mis candidaturas")}
}
// Enlaces desde otras páginas: ?seguir=id, ?entrar=1, ?sector=…, ?lugar=…
function leerUrl(){
  const q=new URLSearchParams(location.search);let cambio=false;
  if(q.get("sector")){const k=q.get("sector");if(SUBN[k]){S.sec=SUBN[k].s;S.subs=[k]}else if(SECT[k]){S.sec=k;S.subs=[]}cambio=true}
  if(q.get("lugar")){const l=q.get("lugar");S.place=COMUNIDADES.includes(l)?{kind:"ccaa",id:l}:{kind:"provES",id:l};if(S.place.id!=="Cataluña")S.mapa="es";cambio=true}
  if(cambio){S.tab="todas";guardarFiltros();setTimeout(()=>{$("crit").open=true;$("crit").scrollIntoView({behavior:"smooth"})},600)}
  if(q.get("seguir"))ls.set("rp_pend",q.get("seguir"));
  if(q.get("entrar")||(q.get("seguir")&&!S.ses))setTimeout(()=>abrirAcceso(q.get("seguir")?"Entra o crea tu cuenta gratis para seguir esta plaza.":null),400);
  if(location.hash==="#perfil")setTimeout(()=>{$("perfil").open=true;$("perfil").scrollIntoView({behavior:"smooth"})},400);
  if([...q.keys()].length)try{history.replaceState(null,"",location.pathname+location.hash)}catch(_){}
}

leerUrl();traducirEstatico();renderPerfil();render();renderCrit();renderCuenta();iniciarMapa3D();
cargar().then(seguirPendiente);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)cargar()});
setInterval(()=>{if(!document.hidden)cargar()},5*60_000);
if("serviceWorker" in navigator&&/^https?:$/.test(location.protocol)&&!window.RADAR_API)navigator.serviceWorker.register("/sw.js").catch(()=>{});

// ---------- Mapa 3D ----------
function coordDe(o){
  if(!o.comunidad||o.comunidad==="Cataluña"){const m=muniDe(o);const c=m&&window.MAPA_DATOS&&MAPA_DATOS.munisCat[m.nom];return c?{nom:m.nom,cat:true,lon:c[0],lat:c[1]}:null}
  if(o.lat&&o.lon&&o.municipio)return {nom:o.municipio,cat:false,lon:o.lon,lat:o.lat};
  return null;
}
function coordDeNombre(nom,cat){
  if(cat){const c=window.MAPA_DATOS&&MAPA_DATOS.munisCat[nom];return c?{lon:c[0],lat:c[1]}:null}
  const o=S.ofertas.find(x=>x.municipio===nom&&x.lat&&x.lon);return o?{lon:o.lon,lat:o.lat}:null;
}
function provDe(o){if(o.provincia)return o.provincia;const m=(!o.comunidad||o.comunidad==="Cataluña")&&muniDe(o);return m?PROV_NOM[m.prov]:null}
function usarClasico(motivo){
  S.clasico=true;S.m3=false;$("hero").classList.add("plano");$("mapaClasico").hidden=false;
  const av=$("m3aviso");av.hidden=false;av.textContent=motivo||"Tu dispositivo no puede mostrar el mapa 3D: abajo tienes el mapa plano.";
  if(!$("map").firstChild)initMap();cambiarMapa(S.mapa);render();
}
async function iniciarMapa3D(){
  if(!window.Mapa3D||!Mapa3D.soporta()){usarClasico();return}
  for(const b of document.querySelectorAll("[data-m3modo]"))b.setAttribute("aria-pressed",String(b.dataset.m3modo===Mapa3D.modo()));
  try{
    await Mapa3D.iniciar({contenedor:$("mapa3d"),leyenda:$("leyenda3"),provDe,coordDe,coordDeNombre,diasDe:daysLeft,
      margenArriba:()=>{const u=$("mapaUi");return u?u.offsetHeight:0},
      alElegir(p){S.place=p;S.mostrar=0;guardarFiltros();render();Mapa3D.enfocar(S.place)}});
    S.m3=true;render();if(S.place)Mapa3D.enfocar(S.place);
  }catch(e){usarClasico("No se ha podido cargar el mapa 3D: abajo tienes el mapa plano.")}
}
document.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.m3modo){Mapa3D.modo(b.dataset.m3modo);for(const x of document.querySelectorAll("[data-m3modo]"))x.setAttribute("aria-pressed",String(x===b));return}
  if(b.dataset.volar){const v=b.dataset.volar;
    if(v==="España"){S.place=null}else if(v!=="Canarias"&&v!=="Baleares"&&COMUNIDADES.includes(v))S.place={kind:"ccaa",id:v};
    else if(v==="Canarias"||v==="Baleares")S.place={kind:"ccaa",id:v};
    if(S.m3){const m=S.place?"provincias":"comunidades";Mapa3D.modo(m);for(const x of document.querySelectorAll("[data-m3modo]"))x.setAttribute("aria-pressed",String(x.dataset.m3modo===m))}
    guardarFiltros();render();if(S.m3)Mapa3D.enfocar(S.place);
    for(const x of document.querySelectorAll("[data-volar]"))x.setAttribute("aria-pressed",String(x===b&&v!=="España"));return}
  if(b.id==="m3ver"){$("barra").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});return}
  if(b.id==="m3quitar"){S.place=null;guardarFiltros();render();if(S.m3){Mapa3D.modo("comunidades");for(const x of document.querySelectorAll("[data-m3modo]"))x.setAttribute("aria-pressed",String(x.dataset.m3modo==="comunidades"));Mapa3D.enfocar(null)}for(const x of document.querySelectorAll("[data-volar]"))x.setAttribute("aria-pressed","false");return}
  if(b.id==="verFiltros"||b.id==="cerrarFiltros"){const f=$("filtros"),abrir=b.id==="verFiltros"&&f.hidden;f.hidden=!abrir;$("verFiltros").setAttribute("aria-expanded",String(abrir));if(abrir)f.scrollIntoView({behavior:"smooth",block:"nearest"});return}
  if(b.dataset.quitar){const k=b.dataset.quitar;
    if(k==="q"){S.q="";$("q").value=""}else if(k==="place"){S.place=null;if(S.m3)Mapa3D.enfocar(null)}else if(k==="sec"){S.sec="";S.subs=[]}else if(k==="niv")S.niv=null;else if(k==="solo")S.solo=false;
    else if(k.startsWith("sub:"))S.subs=S.subs.filter(x=>x!==k.slice(4));else if(k.startsWith("dif:"))S.dif=S.dif.filter(x=>x!==+k.slice(4));else if(k.startsWith("grp:"))S.grp=S.grp.filter(x=>x!==k.slice(4));
    guardarFiltros();render();return}
});
let tq=null;

// ---------- Cerca de mí y código postal ----------
S.km=+ls.get("rp_km","25")||25;
function km(a,b){const R=6371,r=Math.PI/180,dLa=(b[1]-a[1])*r,dLo=(b[0]-a[0])*r;const h=Math.sin(dLa/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function coordOferta(o){
  if(o.comunidad==="Estatal")return null;
  if(o.lat&&o.lon){o._aprox=false;return [o.lon,o.lat]}
  const c=coordDe(o);if(c){o._aprox=false;return [c.lon,c.lat]}
  const p=provDe(o),cc=p&&window.MAPA_DATOS&&Object.entries(MAPA_DATOS.centros).find(([n])=>normTxt(n)===normTxt(p));
  if(cc){o._aprox=true;return cc[1]}
  return null;
}
function distOferta(o){
  const p=S.place;if(!p||p.kind!=="cerca")return null;
  const k=p.lat+","+p.lon;if(o._dk===k)return o._d;
  const c=coordOferta(o);o._dk=k;o._d=c?km(c,[p.lon,p.lat]):null;return o._d;
}
function cargarDatosMapa(){return window.MAPA_DATOS?Promise.resolve():new Promise(ok=>{const sc=document.createElement("script");sc.src="mapa-datos.js";sc.onload=ok;sc.onerror=ok;document.head.appendChild(sc)})}
async function ponerCerca(lat,lon,etiqueta){
  await cargarDatosMapa();
  S.place={kind:"cerca",id:etiqueta,lat,lon,km:S.km};S.mostrar=0;
  if(S.tab==="nuevas")S.tab="todas";
  guardarFiltros();render();if(S.m3)Mapa3D.enfocar(S.place);
  const n=S.mapRows.filter(lugarActivo).length;
  toast(`${n} ${n===1?"plaza":"plazas"} a menos de ${S.km} km de ${etiqueta}`);
}
async function buscarCP(cp){
  try{const r=await api(`/cp/${cp}`);if(r.lat==null)throw new Error("No hemos encontrado ese código postal");
    await ponerCerca(r.lat,r.lon,`CP ${cp}${r.lugar?" ("+r.lugar+")":""}`);return r}
  catch(err){toast(err.message);return null}
}
function geolocalizar(){
  if(!navigator.geolocation){toast("Tu navegador no permite saber tu ubicación. Prueba con tu código postal.");return}
  toast("Buscando tu ubicación…");
  navigator.geolocation.getCurrentPosition(p=>ponerCerca(+p.coords.latitude.toFixed(4),+p.coords.longitude.toFixed(4),"tu ubicación"),
    e=>toast(e.code===1?"Sin permiso de ubicación. Puedes escribir tu código postal.":"No hemos podido saber tu ubicación. Prueba con tu código postal."),
    {enableHighAccuracy:false,timeout:12000,maximumAge:600000});
}
document.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.id==="cercaMi"||b.id==="cercaMi2")geolocalizar();
});
$("cpIn").addEventListener("input",e=>{const v=e.target.value.replace(/\D/g,"");e.target.value=v;if(v.length===5)buscarCP(v)});
$("kmSel").value=String(S.km);
$("kmSel").addEventListener("change",e=>{S.km=+e.target.value;ls.set("rp_km",String(S.km));marcarCambio();if(S.place?.kind==="cerca"){S.place.km=S.km;guardarFiltros();render();if(S.m3)Mapa3D.enfocar(S.place)}});

if(S.place?.kind==="cerca")cargarDatosMapa().then(()=>render());

// ---------- Tutor ----------
const ESTILOS=["En la calle","En una oficina","Atendiendo a personas","Con las manos","Con tecnología","Cuidando de otros","Conduciendo","Con horario fijo"];
const SUGERENCIAS=["¿Por dónde empiezo?","Quiero trabajar cuanto antes","¿Qué oposición me conviene preparar?","¿Qué hay cerca de casa?","¿Qué estudios me abrirían más puertas?"];
S.chat=JSON.parse((()=>{try{return sessionStorage.getItem("rp_chat")}catch(_){return null}})()||"[]");
function guardarChat(){try{sessionStorage.setItem("rp_chat",JSON.stringify(S.chat.slice(-20)))}catch(_){}marcarCambio()}
function md(t){
  let h=esc(t).replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>")
    .replace(/\[([^\]]+)\]\((\/[^)\s]+|https:\/\/radaropos\.com[^)\s]*)\)/g,(m,txt,u)=>`<a href="${u.startsWith("/")?API+u:u}">${txt}</a>`);
  const out=[];let lista=[];
  for(const l of h.split(/\n+/)){const m=l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)/);if(m){lista.push(`<li>${m[1]}</li>`);continue}
    if(lista.length){out.push(`<ul>${lista.join("")}</ul>`);lista=[]}if(l.trim())out.push(`<p>${l}</p>`)}
  if(lista.length)out.push(`<ul>${lista.join("")}</ul>`);
  return out.join("");
}
function renderTutor(estado){
  const box=$("tutorBody"),form=$("tutorForm");
  if(!S.ses){form.hidden=true;box.innerHTML=`<div class="cta"><p>El tutor mira tus estudios, lo que te gusta, cuánto tiempo puedes estudiar y dónde vives, y te propone por dónde empezar con plazas reales abiertas ahora.</p><button type="button" class="linkbtn" data-acceso="tutor">Entrar gratis para usarlo</button></div>`;return}
  if(estado==="cuestionario"||!S.perfil?.prefs){form.hidden=true;const p=S.perfil||{},pr=p.prefs||{};
    box.innerHTML=`<form class="cuest" id="cuest">
      <p class="note">Cuéntame un poco de ti. Tardas un minuto y puedes cambiarlo cuando quieras.</p>
      <fieldset><legend>Tus estudios</legend><select name="nivel" required><option value="">Elige…</option>${NIVELES.map((n,i)=>`<option value="${i}" ${p.nivel===i?"selected":""}>${esc(n)}</option>`).join("")}</select></fieldset>
      <fieldset><legend>¿Qué te atrae?</legend><div class="ops">${SECTORES.filter(x=>x.k!=="otros").map(x=>`<label><input type="checkbox" name="intereses" value="${x.k}" ${(p.intereses||pr.intereses||[]).includes(x.k)?"checked":""}> ${ICONO[x.k]||""} ${esc(x.n)}</label>`).join("")}</div></fieldset>
      <fieldset><legend>¿Cómo te gusta trabajar?</legend><div class="ops">${ESTILOS.map(x=>`<label><input type="checkbox" name="estilo" value="${esc(x)}" ${(pr.estilo||[]).includes(x)?"checked":""}> ${esc(x)}</label>`).join("")}</div></fieldset>
      <fieldset><legend>¿Qué buscas ahora?</legend><div class="ops">${[["ya","Trabajar cuanto antes"],["estabilidad","Una plaza fija aunque cueste"],["ambas","Las dos cosas"]].map(([v,l])=>`<label><input type="radio" name="prisa" value="${v}" ${pr.prisa===v?"checked":""} required> ${l}</label>`).join("")}</div></fieldset>
      <fieldset><legend>¿Cuánto puedes estudiar?</legend><select name="horas">${[["0","Nada por ahora"],["5","Menos de 5 h a la semana"],["15","De 5 a 15 h a la semana"],["30","Más de 15 h a la semana"]].map(([v,l])=>`<option value="${v}" ${pr.horas===v?"selected":""}>${l}</option>`).join("")}</select></fieldset>
      <fieldset><legend>¿Dónde vives y hasta dónde te moverías?</legend><div class="cerca"><input type="text" name="cp" inputmode="numeric" maxlength="5" placeholder="Código postal" value="${esc(pr.cp||"")}"><select name="movilidad">${[["15","Mi ciudad (15 km)"],["50","Hasta 50 km"],["comunidad","Mi comunidad"],["toda","Toda España"]].map(([v,l])=>`<option value="${v}" ${pr.movilidad===v?"selected":""}>${l}</option>`).join("")}</select></div></fieldset>
      <button type="submit" class="linkbtn">Guardar y empezar</button>
    </form>`;return}
  form.hidden=false;
  box.innerHTML=(S.chat.length?S.chat.map(m=>`<div class="burbuja ${m.rol==="user"?"yo":"tu"}">${m.rol==="user"?esc(m.texto):md(m.texto)}</div>`).join(""):`<div class="burbuja tu"><p>Hola. Ya tengo tu perfil: dime qué te preocupa o pulsa una de estas preguntas y te propongo un camino con plazas reales.</p></div>`)+
    (estado==="pensando"?`<p class="escribiendo">El tutor está pensando…</p>`:"")+
    `<div class="sugerencias">${SUGERENCIAS.map(x=>`<button type="button" data-sugerencia="${esc(x)}">${esc(x)}</button>`).join("")}<button type="button" data-sugerencia="__gustos">Cambiar mis gustos</button></div>`;
  box.scrollTop=box.scrollHeight;
}
async function preguntarTutor(texto){
  if(!texto.trim()||S.tutorOcupado)return;
  S.chat.push({rol:"user",texto:texto.trim()});guardarChat();S.tutorOcupado=true;renderTutor("pensando");
  try{const r=await api("/ia/tutor",{method:"POST",body:JSON.stringify({mensajes:S.chat.slice(-8),perfil:S.perfil})});S.chat.push({rol:"assistant",texto:r.respuesta||"No tengo respuesta ahora mismo."})}
  catch(err){S.chat.push({rol:"assistant",texto:err.message})}
  finally{S.tutorOcupado=false;guardarChat();renderTutor()}
}
function abrirTutor(){$("tutor").hidden=false;$("tutorBtn").hidden=true;renderTutor();setTimeout(()=>($("tutorQ").offsetParent?$("tutorQ"):$("tutorX")).focus(),50)}
function cerrarTutor(){$("tutor").hidden=true;$("tutorBtn").hidden=false;$("tutorBtn").focus()}
document.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.id==="tutorBtn"||b.dataset.abrirTutor!==undefined){abrirTutor();return}
  if(b.id==="tutorX"){cerrarTutor();return}
  if(b.dataset.sugerencia){if(b.dataset.sugerencia==="__gustos")renderTutor("cuestionario");else preguntarTutor(b.dataset.sugerencia);return}
  if(b.dataset.acceso==="tutor")cerrarTutor();
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("tutor").hidden)cerrarTutor()});
document.addEventListener("submit",async e=>{
  if(e.target.id==="tutorForm"){e.preventDefault();const q=$("tutorQ");const v=q.value;q.value="";preguntarTutor(v);return}
  if(e.target.id==="cuest"){e.preventDefault();const f=new FormData(e.target),btn=e.target.querySelector("[type=submit]");btn.disabled=true;
    const prefs={intereses:f.getAll("intereses"),estilo:f.getAll("estilo"),prisa:f.get("prisa"),horas:f.get("horas"),movilidad:f.get("movilidad")};
    const cp=String(f.get("cp")||"").trim();
    if(/^\d{5}$/.test(cp)){try{const r=await api(`/cp/${cp}`);Object.assign(prefs,{cp,lugar:r.lugar||r.provincia,lat:r.lat,lon:r.lon})}catch(_){prefs.cp=cp}}
    S.perfil={...(S.perfil||{}),nivel:+f.get("nivel"),intereses:prefs.intereses,prefs};ls.set("rp_perfil",JSON.stringify(S.perfil));
    try{await api("/cuenta",{method:"PATCH",body:JSON.stringify({perfil:S.perfil})})}catch(_){}
    renderPerfil();render();renderTutor();
    if(!S.chat.length)preguntarTutor("¿Por dónde empiezo?");return}
});
$("tutorQ").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("tutorForm").requestSubmit()}});

// El botón flotante del tutor solo aparece cuando el mapa ya no se ve (así no tapa sus botones)
if("IntersectionObserver" in window)new IntersectionObserver(es=>{for(const e of es)$("tutorBtn").classList.toggle("fuera",e.isIntersecting)},{threshold:0.05}).observe($("hero"));

// ---------- Saludo y bienvenida ----------
function nombreSaludo(){const y=S.yo;if(!y)return "";if(y.nombre)return y.nombre;
  const m=(y.email||"").split("@")[0].replace(/[0-9]+/g,"").replace(/[._-]+/g," ").trim();return m?m.replace(/\b\w/g,c=>c.toUpperCase()).split(" ")[0]:""}
function franja(){const h=new Date().getHours();return h<6?"noche":h<13?"dia":h<20?"tarde":"noche"}
const SALUDOS={es:{dia:"Buenos días",tarde:"Buenas tardes",noche:"Buenas noches"},ca:{dia:"Bon dia",tarde:"Bona tarda",noche:"Bona nit"}};
function novedadesParaTi(){
  const desde=S.vistoPrev||0;if(!desde)return null;
  return S.ofertas.filter(o=>o.encontrada&&Date.parse(o.encontrada)>desde&&(!S.perfil||!window.RadarCumple||(RadarCumple.cumple(o,S.perfil)||{}).estado!=="no")).length;
}
function renderSaludo(){
  const box=$("saludo");if(!box)return;
  $("intro").classList.toggle("sr",!!S.yo);
  if(!S.yo){box.hidden=true;box.innerHTML="";return}
  const n=nombreSaludo(),sal=(SALUDOS[LANG]||SALUDOS.es)[franja()],ca=LANG==="ca";
  if(S.bienvenida){
    box.hidden=false;box.className="saludo bienvenida";
    box.innerHTML=`<button type="button" class="x" id="saludoX" aria-label="Cerrar">✕</button>
      <h2>${ca?"Et donem la benvinguda":"Te damos la bienvenida"}${S.yo.nombre?", "+esc(S.yo.nombre):""} 👋</h2>
      <p>${ca?"Ja tens el teu compte de Radar de Places. Tres passos i et trobem les places que t'encaixen:":"Ya tienes tu cuenta de Radar de Plazas. Tres pasos y te encontramos las plazas que encajan contigo:"}</p>
      ${S.yo.nombre?"":`<form id="fNombre2" class="add"><input id="nombreIn2" maxlength="40" autocomplete="given-name" placeholder="${ca?"Com et dius?":"¿Cómo te llamas?"}" aria-label="${ca?"El teu nom":"Tu nombre"}"><button type="submit">${ca?"Desa":"Guardar"}</button></form>`}
      <ol><li><button type="button" class="linkish" data-ir="perfil">${ca?"Completa el teu perfil":"Completa tu perfil"}</button> · ${ca?"estudis, idiomes i interessos":"estudios, idiomas e intereses"}</li>
      <li><button type="button" class="linkish" data-ir="alertas">${ca?"Crea una alerta":"Crea una alerta"}</button> · ${ca?"t'avisem per correu":"te avisamos por correo"}</li>
      <li><button type="button" class="linkish" data-abrir-tutor>${ca?"Parla amb el tutor IA":"Habla con el tutor IA"}</button> · ${ca?"et guia segons els teus gustos":"te guía según tus gustos"}</li></ol>`;
    return;
  }
  const nov=novedadesParaTi();
  box.hidden=false;box.className="saludo";
  box.innerHTML=`<p class="hola">${sal}${n?", <b>"+esc(n)+"</b>":""} 👋</p>`+
    (nov!=null?`<p class="nov">${nov?`${ca?"Hi ha":"Hay"} <b>${nov}</b> ${nov===1?(ca?"plaça nova":"plaza nueva"):(ca?"places noves":"plazas nuevas")} ${S.perfil?(ca?"per a tu ":"para ti "):""}${ca?"des de la teva última visita":"desde tu última visita"} <button type="button" class="linkish" data-ir="nuevas">${ca?"Veure-les":"Verlas"}</button>`:(ca?"No hi ha places noves des de la teva última visita. Et seguim buscant.":"No hay plazas nuevas desde tu última visita. Seguimos buscando por ti.")}</p>`:"")+
    (S.yo.nombre?"":`<p class="nov"><button type="button" class="linkish" data-ir="nombre">${ca?"Digue'ns com et dius":"Dinos cómo te llamas"}</button></p>`);
}
setInterval(()=>{if(!document.hidden&&S.yo&&!S.bienvenida)renderSaludo()},10*60_000);
async function guardarNombre(v){
  v=String(v||"").trim().slice(0,40);
  try{await api("/cuenta",{method:"PATCH",body:JSON.stringify({nombre:v})});S.yo.nombre=v||null;renderCuenta();renderSaludo();toast(v?`${LANG==="ca"?"Encantats":"Encantados"}, ${v}`:"Nombre borrado")}catch(err){toast(err.message)}
}
document.addEventListener("submit",e=>{
  if(e.target.id==="fNombre"){e.preventDefault();guardarNombre($("nombreIn").value)}
  if(e.target.id==="fNombre2"){e.preventDefault();guardarNombre($("nombreIn2").value)}
});
document.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.id==="saludoX"){S.bienvenida=false;ls.set("rp_bienv","1");marcarCambio();renderSaludo();return}
  const ir=b.dataset.ir;if(!ir)return;
  if(ir==="perfil"){const d=$("perfil");d.open=true;d.scrollIntoView({behavior:"smooth"})}
  else if(ir==="alertas"){const d=$("crit");if(d){d.open=true;d.scrollIntoView({behavior:"smooth"})}}
  else if(ir==="nombre"){const d=$("cuentaBox");d.open=true;d.scrollIntoView({behavior:"smooth"});setTimeout(()=>$("nombreIn")&&$("nombreIn").focus(),400)}
  else if(ir==="nuevas"){S.tab="nuevas";ls.set("rp_tab","nuevas");render();$("barra").scrollIntoView({behavior:"smooth"})}
});

// ---------- Después de entrar (código, Google o Apple) ----------
async function trasEntrar(r){
  S.ses=r.token;ls.set("rp_ses",r.token);if(r.admin)ls.del("rp_key");
  $("acceso").hidden=true;
  S.bienvenida=!!r.nuevo;
  toast(r.nuevo?"Cuenta creada":"Has entrado");
  await cargar();await seguirPendiente();
  renderSaludo();if(r.nuevo)$("saludo").scrollIntoView({behavior:"smooth",block:"center"});
}

// ---------- Entrar con Google o Apple ----------
let OAUTH=null;
function cargarScript(src){return new Promise((ok,ko)=>{if(document.querySelector(`script[src="${src}"]`)){ok();return}const s=document.createElement("script");s.src=src;s.async=true;s.onload=ok;s.onerror=()=>ko(new Error("No se pudo cargar "+src));document.head.appendChild(s)})}
async function prepararSocial(){
  const box=$("accesoSocial");if(!box)return;
  try{OAUTH=OAUTH||await api("/auth/config")}catch(_){return}
  const N=window.RADAR_NATIVO;
  const hayG=N?!!(N.google&&OAUTH.googleIos):!!OAUTH.google, hayA=N?!!N.apple:!!OAUTH.apple;
  if(!hayG&&!hayA)return;
  box.hidden=false;$("appleBtn").hidden=!hayA;
  const g=$("gBtn");
  if(hayG&&N){g.innerHTML=`<button type="button" class="oabtn" id="gNativo"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.2v3.1C3.2 21.3 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.3 14.3c-.5-1.5-.5-3.1 0-4.6V6.6H1.2c-1.6 3.2-1.6 7 0 10.2l4.1-2.5z"/><path fill="#EA4335" d="M12 4.7c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.6l4.1 3.1c.9-2.9 3.6-5 6.7-5z"/></svg>Continuar con Google</button>`;return}
  if(hayG&&!g.dataset.listo){
    try{await cargarScript("https://accounts.google.com/gsi/client");
      google.accounts.id.initialize({client_id:OAUTH.google,callback:r=>entrarSocial("google",r.credential),ux_mode:"popup",itp_support:true,use_fedcm_for_button:true});
      google.accounts.id.renderButton(g,{theme:"outline",size:"large",shape:"pill",text:"continue_with",locale:LANG,width:Math.min(360,g.clientWidth||320)});
      g.dataset.listo="1"}
    catch(_){g.innerHTML=""}
  }
}
async function entrarSocial(prov,token,nombre){
  $("accesoErr").textContent="";
  try{const clave=ls.get("rp_key","");
    const r=await api("/auth/social",{method:"POST",body:JSON.stringify({proveedor:prov,token,nombre,acepta:true,...(clave?{clave}:{})})});
    await trasEntrar(r)}
  catch(err){$("accesoErr").textContent=err.message}
}
async function entrarApple(){
  const N=window.RADAR_NATIVO;
  try{
    if(N&&N.apple){const r=await N.apple();if(r&&r.idToken)entrarSocial("apple",r.idToken,r.nombre);return}
    await cargarScript("https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/es_ES/appleid.auth.js");
    AppleID.auth.init({clientId:OAUTH.apple,scope:"name email",redirectURI:location.origin+"/",usePopup:true});
    const r=await AppleID.auth.signIn();const u=r.user&&r.user.name;
    entrarSocial("apple",r.authorization.id_token,u&&u.firstName);
  }catch(err){if(!/cancel|popup_closed/i.test(String(err&&(err.error||err.message||err))))$("accesoErr").textContent="No se ha podido entrar con Apple. Vuelve a probar."}
}
document.addEventListener("click",async e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.id==="appleBtn"){entrarApple();return}
  if(b.id==="gNativo"){try{const r=await window.RADAR_NATIVO.google();if(r&&r.idToken)entrarSocial("google",r.idToken,r.nombre)}catch(err){if(!/cancel/i.test(String(err&&err.message||err)))$("accesoErr").textContent="No se ha podido entrar con Google. Vuelve a probar."}}
});

// ---------- Sincronización entre dispositivos ----------
// Filtros, distancia, idioma, pestaña y la conversación con el tutor viajan con la cuenta. Gana el cambio más reciente.
var tSync=null;
function marcarCambio(){ls.set("rp_aj_t",String(Date.now()));if(!S.ses)return;clearTimeout(tSync);tSync=setTimeout(subirAjustes,1200)}
function ajustesLocales(){return {t:+ls.get("rp_aj_t","0")||0,f:JSON.parse(ls.get("rp_f","{}")||"{}"),km:S.km,lang:LANG,tab:S.tab,chat:(S.chat||[]).slice(-12),visto:+ls.get("rp_visto","0")||0,bienvenida:ls.get("rp_bienv","")==="1"}}
async function subirAjustes(){
  if(!S.ses)return;const a=ajustesLocales();if(!a.t)a.t=Date.now();
  try{const r=await api("/cuenta",{method:"PATCH",body:JSON.stringify({ajustes:a})});if(r.ajustes)aplicarAjustes(r.ajustes)}catch(_){}
}
function aplicarAjustes(a){
  ls.set("rp_aj_t",String(a.t||0));
  if(a.f){ls.set("rp_f",JSON.stringify(a.f));leerFiltros(a.f)}
  if(a.km){S.km=+a.km||25;ls.set("rp_km",String(S.km));if($("kmSel"))$("kmSel").value=String(S.km)}
  if(a.tab&&TABS.some(x=>x[0]===a.tab)){S.tab=a.tab;ls.set("rp_tab",a.tab)}
  if(a.lang&&a.lang!==LANG){LANG=a.lang;ls.set("rp_lang",LANG);traducirEstatico()}
  if(Array.isArray(a.chat)&&a.chat.length>=(S.chat||[]).length){S.chat=a.chat;try{sessionStorage.setItem("rp_chat",JSON.stringify(S.chat))}catch(_){}}
  if(a.visto)ls.set("rp_visto",String(Math.max(a.visto,+ls.get("rp_visto","0")||0)));
  if(a.bienvenida){ls.set("rp_bienv","1");S.bienvenida=false}
  if(window.Mapa3D&&S.m3)Mapa3D.enfocar(S.place);
}
function sincronizar(srv){
  const tl=+ls.get("rp_aj_t","0")||0;
  if(srv&&(srv.t||0)>tl)aplicarAjustes(srv);
  // Última visita: se anota una vez por apertura de la app
  if(!S.vistoHecho){S.vistoHecho=true;S.vistoPrev=Math.max(+ls.get("rp_visto","0")||0,srv&&srv.visto||0);ls.set("rp_visto",String(Date.now()));marcarCambio();return}
  if(!srv||tl>(srv.t||0))subirAjustes();
}
S.bienvenida=false;
const abrirAccesoAntes=abrirAcceso;
abrirAcceso=function(m){abrirAccesoAntes(m);prepararSocial()};

// ---------- Buscador con sugerencias (lugares, sectores y texto) ----------
const ICON_LUGAR="📍",ICON_BUSCA="🔎";
let sugSel=-1,sugItems=[];
function sugerencias(txt){
  const q=normTxt(txt),items=[];
  if(!q){
    items.push({g:"",ic:"🧭",t:"Plazas cerca de mí",acc:()=>geolocalizar()});
    if(S.place)items.push({g:"",ic:"🇪🇸",t:"Ver toda España",acc:()=>elegirLugar(null)});
    return items;
  }
  if(/^\d{5}$/.test(q))return [{g:"",ic:ICON_LUGAR,t:`Código postal ${q}`,sub:"Plazas a tu alrededor",acc:()=>buscarCP(q)}];
  const cuenta=new Map(),add=(k,n=1)=>cuenta.set(k,(cuenta.get(k)||0)+n);
  for(const o of S.ofertas){if(!isOpen(o))continue;add("c:"+(o.comunidad||"Cataluña"));const pv=provDe(o);if(pv)add("p:"+pv);const m=o.municipio||muniDe(o)?.nom;if(m)add("m:"+m)}
  const lug=[];
  for(const c of COMUNIDADES)if(normTxt(c).includes(q))lug.push({ic:ICON_LUGAR,t:c==="Estatal"?"Ámbito estatal":c,sub:"Comunidad",n:cuenta.get("c:"+c)||0,acc:()=>elegirLugar({kind:"ccaa",id:c})});
  for(const p of PROV_ES)if(normTxt(p).includes(q)){const cat={Barcelona:8,Girona:17,Lleida:25,Tarragona:43}[p];lug.push({ic:ICON_LUGAR,t:p,sub:"Provincia",n:cuenta.get("p:"+p)||0,acc:()=>elegirLugar(cat?{kind:"prov",id:cat}:{kind:"provES",id:p})})}
  const munis=[...cuenta].filter(([k])=>k.startsWith("m:")&&normTxt(k.slice(2)).includes(q)).sort((a,b)=>b[1]-a[1]).slice(0,5);
  for(const [k,n] of munis){const nom=k.slice(2),cat=MUNI.has(nn(nom));lug.push({ic:ICON_LUGAR,t:nom,sub:"Municipio",n,acc:()=>elegirLugar({kind:cat?"muni":"muniES",id:cat?MUNI.get(nn(nom)).nom:nom})})}
  lug.sort((a,b)=>(normTxt(b.t).startsWith(q)-normTxt(a.t).startsWith(q))||b.n-a.n);
  for(const l of lug.slice(0,5))items.push({g:"Lugares",...l});
  const sec=[];
  for(const x of SECTORES){if(normTxt(x.n).includes(q)||normTxt(CORTO[x.k]||"").includes(q))sec.push({ic:ICONO[x.k]||"•",t:x.n,sub:"Sector",acc:()=>{S.sec=x.k;S.subs=[];S.mostrar=0;guardarFiltros();render()}});
    for(const [k,n] of x.subs)if(normTxt(n).includes(q))sec.push({ic:ICONO[x.k]||"•",t:n,sub:x.n,acc:()=>{S.sec=x.k;S.subs=[k];S.mostrar=0;guardarFiltros();render()}})}
  for(const x of sec.slice(0,4))items.push({g:"Puestos y sectores",...x});
  const n=S.ofertas.filter(o=>isOpen(o)&&(o._h||(o._h=normTxt(`${o.titulo} ${o.organismo||""} ${o.municipio||""} ${o.provincia||""} ${o.comunidad||""} ${SUBN[o.subtipo]?.n||""} ${SECT[o.tipo]?.n||""}`))).includes(q)).length;
  items.push({g:"Buscar texto",ic:ICON_BUSCA,t:`«${txt.trim()}» en todas las plazas`,n,acc:()=>buscarTexto(txt.trim())});
  return items;
}
function pintarSugs(){
  const box=$("sugs"),inp=$("q");
  sugItems=sugerencias(inp.value);sugSel=-1;
  if(!sugItems.length||document.activeElement!==inp){box.hidden=true;inp.setAttribute("aria-expanded","false");return}
  let g=null,h="";
  sugItems.forEach((it,i)=>{if(it.g&&it.g!==g){g=it.g;h+=`<h3>${esc(g)}</h3>`}
    h+=`<button type="button" role="option" id="sug${i}" data-sug="${i}" aria-selected="false"><span class="ic" aria-hidden="true">${it.ic}</span><span class="tx">${esc(it.t)}${it.sub?`<small>${esc(it.sub)}</small>`:""}</span>${it.n!=null?`<span class="n">${it.n.toLocaleString("es-ES")}</span>`:""}</button>`});
  box.innerHTML=h;box.hidden=false;inp.setAttribute("aria-expanded","true");
}
function cerrarSugs(){$("sugs").hidden=true;$("q").setAttribute("aria-expanded","false")}
function elegirLugar(p){
  S.place=p;S.mostrar=0;S.q="";$("q").value="";$("borrarQ").hidden=true;cerrarSugs();$("q").blur();
  guardarFiltros();render();if(S.m3)Mapa3D.enfocar(S.place);
}
function buscarTexto(v){
  S.q=v;S.mostrar=0;if(S.q&&S.tab==="nuevas")S.tab="todas";cerrarSugs();$("q").blur();$("borrarQ").hidden=!v;render();
  if(v)$("barra").scrollIntoView({behavior:"smooth",block:"start"});
}
$("q").addEventListener("input",()=>{$("borrarQ").hidden=!$("q").value;clearTimeout(tq);tq=setTimeout(pintarSugs,90)});
$("q").addEventListener("focus",pintarSugs);
$("q").addEventListener("blur",()=>setTimeout(cerrarSugs,180));
$("q").addEventListener("keydown",e=>{
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){if(!sugItems.length)return;e.preventDefault();sugSel=(sugSel+(e.key==="ArrowDown"?1:-1)+sugItems.length)%sugItems.length;
    for(const b of $("sugs").querySelectorAll("[data-sug]"))b.setAttribute("aria-selected",String(+b.dataset.sug===sugSel));$("q").setAttribute("aria-activedescendant","sug"+sugSel);return}
  if(e.key==="Escape"){cerrarSugs();return}
  if(e.key==="Enter"){e.preventDefault();const v=$("q").value.trim();
    if(sugSel>=0&&sugItems[sugSel]){sugItems[sugSel].acc();if(!sugItems[sugSel].g||sugItems[sugSel].g!=="Buscar texto")cerrarSugs();return}
    if(/^\d{5}$/.test(v)){$("q").value="";buscarCP(v);cerrarSugs();return}
    buscarTexto(v)}
});
$("sugs").addEventListener("mousedown",e=>e.preventDefault());
$("sugs").addEventListener("click",e=>{const b=e.target.closest("[data-sug]");if(!b)return;const it=sugItems[+b.dataset.sug];cerrarSugs();$("q").blur();if(it.g!=="Buscar texto"&&it.g!==""){$("q").value="";$("borrarQ").hidden=true}it.acc()});
$("borrarQ").addEventListener("click",()=>{$("q").value="";$("borrarQ").hidden=true;if(S.q){S.q="";render()}$("q").focus()});
if(S.q){$("q").value=S.q;$("borrarQ").hidden=false}

// ---------- Alertas por correo: palabras, comunidades, sector y estudios ----------
let alEditando=null;
function lugarDeFiltros(f){
  if(f.cerca)return `A menos de ${f.cerca.km} km de ${f.cerca.etiqueta||"tu ubicación"}`;
  if(f.zonas?.length)return f.zonas.length>3?`${f.zonas.length} municipios de ${f.comunidades?.[0]||"Cataluña"}`:f.zonas.join(", ");
  if(f.provincias?.length)return "Provincia de "+f.provincias.join(", ");
  return "";
}
function abrirAlerta(a){
  if(!S.ses){abrirAcceso("Crea tu cuenta gratis y te avisamos por correo cuando salga una plaza con tus palabras y en tus comunidades.");return}
  alEditando=a||null;
  const f=a?{...a.filtros}:filtrosActuales();
  if(!a&&S.q)f.palabras=S.q.split(/\s*,\s*|\s+y\s+/).filter(Boolean);
  const ccaa=new Set(f.comunidades||[]);
  $("dlgAlertaT").textContent=a?"Editar alerta":"Nueva alerta por correo";
  $("alGuardar").textContent=a?"Guardar cambios":"Crear alerta";
  $("alNombre").value=a?a.nombre:(sugerirNombre(f));
  $("alPalabras").value=(f.palabras||[]).join(", ");$("alExcluir").value=(f.excluir||[]).join(", ");
  $("alComunidades").innerHTML=COMUNIDADES.map(c=>`<label><input type="checkbox" value="${esc(c)}" ${ccaa.has(c)?"checked":""}>${esc(c==="Estatal"?"Ámbito estatal":c)}</label>`).join("");
  const lug=lugarDeFiltros(f);$("alLugarBox").hidden=!lug;$("alLugar").checked=!!lug;$("alLugarT").textContent=lug?`Solo en: ${lug}`:"";
  $("alLugarBox").dataset.f=JSON.stringify({zonas:f.zonas,provincias:f.provincias,cerca:f.cerca});
  $("alSector").innerHTML=`<option value="">Todos los sectores</option>`+SECTORES.map(x=>`<option value="${x.k}" ${(f.tipos||[])[0]===x.k?"selected":""}>${esc(x.n)}</option>`).join("");
  $("alSector").dataset.subs=JSON.stringify(f.subtipos||[]);
  $("alNivel").innerHTML=NIV_OPC.map(([v,l])=>`<option value="${v}" ${String(f.nivelMax??"")===v?"selected":""}>${esc(l)}</option>`).join("");
  for(const r of document.querySelectorAll('[name="alFrec"]'))r.checked=r.value===(S.yo?.frecuencia||"diaria");
  $("alErr").textContent="";
  const d=$("dlgAlerta");if(d.showModal)d.showModal();else d.setAttribute("open","");
  setTimeout(()=>$("alPalabras").focus(),60);
}
function sugerirNombre(f){
  const p=[];if(f.subtipos?.length)p.push(SUBN[f.subtipos[0]]?.n);else if(f.tipos?.length)p.push(SECT[f.tipos[0]]?.n);
  if(S.q)p.push(S.q);
  const l=f.comunidades?.[0]||(S.place&&S.place.kind!=="cerca"?nombreLugar(S.place).replace(/^en (la provincia de )?/,""):"");if(l)p.push(l);
  return p.filter(Boolean).join(" · ").slice(0,80);
}
const listaComas=v=>v.split(",").map(x=>x.trim()).filter(Boolean).slice(0,20);
function cerrarAlerta(){const d=$("dlgAlerta");if(d.close)d.close();else d.removeAttribute("open")}
$("dlgAlertaX").addEventListener("click",cerrarAlerta);$("alCancelar").addEventListener("click",cerrarAlerta);
$("dlgAlerta").addEventListener("click",e=>{if(e.target===$("dlgAlerta"))cerrarAlerta()});
$("fAlerta").addEventListener("submit",async e=>{
  e.preventDefault();
  const nombre=$("alNombre").value.trim();if(!nombre){$("alErr").textContent="Ponle un nombre a la alerta.";return}
  const f={soloAbiertas:true};
  const pal=listaComas($("alPalabras").value),exc=listaComas($("alExcluir").value);if(pal.length)f.palabras=pal;if(exc.length)f.excluir=exc;
  const cc=[...$("alComunidades").querySelectorAll("input:checked")].map(x=>x.value);if(cc.length)f.comunidades=cc;
  if($("alLugar").checked&&!$("alLugarBox").hidden){const l=JSON.parse($("alLugarBox").dataset.f||"{}");for(const k of ["zonas","provincias","cerca"])if(l[k]&&(!Array.isArray(l[k])||l[k].length))f[k]=l[k]}
  const sec=$("alSector").value;if(sec){f.tipos=[sec];const subs=JSON.parse($("alSector").dataset.subs||"[]").filter(k=>SUBN[k]?.s===sec);if(subs.length)f.subtipos=subs}
  const niv=$("alNivel").value;if(niv!=="")f.nivelMax=+niv;
  const frec=document.querySelector('[name="alFrec"]:checked')?.value||"diaria";
  $("alGuardar").disabled=true;
  try{
    if(alEditando)await api(`/alertas/${encodeURIComponent(alEditando.id)}`,{method:"PUT",body:JSON.stringify({nombre,filtros:f})});
    else await api("/alertas",{method:"POST",body:JSON.stringify({nombre,filtros:f})});
    if(S.yo&&frec!==S.yo.frecuencia){await api("/cuenta",{method:"PATCH",body:JSON.stringify({frecuencia:frec})}).catch(()=>{});S.yo.frecuencia=frec}
    S.alertas=await api("/alertas");if(S.yo)S.yo.alertas=S.alertas.length;
    cerrarAlerta();renderCrit();renderCuenta();
    toast(alEditando?"Alerta guardada":`Alerta creada: te avisaremos a ${S.yo?.email||"tu correo"}`);
  }catch(err){$("alErr").textContent=err.message}
  finally{$("alGuardar").disabled=false}
});
document.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  if(b.id==="crearAlerta"||b.dataset.nuevaAlerta!==undefined){abrirAlerta(null);return}
  if(b.dataset.alEdit){const a=(S.alertas||[]).find(x=>x.id===b.dataset.alEdit);if(a)abrirAlerta(a)}
});
