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
  const CSS_ETQ=".m3-et{display:flex;gap:5px;align-items:baseline;white-space:nowrap;font:600 12.5px/1.15 var(--font-body);color:var(--fg);background:var(--surface);background:color-mix(in srgb,var(--surface) 92%,transparent);border:1px solid var(--line);border-radius:8px;padding:3px 8px;box-shadow:0 1px 3px rgba(0,0,0,.14);cursor:pointer;transition:opacity .15s}.m3-et b{font:700 14px/1 var(--font-display);color:var(--accent);font-variant-numeric:tabular-nums}.m3-et.cero{opacity:.8;font-weight:500;font-size:11.5px;padding:2px 6px;color:var(--muted)}.m3-et.elegida{background:var(--fg);color:var(--surface);border-color:var(--fg)}.m3-et.elegida b{color:var(--surface)}.m3-et.tenue{background:none;border:0;box-shadow:none;padding:0;font:700 11px/1 var(--font-body);letter-spacing:.12em;color:var(--muted);opacity:.85;pointer-events:none;text-shadow:0 0 3px var(--surface),0 0 3px var(--surface)}.m3-mk{position:relative;width:calc(var(--r)*2);height:calc(var(--r)*2);padding:0;border:0;background:none;cursor:pointer}.m3-mk i{position:absolute;inset:0;border-radius:50%;background:var(--c);border:2px solid var(--surface);box-shadow:0 1px 3px rgba(0,0,0,.3);color:#fff;font:700 12.5px/1 var(--font-display);font-style:normal;display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums;text-shadow:0 1px 1px rgba(0,0,0,.35)}.m3-mk.grupo i{box-shadow:0 0 0 1.5px var(--surface),0 0 0 3px var(--c),0 2px 4px rgba(0,0,0,.3)}.m3-mk.elegida i{border:3px solid var(--fg)}.m3-mk span{position:absolute;white-space:nowrap;font:600 12.5px/1 var(--font-body);color:var(--fg);background:var(--surface);background:color-mix(in srgb,var(--surface) 90%,transparent);padding:3px 6px;border-radius:6px;box-shadow:0 1px 2px rgba(0,0,0,.14);pointer-events:none;transition:opacity .15s}.m3-mk span small{font-weight:700;color:var(--muted);font-size:11.5px}.m3-mk span.der{left:calc(100% + 3px);top:50%;transform:translateY(-50%)}.m3-mk span.izq{right:calc(100% + 3px);top:50%;transform:translateY(-50%)}.m3-mk span.arr{bottom:calc(100% + 3px);left:50%;transform:translateX(-50%)}.m3-mk span.aba{top:calc(100% + 3px);left:50%;transform:translateX(-50%)}.m3-mk.elegida span{background:var(--fg);color:var(--surface)}.m3-zoom .m3-mk span,.m3-zoom .m3-et{opacity:0}";
  let map=null,D=null,opts=null,modo="comunidades",filas=[],lugar=null,etiquetas=[],popup=null,listo=false,yo=null,tramos=[1,2,3,4,5];
  try{modo=localStorage.getItem("rp_m3")||"comunidades"}catch(_){}

  function soporta(){try{const c=document.createElement("canvas");return !!(window.WebGLRenderingContext&&(c.getContext("webgl2")||c.getContext("webgl")))}catch(_){return false}}
  function cargar(src,tipo){return new Promise((ok,ko)=>{if(tipo==="css"){const l=document.createElement("link");l.rel="stylesheet";l.href=src;l.onload=ok;l.onerror=ok;document.head.appendChild(l);return}
    const s=document.createElement("script");s.src=src;s.async=true;s.onload=ok;s.onerror=()=>ko(new Error("No se pudo cargar "+src));document.head.appendChild(s)})}
  const paleta=()=>oscuro()?TRAMOS_OSCURO:TRAMOS_CLARO;
  function colores(){return {mar:css("--sea"),tierra:css("--land"),borde:css("--border-com"),fg:css("--fg"),surface:css("--surface"),
    urgente:css("--urgent"),pronto:css("--soon"),ok:css("--ok"),gris:css("--muted")}}
  const colorTramo=()=>{const p=paleta(),c=colores();return ["match",["coalesce",["feature-state","t"],0],1,p[0],2,p[1],3,p[2],4,p[3],5,p[4],c.tierra]};
  // Límites: segmentos compartidos entre provincias; si las dos son de comunidades distintas, es frontera de comunidad
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
  function estilo(){const c=colores(),L=limites();return{version:8,
    sources:{prov:{type:"geojson",data:D.provincias,promoteId:"n"},limCcaa:{type:"geojson",data:L.ccaa},limProv:{type:"geojson",data:L.prov},
      radio:{type:"geojson",data:{type:"FeatureCollection",features:[]}}},
    light:{anchor:"map",position:[1.3,210,40],intensity:0.3},
    layers:[
      {id:"fondo",type:"background",paint:{"background-color":c.mar}},
      {id:"relieve",type:"fill-extrusion",source:"prov",paint:{"fill-extrusion-color":colorTramo(),
        "fill-extrusion-height":["*",["coalesce",["feature-state","t"],0],["coalesce",["feature-state","k"],0]],"fill-extrusion-opacity":0.97,"fill-extrusion-vertical-gradient":false}},
      {id:"costa",type:"line",source:"prov",paint:{"line-color":c.borde,"line-width":0.7,"line-opacity":0.7}},
      {id:"lim-prov",type:"line",source:"limProv",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":c.fg,"line-opacity":0.35,
        "line-width":["interpolate",["linear"],["zoom"],4,0.5,7,1,10,1.6],"line-dasharray":[3,2]}},
      {id:"lim-ccaa",type:"line",source:"limCcaa",layout:{"line-cap":"round","line-join":"round"},paint:{"line-color":c.fg,"line-opacity":0.75,
        "line-width":["interpolate",["linear"],["zoom"],4,1.1,7,2,10,3]}},
      {id:"sel",type:"line",source:"prov",filter:["==",["get","n"],""],layout:{"line-join":"round"},paint:{"line-color":c.fg,"line-width":3}},
      {id:"radio-f",type:"fill",source:"radio",paint:{"fill-color":c.fg,"fill-opacity":0.06}},
      {id:"radio-l",type:"line",source:"radio",paint:{"line-color":c.fg,"line-width":1.6,"line-dasharray":[2,2]}},
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
    const z=map.getZoom(),k=Math.min(6000,Math.max(800,2600*Math.pow(2,(5.5-z)*0.8)))*(modo==="municipios"?0:1);
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
  // Cada zona lleva su nombre y su número; si no cabe, solo el número; si tampoco, nada (se ve al acercar).
  // Los municipios que se pisan se juntan con el más grande de alrededor: «Barcelona +12».
  let lienzo=null;
  function ancho(txt,font){lienzo=lienzo||document.createElement("canvas").getContext("2d");lienzo.font=font;return Math.ceil(lienzo.measureText(txt).width)}
  const choca=(b,occ)=>{for(const o of occ)if(b[0]<o[2]&&b[2]>o[0]&&b[1]<o[3]&&b[3]>o[1])return o;return null};
  const fmt=n=>Number(n).toLocaleString("es-ES");
  function colorPlazo(d,c){return d<0?c.gris:d<=3?c.urgente:d<=7?c.pronto:c.ok}
  function etiquetar(){
    if(!listo)return;
    for(const e of etiquetas)e.remove();etiquetas=[];
    const {porProv,porCcaa,porMuni}=contar(),c=colores();
    const w=map.getCanvas().clientWidth,h=map.getCanvas().clientHeight,ocupadas=[];
    const fNom="600 12.5px "+css("--font-body"),fCero="500 11.5px "+css("--font-body"),fNum="700 14px "+css("--font-display");
    const dentro=p=>p.x>=-4&&p.y>=-4&&p.x<=w+4&&p.y<=h+4;
    const sel=lugar||{};
    const poner=(ll,el,cls)=>{etiquetas.push(new maplibregl.Marker({element:el,anchor:"center",className:cls}).setLngLat(ll).addTo(map))};
    // Etiqueta de zona (comunidad o provincia)
    const zona=(it,tenue)=>{
      const p0=map.project(it.ll);if(!dentro(p0))return false;
      const f=it.n||tenue?fNom:fCero,wn=ancho(it.nom,f),wc=it.n?ancho(fmt(it.n),fNum):0,hh=it.n?22:19;
      const opciones=tenue?[[wn+4,0]]:it.n?[[wn+wc+22,1],[wc+16,2]]:[[wn+12,1]];
      const desp=tenue?[[0,0]]:[[0,0],[0,-20],[0,20],[-26,0],[26,0],[-22,-18],[22,18],[22,-18],[-22,18]];
      for(const [ww,tipo] of opciones)for(const [dx,dy] of desp){
        const p={x:p0.x+dx,y:p0.y+dy};
        const caja=[p.x-ww/2-2,p.y-hh/2-2,p.x+ww/2+2,p.y+hh/2+2];if(caja[0]<0||caja[2]>w||caja[1]<0||caja[3]>h||choca(caja,ocupadas))continue;
        ocupadas.push(caja);
        const el=document.createElement(tenue?"div":"button");el.className="m3-et"+(tenue?" tenue":"")+(it.sel?" elegida":"")+(it.n?"":" cero");
        el.innerHTML=(tipo!==2?`<span>${esc(it.nom)}</span>`:"")+(it.n&&!tenue?`<b>${fmt(it.n)}</b>`:"");
        el.title=`${it.nom}: ${it.n||0} ${it.n==1?"plaza":"plazas"}`;
        if(!tenue){el.type="button";el.setAttribute("aria-label",el.title);el.addEventListener("click",ev=>{ev.stopPropagation();elegirZona(it.props)})}
        etiquetas.push(new maplibregl.Marker({element:el,anchor:"center",offset:[dx,dy]}).setLngLat(it.ll).addTo(map));return true;
      }
      return false;
    };
    if(modo==="comunidades"||modo==="provincias"){
      let items=[];
      if(modo==="comunidades"){const vistas=new Set();
        for(const f of D.provincias.features){const cc=f.properties.c;if(vistas.has(cc)||!D.ccaa[cc])continue;vistas.add(cc);
          items.push({ll:D.ccaa[cc],nom:cc,n:porCcaa.get(cc)||0,props:f.properties,sel:sel.kind==="ccaa"&&sel.id===cc})}}
      else for(const f of D.provincias.features){const pn=f.properties.n,p=D.centros[pn];if(!p)continue;
        items.push({ll:p,nom:pn,n:porProv.get(NORM(pn))||0,props:f.properties,sel:(sel.kind==="provES"&&sel.id===pn)||(sel.kind==="prov"&&CAT_PROV[sel.id]===pn)||(sel.kind==="ccaa"&&sel.id===f.properties.c&&false)})}
      items.sort((a,b)=>(b.sel-a.sel)||(b.n-a.n));
      for(const it of items)zona(it,false);
      return;
    }
    // ----- municipios -----
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
      // Nombre a la derecha, izquierda, arriba o abajo; si no cabe, solo el punto
      const wl=ancho(g.nom,fNom)+ancho(" +99",fNom)+14,hl=20;
      for(const [lado,caja] of [["der",[x+R,y-hl/2,x+R+wl,y+hl/2]],["izq",[x-R-wl,y-hl/2,x-R,y+hl/2]],["arr",[x-wl/2,y-R-hl,x+wl/2,y-R]],["aba",[x-wl/2,y+R,x+wl/2,y+R+hl]]]){
        if(caja[0]<0||caja[2]>w||caja[1]<0||caja[3]>h)continue;
        if(choca(caja,ocupadas))continue;
        G.lado=lado;ocupadas.push(Object.assign(caja,{g:G}));break;
      }
      ocupadas.push(Object.assign(punto,{g:G}));grupos.push(G);
      if(grupos.length>=160)break;
    }
    for(const G of grupos){
      const g=G.g,el=document.createElement("button");el.type="button";
      const n=G.n,rr=Math.min(G.r+4,Math.max(G.r,n>1?7+String(n).length*3.6:6.5));
      el.className="m3-mk"+(G.extra?" grupo":"")+(g.sel?" elegida":"");
      el.style.setProperty("--r",rr+"px");el.style.setProperty("--c",colorPlazo(G.d===999?-1:G.d,c));
      el.innerHTML=`<i>${n>1?fmt(n):""}</i>`+(G.lado?`<span class="${G.lado}">${esc(g.nom)}${G.extra?` <small>+${G.extra}</small>`:""}</span>`:"");
      el.title=G.extra?`${n} plazas en ${g.nom}, ${G.otros.join(", ")}${G.extra>G.otros.length?` y ${G.extra-G.otros.length} más`:""} · toca para acercar`:`${g.nom}: ${n} ${n==1?"plaza":"plazas"}`;
      el.setAttribute("aria-label",el.title);
      el.addEventListener("click",ev=>{ev.stopPropagation();popup&&popup.remove();
        if(G.extra)map.easeTo({center:[g.lon,g.lat],zoom:Math.min(12,map.getZoom()+1.6),duration:lento()?0:700});
        else opts.alElegir&&opts.alElegir({kind:g.cat?"muni":"muniES",id:g.nom})});
      poner([g.lon,g.lat],el);
    }
    // Nombres de provincia de fondo donde quede sitio
    for(const f of D.provincias.features){const pn=f.properties.n,p=D.centros[pn];if(p)zona({ll:p,nom:pn.toUpperCase(),n:porProv.get(NORM(pn))||0},true)}
  }
  const esc=s=>String(s).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[m]);
  function elegirZona(q){
    popup&&popup.remove();
    if(modo==="comunidades"){cambiarModo("provincias");opts.alElegir&&opts.alElegir({kind:"ccaa",id:q.c})}
    else{if(modo==="provincias")cambiarModo("municipios");opts.alElegir&&opts.alElegir(CAT_COD[q.n]?{kind:"prov",id:CAT_COD[q.n]}:{kind:"provES",id:q.n})}
  }
  function leyenda(estatal){
    const box=opts.leyenda;if(!box)return;
    const c=colores(),p=paleta();
    if(modo==="municipios"){
      box.innerHTML=`<span><i style="background:${c.urgente}"></i>cierra en 3 días o menos</span><span><i style="background:${c.pronto}"></i>en 7 días o menos</span><span><i style="background:${c.ok}"></i>más tiempo</span><span><i style="background:${c.gris}"></i>sin plazo</span><span><b>+3</b> = y 3 municipios cercanos · toca para acercar</span>`;
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
    // Mientras se hace zoom, los nombres se ocultan para que no se vean montados
    const cont=map.getContainer();map.on("zoomstart",()=>cont.classList.add("m3-zoom"));map.on("zoomend",()=>setTimeout(()=>cont.classList.remove("m3-zoom"),120));
    let tz=null;map.on("zoomend",()=>{clearTimeout(tz);tz=setTimeout(pintar,60)});
    // Información al pasar el ratón (en el móvil, al tocar se entra directamente)
    const info=f=>{const p=f.properties,{porProv,porCcaa}=contar();
      if(p.cluster)return `<b>${p.n} plazas</b><br>en ${p.point_count} municipios · toca para acercar`;
      if(p.nom)return `<b>${p.nom}</b><br>${p.n} ${p.n==1?"plaza":"plazas"}`;
      if(modo==="comunidades")return `<b>${p.c}</b><br>${porCcaa.get(p.c)||0} plazas`;
      return `<b>${p.n}</b><br>${porProv.get(NORM(p.n))||0} plazas · ${p.c}`};
    if(!matchMedia("(pointer: coarse)").matches)for(const capa of ["relieve"]){
      map.on("mousemove",capa,e=>{const f=e.features&&e.features[0];if(!f)return;map.getCanvas().style.cursor="pointer";popup.setLngLat(e.lngLat).setHTML(info(f)).addTo(map)});
      map.on("mouseleave",capa,()=>{map.getCanvas().style.cursor="";popup.remove()});
    }
    // Tocar: de lo general a lo concreto
    map.on("click",e=>{
      popup.remove();
      const fs=map.queryRenderedFeatures(e.point,{layers:["relieve"]});if(!fs.length)return;
      elegirZona(fs[0].properties);
    });
    const tema=()=>{if(!listo)return;map.setStyle(estilo());map.once("styledata",()=>setTimeout(pintar,50))};
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change",tema);
  }

  window.Mapa3D={
    soporta,
    async iniciar(o){
      opts=o;if(!soporta())throw new Error("Sin WebGL");
      if(!document.getElementById("m3-css")){const st=document.createElement("style");st.id="m3-css";st.textContent=CSS_ETQ;document.head.appendChild(st)}
      await Promise.all([cargar(BASE+"vendor/maplibre/maplibre-gl.css","css"),cargar(BASE+"vendor/maplibre/maplibre-gl.js"),window.MAPA_DATOS?null:cargar(BASE+"mapa-datos.js")]);
      D=window.MAPA_DATOS;iniciarMapa();
    },
    actualizar(rows,p){filas=rows||[];lugar=p||null;pintar()},
    enfocar,volar,
    modo(m){if(m)cambiarModo(m,true);return modo},
    redimensionar(){map&&map.resize()},
  };
})();
