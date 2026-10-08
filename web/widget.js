/* Radar de Plazas · widget para otras webs.
   <div data-radar-plazas data-sector="seguridad" data-lugar="Cataluña" data-limite="8"></div>
   <script src="https://radaropos.com/widget.js" async></script> */
(function(){
  var BASE="https://radaropos.com";
  try{var s=document.currentScript;if(s&&s.src)BASE=new URL(s.src).origin}catch(e){}
  var esc=function(t){return String(t==null?"":t).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})};
  var css="[data-radar-plazas]{font-family:system-ui,-apple-system,Segoe UI,sans-serif;border:1px solid #d3dcda;border-radius:10px;padding:12px;background:#fff;color:#14232b;max-width:560px}"+
    "[data-radar-plazas] h3{margin:0 0 8px;font-size:16px}[data-radar-plazas] h3 span{color:#0d6b6b}[data-radar-plazas] ul{list-style:none;margin:0;padding:0}"+
    "[data-radar-plazas] li{padding:8px 0;border-top:1px dashed #d3dcda}[data-radar-plazas] a{color:#14232b;text-decoration:none;font-weight:600}"+
    "[data-radar-plazas] small{display:block;color:#5b6b72;font-weight:400}[data-radar-plazas] .rp-pie{margin-top:8px;font-size:12px}[data-radar-plazas] .rp-pie a{color:#0d6b6b}";
  var st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
  function fmt(iso){var p=iso.split("-");return p[2]+"/"+p[1]+"/"+p[0]}
  Array.prototype.forEach.call(document.querySelectorAll("[data-radar-plazas]"),function(el){
    var q=[],d=el.dataset,lim=Math.min(20,+d.limite||8);
    if(d.sector)q.push("tipo="+encodeURIComponent(d.sector));
    if(d.subtipo)q.push("subtipo="+encodeURIComponent(d.subtipo));
    if(d.lugar)q.push("comunidad="+encodeURIComponent(d.lugar));
    q.push("limit="+lim);
    el.innerHTML='<h3>Radar de <span>Plazas</span></h3><p>Cargando plazas…</p>';
    fetch(BASE+"/api/ofertas?"+q.join("&")).then(function(r){return r.json()}).then(function(j){
      var items=(j.items||[]).slice(0,lim);
      el.innerHTML='<h3>Radar de <span>Plazas</span> · '+esc(j.total)+' abiertas</h3><ul>'+items.map(function(o){
        return '<li><a href="'+BASE+esc(o.ruta)+'" target="_blank" rel="noopener">'+esc(o.titulo.length>90?o.titulo.slice(0,87)+"…":o.titulo)+'<small>'+esc([o.organismo,o.municipio||o.comunidad].filter(Boolean).join(" · "))+(o.plazo_fin?" · hasta el "+fmt(o.plazo_fin):"")+'</small></a></li>'}).join("")+
        '</ul><p class="rp-pie">Alertas gratis por correo en <a href="'+BASE+'" target="_blank" rel="noopener">radaropos.com</a></p>';
    }).catch(function(){el.innerHTML='<p>No se han podido cargar las plazas. <a href="'+BASE+'">Ver en Radar de Plazas</a></p>'});
  });
})();
