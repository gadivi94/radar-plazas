/* Radar de Plazas · mapa 3D (MapLibre GL, servido desde /vendor). Provincias y comunidades extruidas según las plazas,
   columnas por municipio y vuelos de cámara. Si el dispositivo no tiene WebGL, la página usa el mapa plano. */
(function(){
  const BASE=(document.currentScript&&document.currentScript.src||"").replace(/mapa3d\.js.*$/,"");
  const NORM=s=>(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
  const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const lento=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
  const VISTAS={
    "España":[[-9.6,35.8],[4.5,43.9]],"Canarias":[[-18.3,27.5],[-13.3,29.5]],
  };
  const CAT_PROV={8:"Barcelona",17:"Girona",25:"Lleida",43:"Tarragona"},CAT_COD={Barcelona:8,Girona:17,Lleida:25,Tarragona:43};
  let map=null,D=null,opts=null,modo="provincias",filas=[],lugar=null,marcas=[],girando=false,popup=null,listo=false;
  try{modo=localStorage.getItem("rp_m3")||"provincias"}catch(_){}

  function soporta(){try{const c=document.createElement("canvas");return !!(window.WebGLRenderingContext&&(c.getContext("webgl2")||c.getContext("webgl")))}catch(_){return false}}
  function cargar(src,tipo){return new Promise((ok,ko)=>{if(tipo==="css"){const l=document.createElement("link");l.rel="stylesheet";l.href=src;l.onload=ok;l.onerror=ok;document.head.appendChild(l);return}
    const s=document.createElement("script");s.src=src;s.async=true;s.onload=ok;s.onerror=()=>ko(new Error("No se pudo cargar "+src));document.head.appendChild(s)})}

  function colores(){return {mar:css("--sea"),tierra:css("--land"),borde:css("--border-com"),fuerte:css("--border-prov"),c1:css("--heat1"),c2:css("--heat2"),c3:css("--heat3"),acento:css("--accent"),
    urgente:css("--urgent"),pronto:css("--soon"),ok:css("--ok"),gris:css("--muted"),fg:css("--fg")}}
  function estilo(){const c=colores();return{version:8,
    sources:{prov:{type:"geojson",data:D.provincias,promoteId:"n"},pts:{type:"geojson",data:{type:"FeatureCollection",features:[]}}},
    light:{anchor:"map",position:[1.4,200,35],intensity:0.35,color:"#ffffff"},
    layers:[
      {id:"fondo",type:"background",paint:{"background-color":c.mar}},
      {id:"tierra",type:"fill",source:"prov",paint:{"fill-color":c.tierra}},
      {id:"prov3d",type:"fill-extrusion",source:"prov",paint:{
        "fill-extrusion-color":["interpolate",["linear"],["coalesce",["feature-state","v"],0],0,c.tierra,0.0001,c.c1,0.45,c.c2,1,c.c3],
        "fill-extrusion-height":["coalesce",["feature-state","h"],0],"fill-extrusion-base":0,
        "fill-extrusion-opacity":0.9,"fill-extrusion-vertical-gradient":true}},
      {id:"borde",type:"line",source:"prov",paint:{"line-color":["case",["boolean",["feature-state","sel"],false],c.fg,c.borde],"line-width":["case",["boolean",["feature-state","sel"],false],2.4,0.7]}},
      {id:"pts3d",type:"fill-extrusion",source:"pts",paint:{"fill-extrusion-color":["get","col"],"fill-extrusion-height":["get","h"],"fill-extrusion-opacity":0.96}},
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
      if(pt){const k=pt.nom+"|"+(pt.cat?1:0);const g=porMuni.get(k)||{nom:pt.nom,cat:pt.cat,lon:pt.lon,lat:pt.lat,n:0,dias:null};g.n++;
        const d=opts.diasDe&&opts.diasDe(o);if(d!==null&&d>=0&&(g.dias===null||d<g.dias))g.dias=d;porMuni.set(k,g)}
    }
    return {porProv,porCcaa,porMuni,estatal};
  }
  function hexagono(lon,lat,km){const out=[];const dx=km/(111.32*Math.cos(lat*Math.PI/180)),dy=km/110.57;
    for(let i=0;i<=6;i++){const a=Math.PI/3*i+Math.PI/6;out.push([lon+dx*Math.cos(a),lat+dy*Math.sin(a)])}return [out]}
  function pintar(){
    if(!listo)return;
    const {porProv,porCcaa,porMuni,estatal}=contar(),c=colores();
    const maxP=Math.max(1,...porProv.values()),maxC=Math.max(1,...porCcaa.values()),maxM=Math.max(1,...[...porMuni.values()].map(g=>g.n));
    const sel=lugar||{};
    // Las columnas se ajustan al zoom para que no tapen la zona cuando te acercas
    const z=map.getZoom(),f=Math.min(1.25,Math.max(0.18,Math.pow(2,(5.6-z)*0.75)));
    for(const f of D.provincias.features){
      const n=f.properties.n,cc=f.properties.c;let v=0,h=0;
      if(modo==="comunidades"){const k=porCcaa.get(cc)||0;v=k/maxC;h=k?(6000+Math.sqrt(v)*120000)*f:0}
      else if(modo==="provincias"){const k=porProv.get(NORM(n))||0;v=k/maxP;h=k?(6000+Math.sqrt(v)*120000)*f:0}
      else{const k=porProv.get(NORM(n))||0;v=k?0.0002:0;h=0}
      const esSel=(sel.kind==="ccaa"&&sel.id===cc)||(sel.kind==="provES"&&NORM(sel.id)===NORM(n))||(sel.kind==="prov"&&CAT_PROV[sel.id]===n);
      map.setFeatureState({source:"prov",id:n},{v,h,sel:esSel});
    }
    const feats=modo==="municipios"?[...porMuni.values()].map(g=>({type:"Feature",properties:{nom:g.nom,cat:g.cat?1:0,n:g.n,
      col:g.dias===null?c.gris:g.dias<=3?c.urgente:g.dias<=7?c.pronto:c.ok,h:(4000+Math.sqrt(g.n/maxM)*80000)*f},
      geometry:{type:"Polygon",coordinates:hexagono(g.lon,g.lat,(g.cat?2.4:4)*Math.max(0.45,f))}})):[];
    map.getSource("pts").setData({type:"FeatureCollection",features:feats});
    // Etiquetas con el número (marcadores HTML: no necesitan servidor de fuentes)
    for(const m of marcas)m.remove();marcas=[];
    const etiqueta=(lon,lat,txt,titulo,clase)=>{const el=document.createElement("div");el.className="m3-lbl "+(clase||"");el.textContent=txt;el.title=titulo;
      marcas.push(new maplibregl.Marker({element:el,anchor:"center"}).setLngLat([lon,lat]).addTo(map))};
    if(modo==="comunidades")for(const [cc,n] of porCcaa){const p=D.ccaa[cc];if(p)etiqueta(p[0],p[1],n,cc+": "+n+" plazas")}
    else if(modo==="provincias")for(const f of D.provincias.features){const n=porProv.get(NORM(f.properties.n));const p=D.centros[f.properties.n];if(n&&p)etiqueta(p[0],p[1],n,f.properties.n+": "+n+" plazas")}
    else [...porMuni.values()].sort((a,b)=>b.n-a.n).filter((g,i)=>g.n>1&&i<20).forEach(g=>etiqueta(g.lon,g.lat,g.n,g.nom+": "+g.n+" plazas","mun"));
    if(opts.alContar)opts.alContar({estatal,total:filas.length});
  }

  // ---------- cámara ----------
  function bboxDe(feats){let a=[180,90,-180,-90];for(const f of feats)for(const pol of f.geometry.coordinates)for(const p of pol[0]){a[0]=Math.min(a[0],p[0]);a[1]=Math.min(a[1],p[1]);a[2]=Math.max(a[2],p[0]);a[3]=Math.max(a[3],p[1])}return [[a[0],a[1]],[a[2],a[3]]]}
  function volar(clave){
    if(!map)return;
    let b=VISTAS[clave];
    if(!b){const fs=D.provincias.features.filter(f=>f.properties.c===clave||f.properties.n===clave);if(fs.length)b=bboxDe(fs)}
    if(!b)return;
    map.fitBounds(b,{padding:{top:70,bottom:40,left:30,right:30},pitch:modo==="municipios"?55:48,bearing:-12,duration:lento()?0:1600,essential:true,maxZoom:modo==="municipios"?9:8});
  }
  function enfocar(p){
    lugar=p;if(!map)return;pintar();
    if(!p){volar("España");return}
    if(p.kind==="ccaa")volar(p.id==="Estatal"?"España":p.id);
    else if(p.kind==="provES")volar(p.id);
    else if(p.kind==="prov")volar(CAT_PROV[p.id]);
    else if(p.kind==="muni"||p.kind==="muniES"){const pt=opts.coordDeNombre&&opts.coordDeNombre(p.id,p.kind==="muni");if(pt)map.flyTo({center:[pt.lon,pt.lat],zoom:10,pitch:58,duration:lento()?0:1600,essential:true})}
  }

  function iniciarMapa(){
    const cont=opts.contenedor;
    map=new maplibregl.Map({container:cont,style:estilo(),bounds:VISTAS["España"],fitBoundsOptions:{padding:20},pitch:0,bearing:0,maxPitch:70,
      attributionControl:false,cooperativeGestures:matchMedia("(pointer: coarse)").matches,dragRotate:true,renderWorldCopies:false,minZoom:3.5,maxZoom:12,
      locale:{"CooperativeGesturesHandler.WindowsHelpText":"Usa Ctrl + rueda para acercar","CooperativeGesturesHandler.MacHelpText":"Usa ⌘ + rueda para acercar","CooperativeGesturesHandler.MobileHelpText":"Usa dos dedos para mover el mapa","NavigationControl.ZoomIn":"Acercar","NavigationControl.ZoomOut":"Alejar","NavigationControl.ResetBearing":"Orientar al norte"}});
    if(!matchMedia("(pointer: coarse)").matches)map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),"top-right");
    map.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:"Límites: IGN · ICGC"}));
    popup=new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:12,className:"m3-pop"});
    map.on("load",()=>{
      listo=true;pintar();
      if(!lento())map.easeTo({pitch:48,bearing:-12,duration:2400,easing:t=>1-Math.pow(1-t,3)});else map.jumpTo({pitch:48,bearing:-12});
      if(lugar)setTimeout(()=>enfocar(lugar),lento()?0:2500);
    });
    const nombreDe=e=>{const f=e.features&&e.features[0];return f?f.properties:null};
    const info=props=>{const {porProv,porCcaa}=contar();
      if(props.nom)return `<b>${props.nom}</b><br>${props.n} ${props.n==1?"plaza":"plazas"}`;
      if(modo==="comunidades")return `<b>${props.c}</b><br>${porCcaa.get(props.c)||0} plazas`;
      return `<b>${props.n}</b> · ${props.c}<br>${porProv.get(NORM(props.n))||0} plazas`};
    for(const capa of ["prov3d","pts3d"]){
      map.on("mousemove",capa,e=>{const p=nombreDe(e);if(!p)return;map.getCanvas().style.cursor="pointer";popup.setLngLat(e.lngLat).setHTML(info(p)).addTo(map)});
      map.on("mouseleave",capa,()=>{map.getCanvas().style.cursor="";popup.remove()});
    }
    map.on("click",e=>{
      const pts=map.queryRenderedFeatures(e.point,{layers:["pts3d"]});
      let p=null;
      if(pts.length){const q=pts[0].properties;p={kind:q.cat==1?"muni":"muniES",id:q.nom}}
      else{const fs=map.queryRenderedFeatures(e.point,{layers:["prov3d","tierra"]});if(!fs.length)return;const q=fs[0].properties;
        if(modo==="comunidades")p={kind:"ccaa",id:q.c};
        else p=CAT_COD[q.n]?{kind:"prov",id:CAT_COD[q.n]}:{kind:"provES",id:q.n}}
      popup.remove();opts.alElegir&&opts.alElegir(p);
    });
    map.on("dragstart",()=>parar());
    let tz=null;map.on("zoomend",()=>{clearTimeout(tz);tz=setTimeout(pintar,60)});
    const tema=()=>{if(!listo)return;const c=colores();map.setPaintProperty("fondo","background-color",c.mar);map.setPaintProperty("tierra","fill-color",c.tierra);
      map.setPaintProperty("prov3d","fill-extrusion-color",["interpolate",["linear"],["coalesce",["feature-state","v"],0],0,c.tierra,0.0001,c.c1,0.45,c.c2,1,c.c3]);
      map.setPaintProperty("borde","line-color",["case",["boolean",["feature-state","sel"],false],c.fg,c.borde]);pintar()};
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change",tema);
    window.addEventListener("radar:tema",tema);
  }
  function girar(){if(!map||!girando)return;map.rotateTo((map.getBearing()+0.12)%360,{duration:0});requestAnimationFrame(girar)}
  function parar(){girando=false;opts&&opts.alGirar&&opts.alGirar(false)}

  window.Mapa3D={
    soporta,
    async iniciar(o){
      opts=o;if(!soporta())throw new Error("Sin WebGL");
      await Promise.all([cargar(BASE+"vendor/maplibre/maplibre-gl.css","css"),cargar(BASE+"vendor/maplibre/maplibre-gl.js"),window.MAPA_DATOS?null:cargar(BASE+"mapa-datos.js")]);
      D=window.MAPA_DATOS;iniciarMapa();
    },
    actualizar(rows,p){filas=rows||[];lugar=p||null;pintar()},
    enfocar,volar,
    modo(m){if(m){modo=m;try{localStorage.setItem("rp_m3",m)}catch(_){}pintar();if(map)map.easeTo({pitch:m==="municipios"?55:48,duration:lento()?0:700})}return modo},
    plano(si){if(map)map.easeTo({pitch:si?0:48,bearing:si?0:-12,duration:lento()?0:900})},
    girar(si){girando=si===undefined?!girando:si;if(girando)girar();return girando},
    redimensionar(){map&&map.resize()},
    munisCat(){return (window.MAPA_DATOS||{}).munisCat||{}},
  };
})();
