/* Radar de Plazas · mapa (MapLibre GL servido desde /vendor) con mapa base de OpenFreeMap:
   relieve, agua, bosques y carreteras como un mapa de navegación, y encima las plazas.
   El nivel depende del zoom, como en cualquier mapa: lejos se ven comunidades, más cerca provincias
   y al acercarse, municipios. Las etiquetas nunca se pisan y los municipios cercanos se agrupan.
   Si el mapa base no carga, se usa un fondo propio; si no hay WebGL, la página usa el mapa plano. */
(function(){
  const BASE=(document.currentScript&&document.currentScript.src||"").replace(/mapa3d\.js.*$/,"");
  const ESTILO_BASE="https://tiles.openfreemap.org/styles/liberty";
  const DEM="https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png";
  const NORM=s=>(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
  const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const lento=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
  const VISTAS={"España":[[-9.6,35.8],[4.5,43.9]],"Canarias":[[-18.3,27.5],[-13.3,29.5]]};
  const CAT_PROV={8:"Barcelona",17:"Girona",25:"Lleida",43:"Tarragona"},CAT_COD={Barcelona:8,Girona:17,Lleida:25,Tarragona:43};
  const Z_PROV=6.3,Z_MUNI=7.9; // a partir de estos zooms se ven provincias y municipios
  const C={tierra:"#f3f1ec",agua:"#a9d3f4",linea:"#5d6778",acento:"#2f6feb",urgente:"#e5484d",pronto:"#e8890c",ok:"#1e9e6a",gris:"#8a93a3"};
  const CSS_ETQ=`
.m3-et{display:flex;gap:6px;align-items:baseline;white-space:nowrap;font:600 13px/1.1 var(--font-body);color:#1d2433;background:#fff;border:0;border-radius:999px;padding:5px 10px;box-shadow:0 1px 2px rgba(29,36,51,.18),0 2px 8px rgba(29,36,51,.12);cursor:pointer;transition:opacity .15s}
.m3-et b{font-weight:800;color:#2f6feb;font-variant-numeric:tabular-nums}
.m3-et.cero{background:rgba(255,255,255,.85);color:#657084;font-weight:500;font-size:12px;padding:3px 8px;box-shadow:0 1px 2px rgba(29,36,51,.12)}
.m3-et.elegida{background:#2f6feb;color:#fff}.m3-et.elegida b{color:#fff}
.m3-et.tenue{background:none;box-shadow:none;padding:0;font:600 12px/1 var(--font-body);color:#4b5466;pointer-events:none;text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff}
.m3-mk{position:relative;width:calc(var(--r)*2);height:calc(var(--r)*2);padding:0;border:0;background:none;cursor:pointer}
.m3-mk i{position:absolute;inset:0;border-radius:50%;background:var(--c);border:2px solid #fff;box-shadow:0 1px 4px rgba(29,36,51,.35);color:#fff;font:800 12px/1 var(--font-body);font-style:normal;display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums}
.m3-mk.grupo i{box-shadow:0 0 0 2px #fff,0 0 0 3.5px var(--c),0 2px 5px rgba(29,36,51,.3)}
.m3-mk.elegida i{border:3px solid #1d2433}
.m3-mk span{position:absolute;white-space:nowrap;font:600 12.5px/1 var(--font-body);color:#1d2433;background:#fff;padding:4px 7px;border-radius:999px;box-shadow:0 1px 3px rgba(29,36,51,.2);pointer-events:none;transition:opacity .15s}
.m3-mk span small{font-weight:700;color:#657084;font-size:11.5px}
.m3-mk span.der{left:calc(100% + 4px);top:50%;transform:translateY(-50%)}
.m3-mk span.izq{right:calc(100% + 4px);top:50%;transform:translateY(-50%)}
.m3-mk span.arr{bottom:calc(100% + 4px);left:50%;transform:translateX(-50%)}
.m3-mk span.aba{top:calc(100% + 4px);left:50%;transform:translateX(-50%)}
.m3-mk.elegida span{background:#1d2433;color:#fff}
.m3-zoom .m3-mk span,.m3-zoom .m3-et{opacity:0}
.m3-yo{width:18px;height:18px;border-radius:50%;background:#2f6feb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(47,111,235,.2),0 1px 4px rgba(0,0,0,.3)}`;
  let map=null,D=null,opts=null,filas=[],lugar=null,etiquetas=[],listo=false,yo=null,nivel="comunidades",conBase=false,capasBase={};

  function soporta(){try{const c=document.createElement("canvas");return !!(window.WebGLRenderingContext&&(c.getContext("webgl2")||c.getContext("webgl")))}catch(_){return false}}
  function cargar(src,tipo){return new Promise((ok,ko)=>{if(tipo==="css"){const l=document.createElement("link");l.rel="stylesheet";l.href=src;l.onload=ok;l.onerror=ok;document.head.appendChild(l);return}
    const s=document.createElement("script");s.src=src;s.async=true;s.onload=ok;s.onerror=()=>ko(new Error("No se pudo cargar "+src));document.head.appendChild(s)})}
  const nivelDe=z=>z<Z_PROV?"comunidades":z<Z_MUNI?"provincias":"municipios";
  const arriba=()=>opts&&opts.margenArriba?opts.margenArriba():0;

  // ---------- límites: segmentos compartidos entre provincias (si separan dos comunidades, frontera de comunidad) ----------
  let LIM=null;
  function limites(){
    if(LIM)return LIM;
    const seg=new Map();
    for(const f of D.provincias.features){const c=f.properties.c;
      for(const pol of f.geometry.coordinates)for(const ring of pol)for(let i=0;i<ring.length-1;i++){
        const a=ring[i],b=ring[i+1],ka=a[0]+","+a[1],kb=b[0]+","+b[1];if(ka===kb)continue;
        const k=ka<kb?ka+"|"+kb:kb+"|"+ka,e=seg.get(k);if(e){e.n++;e.cs.add(c)}else seg.set(k,{a,b,n:1,cs:new Set([c])})}}
    const cc=[],pr=[];for(const e of seg.values()){if(e.n<2)continue;(e.cs.size>1?cc:pr).push([e.a,e.b])}
    const fc=l=>({type:"FeatureCollection",features:[{type:"Feature",properties:{},geometry:{type:"MultiLineString",coordinates:l}}]});
    return LIM={ccaa:fc(cc),prov:fc(pr)};
  }

  // ---------- estilo: mapa base de OpenFreeMap aligerado, o fondo propio si no carga ----------
  async function estiloBase(){
    try{
      const r=await Promise.race([fetch(ESTILO_BASE),new Promise((_,ko)=>setTimeout(()=>ko(new Error("lento")),7000))]);
      if(!r.ok)throw new Error(String(r.status));
      return ajustarBase(await r.json());
    }catch(_){return null}
  }
  function ajustarBase(st){
    // Fuera lo que mete ruido: puntos de interés, nombres y escudos de carreteras, flechas, edificios 3D, aeropuertos
    const fuera=/^(poi_|highway-|road_shield|road_one_way|airport|building-3d|label_other|aeroway_|tunnel_|road_area_pattern|park_outline)/;
    st.layers=st.layers.filter(l=>!fuera.test(l.id));
    for(const l of st.layers){
      l.paint=l.paint||{};l.layout=l.layout||{};
      if(l.id==="background")l.paint["background-color"]=C.tierra;
      if(l.id==="water")l.paint["fill-color"]=C.agua;
      if(/^waterway/.test(l.id)&&l.type==="line")l.paint["line-color"]=C.agua;
      if(l.id==="natural_earth")l.paint["raster-opacity"]=["interpolate",["linear"],["zoom"],0,0.75,6,0.55,8,0.25];
      if(l.type==="symbol"&&/^label_/.test(l.id)){l.paint["text-color"]="#4b5466";l.paint["text-halo-color"]="#ffffff";l.paint["text-halo-width"]=1.4}
      if(/^water_name/.test(l.id)){l.paint["text-color"]="#3f78b5";l.paint["text-halo-color"]="rgba(255,255,255,.7)"}
      if(/^boundary/.test(l.id))l.paint["line-color"]="#9aa3b2";
    }
    // Relieve: sombreado del terreno con el modelo de elevación abierto (Terrarium)
    st.sources.dem={type:"raster-dem",tiles:[DEM],encoding:"terrarium",tileSize:256,maxzoom:12,attribution:"Relieve: Mapzen Terrain Tiles"};
    const iAgua=st.layers.findIndex(l=>/^waterway|^water$/.test(l.id));
    st.layers.splice(iAgua<0?2:iAgua,0,{id:"relieve",type:"hillshade",source:"dem",paint:{"hillshade-exaggeration":0.4,"hillshade-shadow-color":"#5f6b7c","hillshade-highlight-color":"#ffffff","hillshade-accent-color":"#7c8798","hillshade-illumination-direction":315}});
    return st;
  }
  function estiloPropio(){return{version:8,sources:{},layers:[{id:"fondo",type:"background",paint:{"background-color":C.agua}}]}}

  function capasPropias(){
    const L=limites(),antes=map.getStyle().layers.find(l=>l.type==="symbol")?.id;
    const add=capa=>map.addLayer(capa,antes);
    map.addSource("prov",{type:"geojson",data:D.provincias,promoteId:"n"});
    map.addSource("limCcaa",{type:"geojson",data:L.ccaa});
    map.addSource("limProv",{type:"geojson",data:L.prov});
    map.addSource("radio",{type:"geojson",data:{type:"FeatureCollection",features:[]}});
    if(!conBase){add({id:"tierra",type:"fill",source:"prov",paint:{"fill-color":C.tierra}});add({id:"costa",type:"line",source:"prov",paint:{"line-color":"#8fbde3","line-width":0.8}})}
    // Zona elegida: un velo azul muy suave
    add({id:"zona-sel",type:"fill",source:"prov",filter:["==",["get","n"],""],paint:{"fill-color":C.acento,"fill-opacity":0.1}});
    add({id:"zona-toque",type:"fill",source:"prov",paint:{"fill-color":"#000","fill-opacity":0}});
    add({id:"lim-prov",type:"line",source:"limProv",minzoom:5,layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":C.linea,"line-opacity":["interpolate",["linear"],["zoom"],5,0.25,8,0.45],
      "line-width":["interpolate",["linear"],["zoom"],5,0.6,8,1.2,11,1.8],"line-dasharray":[2,2]}});
    add({id:"lim-ccaa",type:"line",source:"limCcaa",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":C.linea,"line-opacity":0.7,
      "line-width":["interpolate",["linear"],["zoom"],4,1,7,1.8,10,2.6]}});
    add({id:"sel",type:"line",source:"prov",filter:["==",["get","n"],""],layout:{"line-join":"round"},paint:{"line-color":C.acento,"line-width":2.6}});
    add({id:"radio-f",type:"fill",source:"radio",paint:{"fill-color":C.acento,"fill-opacity":0.08}});
    add({id:"radio-l",type:"line",source:"radio",paint:{"line-color":C.acento,"line-width":1.6,"line-dasharray":[2,2]}});
    capasBase={};
    for(const l of map.getStyle().layers)if(/^label_/.test(l.id))capasBase[l.id]=1;
  }
  // Nombres del mapa base: con comunidades y provincias los sustituyen los nuestros; al acercarse, sirven de referencia
  function nombresBase(){
    if(!conBase)return;
    const ver=id=>nivel==="municipios"?/^label_(village|town|city|city_capital|country)/.test(id):/^label_country/.test(id);
    for(const id in capasBase)try{map.setLayoutProperty(id,"visibility",ver(id)?"visible":"none")}catch(_){}
  }

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

  function pintar(){
    if(!listo)return;
    const sel=lugar||{};
    let filtro=["==",["get","n"],""];
    if(sel.kind==="ccaa")filtro=["==",["get","c"],sel.id];
    else if(sel.kind==="provES")filtro=["==",["get","n"],sel.id];
    else if(sel.kind==="prov")filtro=["==",["get","n"],CAT_PROV[sel.id]||""];
    map.setFilter("sel",filtro);map.setFilter("zona-sel",filtro);
    map.getSource("radio").setData(sel.kind==="cerca"?{type:"FeatureCollection",features:[circulo(sel.lon,sel.lat,sel.km)]}:{type:"FeatureCollection",features:[]});
    if(yo){yo.remove();yo=null}
    if(sel.kind==="cerca"){const el=document.createElement("div");el.className="m3-yo";el.title=sel.id;yo=new maplibregl.Marker({element:el}).setLngLat([sel.lon,sel.lat]).addTo(map)}
    nombresBase();leyenda();etiquetar();
  }
  function circulo(lon,lat,km){const pts=[];const dx=km/(111.32*Math.cos(lat*Math.PI/180)),dy=km/110.57;for(let i=0;i<=64;i++){const a=2*Math.PI*i/64;pts.push([lon+dx*Math.cos(a),lat+dy*Math.sin(a)])}
    return {type:"Feature",properties:{},geometry:{type:"Polygon",coordinates:[pts]}}}

  // ---------- etiquetas sin solapes ----------
  let lienzo=null;
  function ancho(txt,font){lienzo=lienzo||document.createElement("canvas").getContext("2d");lienzo.font=font;return Math.ceil(lienzo.measureText(txt).width)}
  const choca=(b,occ)=>{for(const o of occ)if(b[0]<o[2]&&b[2]>o[0]&&b[1]<o[3]&&b[3]>o[1])return o;return null};
  const fmt=n=>Number(n).toLocaleString("es-ES");
  const esc=s=>String(s).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[m]);
  const colorPlazo=d=>d<0?C.gris:d<=3?C.urgente:d<=7?C.pronto:C.ok;
  function etiquetar(){
    if(!listo)return;
    for(const e of etiquetas)e.remove();etiquetas=[];
    const {porProv,porCcaa,porMuni}=contar();
    const w=map.getCanvas().clientWidth,h=map.getCanvas().clientHeight,ocupadas=[];
    // Lo que tapan los controles flotantes (buscador arriba, botones abajo a la derecha) queda libre
    ocupadas.push([0,0,w,arriba()]);ocupadas.push([w-64,h-120,w,h]);ocupadas.push([0,h-64,Math.min(w,290),h]);
    const fam=css("--font-body")||"sans-serif",fNom="600 13px "+fam,fCero="500 12px "+fam,fNum="800 13px "+fam,fTenue="600 12px "+fam;
    const dentro=p=>p.x>=-4&&p.y>=-4&&p.x<=w+4&&p.y<=h+4;
    const sel=lugar||{};
    const zona=(it,tenue)=>{
      const p0=map.project(it.ll);if(!dentro(p0))return false;
      const wn=ancho(it.nom,tenue?fTenue:it.n?fNom:fCero),wc=it.n?ancho(fmt(it.n),fNum):0,hh=tenue?14:it.n?26:21;
      const opciones=tenue?[[wn+4,1]]:it.n?[[wn+wc+26,1],[wc+20,2]]:[[wn+18,1]];
      const desp=tenue?[[0,0]]:[[0,0],[0,-22],[0,22],[-28,0],[28,0],[-24,-20],[24,20],[24,-20],[-24,20]];
      for(const [ww,tipo] of opciones)for(const [dx,dy] of desp){
        const p={x:p0.x+dx,y:p0.y+dy};
        const caja=[p.x-ww/2-3,p.y-hh/2-3,p.x+ww/2+3,p.y+hh/2+3];if(caja[0]<0||caja[2]>w||caja[1]<0||caja[3]>h||choca(caja,ocupadas))continue;
        ocupadas.push(caja);
        const el=document.createElement(tenue?"div":"button");el.className="m3-et"+(tenue?" tenue":"")+(it.sel?" elegida":"")+(it.n||tenue?"":" cero");
        el.innerHTML=(tipo!==2?`<span>${esc(it.nom)}</span>`:"")+(it.n&&!tenue?`<b>${fmt(it.n)}</b>`:"");
        el.title=`${it.nom}: ${it.n||0} ${it.n==1?"plaza":"plazas"}`;
        if(!tenue){el.type="button";el.setAttribute("aria-label",el.title+". Toca para ver la zona");el.addEventListener("click",ev=>{ev.stopPropagation();elegirZona(it.props)})}
        etiquetas.push(new maplibregl.Marker({element:el,anchor:"center",offset:[dx,dy]}).setLngLat(it.ll).addTo(map));return true;
      }
      return false;
    };
    if(nivel!=="municipios"){
      const items=[];
      if(nivel==="comunidades"){const vistas=new Set();
        for(const f of D.provincias.features){const cc=f.properties.c;if(vistas.has(cc)||!D.ccaa[cc])continue;vistas.add(cc);
          items.push({ll:D.ccaa[cc],nom:cc,n:porCcaa.get(cc)||0,props:{c:cc},sel:sel.kind==="ccaa"&&sel.id===cc})}}
      else for(const f of D.provincias.features){const pn=f.properties.n,p=D.centros[pn];if(!p)continue;
        items.push({ll:p,nom:pn,n:porProv.get(NORM(pn))||0,props:f.properties,sel:(sel.kind==="provES"&&sel.id===pn)||(sel.kind==="prov"&&CAT_PROV[sel.id]===pn)})}
      items.sort((a,b)=>(b.sel-a.sel)||(b.n-a.n));
      for(const it of items)zona(it,false);
      return;
    }
    // ----- municipios: el más grande de cada grupo da nombre al grupo («Barcelona +12») -----
    const lista=[...porMuni.values()].map(g=>({...g,p:map.project([g.lon,g.lat]),sel:(sel.kind==="muni"&&g.cat&&sel.id===g.nom)||(sel.kind==="muniES"&&!g.cat&&sel.id===g.nom)}))
      .filter(g=>dentro(g.p)).sort((a,b)=>(b.sel-a.sel)||(b.n-a.n));
    const grupos=[];
    for(const g of lista){
      const r=Math.max(g.n>1?7+String(g.n).length*3.6:6.5,Math.min(16,6+Math.sqrt(g.n)*1.4)),x=g.p.x,y=g.p.y;
      const R=r+5,punto=[x-R,y-R,x+R,y+R];
      const otro=choca(punto,ocupadas);
      if(otro&&otro.g&&!g.sel){const G=otro.g;G.n+=g.n;G.extra++;if(G.extra<4)G.otros.push(g.nom);if(g.d<G.d)G.d=g.d;continue}
      if(otro&&!g.sel)continue;
      const G={g,n:g.n,d:g.d,extra:0,otros:[],r,lado:null};
      const wl=ancho(g.nom,fNom)+ancho(" +99",fNom)+16,hl=22;
      for(const [lado,caja] of [["der",[x+R,y-hl/2,x+R+wl,y+hl/2]],["izq",[x-R-wl,y-hl/2,x-R,y+hl/2]],["arr",[x-wl/2,y-R-hl,x+wl/2,y-R]],["aba",[x-wl/2,y+R,x+wl/2,y+R+hl]]]){
        if(caja[0]<0||caja[2]>w||caja[1]<0||caja[3]>h)continue;
        if(choca(caja,ocupadas))continue;
        G.lado=lado;ocupadas.push(Object.assign(caja,{g:G}));break;
      }
      ocupadas.push(Object.assign(punto,{g:G}));grupos.push(G);
      if(grupos.length>=140)break;
    }
    for(const G of grupos){
      const g=G.g,el=document.createElement("button");el.type="button";
      const n=G.n,rr=Math.min(G.r+4,Math.max(G.r,n>1?7+String(n).length*3.6:6.5));
      el.className="m3-mk"+(G.extra?" grupo":"")+(g.sel?" elegida":"");
      el.style.setProperty("--r",rr+"px");el.style.setProperty("--c",colorPlazo(G.d===999?-1:G.d));
      el.innerHTML=`<i>${n>1?fmt(n):""}</i>`+(G.lado?`<span class="${G.lado}">${esc(g.nom)}${G.extra?` <small>+${G.extra}</small>`:""}</span>`:"");
      el.title=G.extra?`${n} plazas en ${g.nom}, ${G.otros.join(", ")}${G.extra>G.otros.length?` y ${G.extra-G.otros.length} más`:""}. Toca para acercar`:`${g.nom}: ${n} ${n==1?"plaza":"plazas"}`;
      el.setAttribute("aria-label",el.title);
      el.addEventListener("click",ev=>{ev.stopPropagation();
        if(G.extra)map.easeTo({center:[g.lon,g.lat],zoom:Math.min(12,map.getZoom()+1.6),duration:lento()?0:700});
        else opts.alElegir&&opts.alElegir({kind:g.cat?"muni":"muniES",id:g.nom})});
      etiquetas.push(new maplibregl.Marker({element:el,anchor:"center"}).setLngLat([g.lon,g.lat]).addTo(map));
    }
    // Sin mapa base, los nombres de provincia sirven de referencia
    if(!conBase)for(const f of D.provincias.features){const pn=f.properties.n,p=D.centros[pn];if(p)zona({ll:p,nom:pn,n:0},true)}
  }
  function elegirZona(q){
    if(nivel==="comunidades"||!q.n){opts.alElegir&&opts.alElegir({kind:"ccaa",id:q.c});return}
    opts.alElegir&&opts.alElegir(CAT_COD[q.n]?{kind:"prov",id:CAT_COD[q.n]}:{kind:"provES",id:q.n});
  }
  function leyenda(){
    const box=opts.leyenda;if(!box)return;
    box.hidden=nivel!=="municipios";
    if(nivel==="municipios"&&!box.dataset.listo){box.dataset.listo="1";box.innerHTML=`<span><i style="background:${C.urgente}"></i>3 días</span><span><i style="background:${C.pronto}"></i>7 días</span><span><i style="background:${C.ok}"></i>más</span><span><i style="background:${C.gris}"></i>sin fecha</span>`}
  }

  // ---------- cámara ----------
  function bboxDe(feats){let a=[180,90,-180,-90];for(const f of feats)for(const pol of f.geometry.coordinates)for(const p of pol[0]){a[0]=Math.min(a[0],p[0]);a[1]=Math.min(a[1],p[1]);a[2]=Math.max(a[2],p[0]);a[3]=Math.max(a[3],p[1])}return [[a[0],a[1]],[a[2],a[3]]]}
  const relleno=()=>({top:arriba()+16,bottom:28,left:20,right:20});
  function volar(clave,zoomMax){
    if(!map)return;
    let b=VISTAS[clave];
    if(!b){const fs=D.provincias.features.filter(f=>f.properties.c===clave||f.properties.n===clave);if(fs.length)b=bboxDe(fs)}
    if(!b)return;
    map.fitBounds(b,{padding:relleno(),duration:lento()?0:1100,essential:true,maxZoom:zoomMax||9.5});
  }
  function enfocar(p){
    lugar=p;if(!map)return;pintar();
    if(!p){volar("España");return}
    if(p.kind==="ccaa")volar(p.id==="Estatal"?"España":p.id,7.6);
    else if(p.kind==="provES")volar(p.id,9.2);
    else if(p.kind==="prov")volar(CAT_PROV[p.id],9.2);
    else if(p.kind==="cerca"){const c=circulo(p.lon,p.lat,p.km);map.fitBounds(bboxDe([{geometry:{coordinates:[c.geometry.coordinates]}}]),{padding:relleno(),duration:lento()?0:1100})}
    else if(p.kind==="muni"||p.kind==="muniES"){const pt=opts.coordDeNombre&&opts.coordDeNombre(p.id,p.kind==="muni");if(pt)map.flyTo({center:[pt.lon,pt.lat],zoom:10.5,duration:lento()?0:1100,essential:true})}
  }

  async function iniciarMapa(){
    const st=await estiloBase();conBase=!!st;
    map=new maplibregl.Map({container:opts.contenedor,style:st||estiloPropio(),bounds:VISTAS["España"],fitBoundsOptions:{padding:{top:arriba()+10,bottom:10,left:10,right:10}},
      attributionControl:false,cooperativeGestures:matchMedia("(pointer: coarse)").matches,dragRotate:false,pitchWithRotate:false,renderWorldCopies:false,minZoom:3.8,maxZoom:13,maxPitch:0,
      locale:{"CooperativeGesturesHandler.WindowsHelpText":"Usa Ctrl + rueda para acercar","CooperativeGesturesHandler.MacHelpText":"Usa ⌘ + rueda para acercar","CooperativeGesturesHandler.MobileHelpText":"Usa dos dedos para mover el mapa","NavigationControl.ZoomIn":"Acercar","NavigationControl.ZoomOut":"Alejar"}});
    map.touchZoomRotate.disableRotation();
    if(!matchMedia("(pointer: coarse)").matches)map.addControl(new maplibregl.NavigationControl({showCompass:false}),"bottom-right");
    map.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:"Límites: IGN · ICGC"}),"bottom-left");
    map.on("load",()=>{capasPropias();listo=true;nivel=nivelDe(map.getZoom());pintar();opts.alCambiarNivel&&opts.alCambiarNivel(nivel);if(lugar)setTimeout(()=>enfocar(lugar),300)});
    let te=null;const reetiquetar=()=>{clearTimeout(te);te=setTimeout(()=>{if(!listo)return;const n=nivelDe(map.getZoom());if(n!==nivel){nivel=n;nombresBase();leyenda();opts.alCambiarNivel&&opts.alCambiarNivel(n)}etiquetar()},70)};
    map.on("moveend",reetiquetar);map.on("resize",reetiquetar);
    const cont=map.getContainer();map.on("zoomstart",()=>cont.classList.add("m3-zoom"));map.on("zoomend",()=>setTimeout(()=>cont.classList.remove("m3-zoom"),120));
    // Tocar una zona del mapa: entra en ella
    map.on("click",e=>{if(!listo)return;const fs=map.queryRenderedFeatures(e.point,{layers:["zona-toque"]});if(fs.length)elegirZona(fs[0].properties)});
    map.on("mousemove","zona-toque",()=>{map.getCanvas().style.cursor="pointer"});
    map.on("mouseleave","zona-toque",()=>{map.getCanvas().style.cursor=""});
  }

  window.Mapa3D={
    soporta,
    async iniciar(o){
      opts=o;if(!soporta())throw new Error("Sin WebGL");
      if(!document.getElementById("m3-css")){const st=document.createElement("style");st.id="m3-css";st.textContent=CSS_ETQ;document.head.appendChild(st)}
      await Promise.all([cargar(BASE+"vendor/maplibre/maplibre-gl.css","css"),cargar(BASE+"vendor/maplibre/maplibre-gl.js"),window.MAPA_DATOS?null:cargar(BASE+"mapa-datos.js")]);
      D=window.MAPA_DATOS;await iniciarMapa();
    },
    actualizar(rows,p){filas=rows||[];lugar=p||null;pintar()},
    enfocar,volar,
    nivel(){return nivel},
    modo(){return nivel},
    acercar(lon,lat,z){map&&map.flyTo({center:[lon,lat],zoom:z||10,duration:lento()?0:1100})},
    redimensionar(){map&&map.resize()},
  };
})();
