/* Radar de Plazas · modo sin conexión: primero la red y, si falla, lo último guardado. */
const CACHE="radar-v4";
const BASE=["/","/index.html","/app.js","/app.css","/mapa3d.js","/mapa-datos.js","/geo.js","/espana.js","/sectores.js","/cumple.js","/icon-192.png","/icon-512.png","/manifest.webmanifest"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(BASE)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin)return;
  const guardar=u.pathname==="/api/ofertas"&&!e.request.headers.get("Authorization")||!u.pathname.startsWith("/api/");
  e.respondWith(fetch(e.request).then(r=>{if(r.ok&&guardar){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c))}return r})
    .catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==="navigate"?caches.match("/"):Response.error()))));
});
