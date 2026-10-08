/* Radar de Plazas · mapa (MapLibre GL servido desde /vendor).
   Cada zona se pinta con un color según cuántas plazas tiene (tramos con leyenda), con algo de relieve.
   Se baja de nivel al tocar: España → comunidad → provincia → municipios. Las etiquetas nunca se pisan
   y los municipios cercanos se agrupan. Si no hay WebGL, la página usa el mapa plano. */
(function(){
  const BASE=(document.currentScript&&document.currentScript.src||"").replace(/mapa3d\.js.*$/,"");
  const NORM=s=>(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
  const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const lento=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
  const oscuro=()=>{const t=document.documentElement.dataset.theme;return t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches};
  const VISTAS={"España":[[-9.6,35.8],[4.5,43.9]],"Canarias":[[-18.3,27.5],[-13.3,29.5]]};
  const CAT_PROV={8:"Barcelona",17:"Girona",25:"Lleida",43:"Tarragona"},CAT_COD={Barcelona:8,Girona:17,Lleida:25,Tarragona:43};
  // Cinco tramos bien distintos (de pocas a muchas plazas) y colores de plazo para los municipios
  const TRAMOS_CLARO=["#fde8a8","#f7b267","#ec7a52","#c4456b","#6a2c8c"];
  const TRAMOS_OSCURO=["#7a6a2c","#b8743a","#d0634a","#c4456b","#9a62c9"];
  let map=null,D=null,opts=null,modo="comunidades",filas=[],lugar=null,etiquetas=[],popup=null,listo=false,yo=null,tramos=[1,2,3,4,5];
  try{modo=localStorage.getItem("rp_m3")||"comunidades"}catch(_){}

  function soporta(){try{const c=document.createElement("canvas");return !!(window.WebGLRenderingContext&&(c.getContext("webgl2")||c.getContext("webgl")))}catch(_){return false}}
  function cargar(src,tipo){return new Promise((ok,ko)=>{if(tipo==="css"){const l=document.createElement("link");l.rel="stylesheet";l.href=src;l.onload=ok;l.onerror=ok;document.head.appendChild(l);return}
    const s=document.createElement("script");s.src=src;s.async=true;s.onload=ok;s.onerror=()=>ko(new Error("No se pudo cargar "+src));document.head.appendChild(s)})}
  const paleta=()=>oscuro()?TRAMOS_OSCURO:TRAMOS_CLARO;
  function colores(){return {mar:css("--sea"),tierra:css("--land"),borde:css("--border-com"),fg:css("--fg"),surface:css("--surface"),
    urgente:css("--urgent"),pronto:css("--soon"),ok:css("--ok"),gris:css("--muted")}}
  const colorTramo=()=>{const p=paleta(),c=colores();return ["match",["coalesce",["feature-state","t"],0],1,p[0],2,p[1],3,p[2],4,p[3],5,p[4],c.tierra]};
  function estilo(){const c=colores();return{version:8,
    sources:{prov:{type:"geojson",data:D.provincias,promoteId:"n"},
      pts:{type:"geojson",data:{type:"FeatureCollection",features:[]},cluster:true,clusterRadius:42,clusterMaxZoom:10,
        clusterProperties:{n:["+",["get","n"]],d:["min",["get","d"]]}},
      radio:{type:"geojson",data:{type:"FeatureCollection",features:[]}}},
    light:{anchor:"map",position:[1.3,210,40],intensity:0.3},
    layers:[
      {id:"fondo",type:"background",paint:{"background-color":c.mar}},
      {id:"relieve",type:"fill-extrusion",source:"prov",paint:{"fill-extrusion-color":colorTramo(),
        "fill-extrusion-height":["*",["coalesce",["feature-state","t"],0],["coalesce",["feature-state","k"],0]],"fill-extrusion-opacity":0.97,"fill-extrusion-vertical-gradient":false}},
      {id:"borde",type:"line",source:"prov",paint:{"line-color":c.borde,"line-width":0.6,"line-opacity":0.8}},
      {id:"sel",type:"line",source:"prov",filter:["==",["get","n"],""],paint:{"line-color":c.fg,"line-width":2.6}},
      {id:"radio-f",type:"fill",source:"radio",paint:{"fill-color":c.fg,"fill-opacity":0.06}},
      {id:"radio-l",type:"line",source:"radio",paint:{"line-color":c.fg,"line-width":1.6,"line-dasharray":[2,2]}},
      {id:"grupos",type:"circle",source:"pts",filter:["has","point_count"],paint:{
        "circle-color":c.fg,"circle-opacity":0.88,"circle-stroke-color":c.surface,"circle-stroke-width":2,
        "circle-radius":["interpolate",["linear"],["get","n"],2,14,10,18,50,24,200,30]}},
      {id:"puntos",type:"circle",source:"pts",filter:["!",["has","point_count"]],paint:{
        "circle-color":["case",["<",["get","d"],0],c.gris,["<=",["get","d"],3],c.urgente,["<=",["get","d"],7],c.pronto,c.ok],
        "circle-stroke-color":c.surface,"circle-stroke-width":2,
        "circle-radius":["interpolate",["linear"],["get","n"],1,8,5,12,20,17]}},
    ]}}

  // ---------- recuento ----------
  function provDe(o){if(o.provincia)return o.provincia;const p=opts.provDe&&opts.provDe(o);return p||null}
  function contar(){
    const porProv=new Map(),porCcaa=new Map(),porMuni=new Map();let estatal=0;
    for(const o of filas){
      if(o.comunidad==="Estatal"){estatal++;continue}
      const c=o.comunidad||"Cataluña";porCcaa.set(c,(porCcaa.get(c)||0)+1);
      const p=provDe(o);if(p)porProv.set(NORM(p),(porProv.get(NORM(p))||0)+1);
      const pt=opts.coordDe&&opts.coordDe(o);
      if(pt){const k=pt.nom+"|"+(pt.cat?1:0);const g=porMuni.get(k)||{nom:pt.nom,cat:pt.cat,lon:pt.lon,lat:pt.lat,n:0,d:999};g.n++;
        const d=opts.diasDe&&opts.diasDe(o);if(d!==null&&d!==undefined&&d>=0&&d<g.d)g.d=d;porMuni.set(k,g)}
    }
    return {porProv,porCcaa,porMuni,estatal};
  }
  /** Cortes de hasta 5 tramos a partir de los valores (únicos y redondeados para que la leyenda se lea bien). */
  function calcularTramos(vals){
    const v=vals.filter(x=>x>0).sort((a,b)=>a-b);if(!v.length)return [1];
    const max=v[v.length-1],distintos=[...new Set(v)];
    if(distintos.length<=5)return Object.assign(distintos,{exactos:true});
    const q=f=>v[Math.min(v.length-1,Math.floor(f*v.length))];
    const nice=x=>x<10?Math.round(x):x<50?Math.round(x/5)*5:x<200?Math.round(x/10)*10:Math.round(x/50)*50;
    const cortes=[v[0]];
    for(const f of [.35,.6,.8,.93]){const c=Math.max(cortes[cortes.length-1]+1,nice(q(f)));if(c<=max&&c>cortes[cortes.length-1])cortes.push(c)}
    return cortes;
  }
  // Con menos de 5 tramos se usan colores separados de la paleta para que se distingan bien
  const indiceColor=i=>tramos.length<=1?2:Math.round(i*4/(tramos.length-1));
  const tramoDe=n=>{if(!n)return 0;let t=0;for(let i=0;i<tramos.length;i++)if(n>=tramos[i])t=i;return indiceColor(t)+1};

  function pintar(){
    if(!listo)return;
    const {porProv,porCcaa,porMuni,estatal}=contar(),c=colores();
    const fuente=modo==="comunidades"?[...porCcaa.values()]:[...porProv.values()];
    tramos=calcularTramos(fuente);
    const z=map.getZoom(),k=Math.min(9000,Math.max(1200,4200*Math.pow(2,(5.5-z)*0.8)))*(modo==="municipios"?0:1);
    for(const f of D.provincias.features){
      const n=f.properties.n,cc=f.properties.c;
      const v=modo==="comunidades"?(porCcaa.get(cc)||0):(porProv.get(NORM(n))||0);
      map.setFeatureState({source:"prov",id:n},{t:modo==="municipios"?(v?1:0):tramoDe(v),k});
    }
    // En municipios el color de fondo es muy suave para que destaquen los puntos
    map.setPaintProperty("relieve","fill-extrusion-color",modo==="municipios"?["case",[">",["coalesce",["feature-state","t"],0],0],oscuro()?"#22404a":"#e4f0ee",c.tierra]:colorTramo());
    // Zona elegida
    const sel=lugar||{};
    let filtro=["==",["get","n"],""];
    if(sel.kind==="ccaa")filtro=["==",["get","c"],sel.id];
    else if(sel.kind==="provES")filtro=["==",["get","n"],sel.id];
    else if(sel.kind==="prov")filtro=["==",["get","n"],CAT_PROV[sel.id]||""];
    map.setFilter("sel",filtro);
    // Municipios (agrupados por cercanía)
    const feats=modo==="municipios"?[...porMuni.values()].map(g=>({type:"Feature",properties:{nom:g.nom,cat:g.cat?1:0,n:g.n,d:g.d===999?-1:g.d},geometry:{type:"Point",coordinates:[g.lon,g.lat]}})):[];
    map.getSource("pts").setData({type:"FeatureCollection",features:feats});
    // Radio alrededor de un código postal o de tu ubicación
    map.getSource("radio").setData(sel.kind==="cerca"?{type:"FeatureCollection",features:[circulo(sel.lon,sel.lat,sel.km)]}:{type:"FeatureCollection",features:[]});
    if(yo){yo.remove();yo=null}
    if(sel.kind==="cerca"){const el=document.createElement("div");el.className="m3-yo";el.title=sel.id;yo=new maplibregl.Marker({element:el}).setLngLat([sel.lon,sel.lat]).addTo(map)}
    leyenda(estatal);
    etiquetar();
  }
  function circulo(lon,lat,km){const pts=[];const dx=km/(111.32*Math.cos(lat*Math.PI/180)),dy=km/110.57;for(let i=0;i<=64;i++){const a=2*Math.PI*i/64;pts.push([lon+dx*Math.cos(a),lat+dy*Math.sin(a)])}
    return {type:"Feature",properties:{},geometry:{type:"Polygon",coordinates:[pts]}}}

  // ---------- etiquetas sin solapes ----------
  function etiquetar(){
    if(!listo)return;
    for(const e of etiquetas)e.remove();etiquetas=[];
    const {porProv,porCcaa}=contar();
    let items=[];
    if(modo==="comunidades")for(const [cc,n] of porCcaa){const p=D.ccaa[cc];if(p)items.push({ll:p,txt:String(n),tit:`${cc}: ${n} plazas`,peso:n})}
    else if(modo==="provincias")for(const f of D.provincias.features){const n=porProv.get(NORM(f.properties.n));const p=D.centros[f.properties.n];if(n&&p)items.push({ll:p,txt:String(n),tit:`${f.properties.n}: ${n} plazas`,peso:n,nom:f.properties.n})}
    else{
      // Números dentro de cada grupo o punto (los puntos de 1 plaza no llevan número)
      const vistos=new Set();
      for(const f of map.querySourceFeatures("pts")){
        const p=f.properties,id=p.cluster?"c"+p.cluster_id:"m"+p.nom;if(vistos.has(id))continue;vistos.add(id);
        if(!p.cluster&&p.n<2)continue;
        items.push({ll:f.geometry.coordinates,txt:String(p.n),tit:p.cluster?`${p.n} plazas en ${p.point_count} municipios`:`${p.nom}: ${p.n} plazas`,peso:p.n,dentro:true});
      }
    }
    items.sort((a,b)=>b.peso-a.peso);
    const ocupadas=[],w=map.getCanvas().clientWidth,h=map.getCanvas().clientHeight;
    for(const it of items){
      const p=map.project(it.ll),ancho=it.dentro?0:Math.max(26,10+9*it.txt.length+(it.nom&&modo==="provincias"?0:0)),alto=it.dentro?0:24;
      if(p.x<0||p.y<0||p.x>w||p.y>h)continue;
      if(!it.dentro){const caja=[p.x-ancho/2-3,p.y-alto/2-3,p.x+ancho/2+3,p.y+alto/2+3];
        if(ocupadas.some(o=>caja[0]<o[2]&&caja[2]>o[0]&&caja[1]<o[3]&&caja[3]>o[1]))continue;ocupadas.push(caja)}
      const el=document.createElement("div");el.className="m3-lbl"+(it.dentro?" dentro":"");el.textContent=it.txt;el.title=it.tit;
      etiquetas.push(new maplibregl.Marker({element:el,anchor:"center"}).setLngLat(it.ll).addTo(map));
    }
  }
  function leyenda(estatal){
    const box=opts.leyenda;if(!box)return;
    const c=colores(),p=paleta();
    if(modo==="municipios"){
      box.innerHTML=`<span><i style="background:${c.urgente}"></i>cierra en 3 días o menos</span><span><i style="background:${c.pronto}"></i>en 7 días o menos</span><span><i style="background:${c.ok}"></i>más tiempo</span><span><i style="background:${c.gris}"></i>sin plazo</span><span><i class="grupo"></i>varios municipios: toca para acercar</span>`;
    }else{
      const {porProv,porCcaa}=contar(),vals=modo==="comunidades"?[...porCcaa.values()]:[...porProv.values()],max=Math.max(0,...vals);
      const rangos=tramos.map((t,i)=>{if(tramos.exactos)return `${t}`;const fin=i===tramos.length-1?max:tramos[i+1]-1;return fin>t?`${t}–${fin}`:`${t}`});
      box.innerHTML=`<span class="tit">Plazas por ${modo==="comunidades"?"comunidad":"provincia"}</span>`+rangos.map((r,i)=>`<span><i class="sq" style="background:${p[indiceColor(i)]}"></i>${r}</span>`).join("")+`<span><i class="sq" style="background:${c.tierra};outline:1px solid ${c.borde}"></i>ninguna</span>`;
    }
    if(estatal)box.innerHTML+=`<span class="estatal">+${estatal} de ámbito estatal (fuera del mapa)</span>`;
  }

  // ---------- cámara ----------
  function bboxDe(feats){let a=[180,90,-180,-90];for(const f of feats)for(const pol of f.geometry.coordinates)for(const p of pol[0]){a[0]=Math.min(a[0],p[0]);a[1]=Math.min(a[1],p[1]);a[2]=Math.max(a[2],p[0]);a[3]=Math.max(a[3],p[1])}return [[a[0],a[1]],[a[2],a[3]]]}
  function volar(clave,zoomMax){
    if(!map)return;
    let b=VISTAS[clave];
    if(!b){const fs=D.provincias.features.filter(f=>f.properties.c===clave||f.properties.n===clave);if(fs.length)b=bboxDe(fs)}
    if(!b)return;
    map.fitBounds(b,{padding:28,pitch:28,bearing:0,duration:lento()?0:1300,essential:true,maxZoom:zoomMax||9});
  }
  function enfocar(p){
    lugar=p;if(!map)return;pintar();
    if(!p){volar("España");return}
    if(p.kind==="ccaa")volar(p.id==="Estatal"?"España":p.id);
    else if(p.kind==="provES")volar(p.id);
    else if(p.kind==="prov")volar(CAT_PROV[p.id]);
    else if(p.kind==="cerca"){const c=circulo(p.lon,p.lat,p.km);map.fitBounds(bboxDe([{geometry:{coordinates:[c.geometry.coordinates]}}]),{padding:24,pitch:20,duration:lento()?0:1300})}
    else if(p.kind==="muni"||p.kind==="muniES"){const pt=opts.coordDeNombre&&opts.coordDeNombre(p.id,p.kind==="muni");if(pt)map.flyTo({center:[pt.lon,pt.lat],zoom:10.5,pitch:20,duration:lento()?0:1300,essential:true})}
  }
  function cambiarModo(m,silencioso){modo=m;try{localStorage.setItem("rp_m3",m)}catch(_){}pintar();if(!silencioso&&opts.alCambiarModo)opts.alCambiarModo(m)}

  function iniciarMapa(){
    map=new maplibregl.Map({container:opts.contenedor,style:estilo(),bounds:VISTAS["España"],fitBoundsOptions:{padding:16},pitch:0,bearing:0,maxPitch:50,
      attributionControl:false,cooperativeGestures:matchMedia("(pointer: coarse)").matches,dragRotate:false,renderWorldCopies:false,minZoom:3.5,maxZoom:12,
      locale:{"CooperativeGesturesHandler.WindowsHelpText":"Usa Ctrl + rueda para acercar","CooperativeGesturesHandler.MacHelpText":"Usa ⌘ + rueda para acercar","CooperativeGesturesHandler.MobileHelpText":"Usa dos dedos para mover el mapa","NavigationControl.ZoomIn":"Acercar","NavigationControl.ZoomOut":"Alejar"}});
    map.touchZoomRotate.disableRotation();
    if(!matchMedia("(pointer: coarse)").matches)map.addControl(new maplibregl.NavigationControl({showCompass:false}),"top-right");
    map.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:"Límites: IGN · ICGC"}),"bottom-right");
    popup=new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:10,className:"m3-pop"});
    map.on("load",()=>{
      listo=true;pintar();
      if(!lento())map.easeTo({pitch:28,duration:1600,easing:t=>1-Math.pow(1-t,3)});else map.jumpTo({pitch:28});
      if(lugar)setTimeout(()=>enfocar(lugar),lento()?0:1700);
    });
    let te=null;const reetiquetar=()=>{clearTimeout(te);te=setTimeout(etiquetar,80)};
    map.on("moveend",reetiquetar);map.on("resize",reetiquetar);
    map.on("sourcedata",e=>{if(e.sourceId==="pts"&&e.isSourceLoaded)reetiquetar()});
    let tz=null;map.on("zoomend",()=>{clearTimeout(tz);tz=setTimeout(pintar,60)});
    // Información al pasar el ratón (en el móvil, al tocar se entra directamente)
    const info=f=>{const p=f.properties,{porProv,porCcaa}=contar();
      if(p.cluster)return `<b>${p.n} plazas</b><br>en ${p.point_count} municipios · toca para acercar`;
      if(p.nom)return `<b>${p.nom}</b><br>${p.n} ${p.n==1?"plaza":"plazas"}`;
      if(modo==="comunidades")return `<b>${p.c}</b><br>${porCcaa.get(p.c)||0} plazas`;
      return `<b>${p.n}</b><br>${porProv.get(NORM(p.n))||0} plazas · ${p.c}`};
    if(!matchMedia("(pointer: coarse)").matches)for(const capa of ["relieve","puntos","grupos"]){
      map.on("mousemove",capa,e=>{const f=e.features&&e.features[0];if(!f)return;map.getCanvas().style.cursor="pointer";popup.setLngLat(e.lngLat).setHTML(info(f)).addTo(map)});
      map.on("mouseleave",capa,()=>{map.getCanvas().style.cursor="";popup.remove()});
    }
    // Tocar: de lo general a lo concreto
    map.on("click",e=>{
      popup.remove();
      const g=map.queryRenderedFeatures(e.point,{layers:["grupos"]});
      if(g.length){map.getSource("pts").getClusterExpansionZoom(g[0].properties.cluster_id).then(z=>map.easeTo({center:g[0].geometry.coordinates,zoom:z+0.3,duration:lento()?0:700})).catch(()=>{});return}
      const pt=map.queryRenderedFeatures(e.point,{layers:["puntos"]});
      if(pt.length){const q=pt[0].properties;opts.alElegir&&opts.alElegir({kind:q.cat==1?"muni":"muniES",id:q.nom});return}
      const fs=map.queryRenderedFeatures(e.point,{layers:["relieve"]});if(!fs.length)return;
      const q=fs[0].properties;
      if(modo==="comunidades"){cambiarModo("provincias");opts.alElegir&&opts.alElegir({kind:"ccaa",id:q.c})}
      else{if(modo==="provincias")cambiarModo("municipios");opts.alElegir&&opts.alElegir(CAT_COD[q.n]?{kind:"prov",id:CAT_COD[q.n]}:{kind:"provES",id:q.n})}
    });
    const tema=()=>{if(!listo)return;map.setStyle(estilo());map.once("styledata",()=>setTimeout(pintar,50))};
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change",tema);
  }

  window.Mapa3D={
    soporta,
    async iniciar(o){
      opts=o;if(!soporta())throw new Error("Sin WebGL");
      await Promise.all([cargar(BASE+"vendor/maplibre/maplibre-gl.css","css"),cargar(BASE+"vendor/maplibre/maplibre-gl.js"),window.MAPA_DATOS?null:cargar(BASE+"mapa-datos.js")]);
      D=window.MAPA_DATOS;iniciarMapa();
    },
    actualizar(rows,p){filas=rows||[];lugar=p||null;pintar()},
    enfocar,volar,
    modo(m){if(m)cambiarModo(m,true);return modo},
    redimensionar(){map&&map.resize()},
  };
})();
