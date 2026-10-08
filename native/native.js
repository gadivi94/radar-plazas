/* Radar de Plazas · capa nativa de la app de iPhone (Capacitor). En la web no hace nada. */
(function(){
  var C = window.Capacitor;
  if (!(C && C.isNativePlatform && C.isNativePlatform())) return;
  var P = C.Plugins || {}, html = document.documentElement, API = (window.RADAR_API || "https://radaropos.com").replace(/\/$/, "");
  html.classList.add("nativa");

  /* 1. Sin zoom de página (el mapa tiene su propio zoom) y margen para la muesca del iPhone */
  try {
    var vp = document.querySelector("meta[name=viewport]");
    if (vp) vp.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");
    var st = document.createElement("style");
    st.textContent = "html,body{-webkit-text-size-adjust:100%;touch-action:manipulation}" +
      ".nativa .cab{padding-top:env(safe-area-inset-top)}" +
      ".nativa .pie-app{padding-bottom:env(safe-area-inset-bottom)}" +
      ".nativa [data-solo-web]{display:none!important}";
    (document.head || html).appendChild(st);
    document.addEventListener("gesturestart", function(e){ e.preventDefault(); }, { passive: false });
  } catch (e) {}

  /* 2. La app ya lleva la web dentro: sin service worker */
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = function(){ return Promise.reject(new Error("sin SW en la app")); }; } catch (e) {}

  /* 3. Enlaces de fuera (BOE, ayuntamientos, fichas de la web) en el navegador integrado */
  function abrirFuera(url){ if (P.Browser) P.Browser.open({ url: url, presentationStyle: "popover" }).catch(function(){ location.href = url; }); else location.href = url; }
  document.addEventListener("click", function(e){
    var a = e.target.closest && e.target.closest("a[href]"); if (!a) return;
    var h = a.getAttribute("href") || "";
    if (/^(mailto|tel|webcal):/i.test(h)) { e.preventDefault(); if (P.AppLauncher) P.AppLauncher.openUrl({ url: h }).catch(function(){ location.href = h; }); else location.href = h; return; }
    var u; try { u = new URL(h, location.href); } catch (_) { return; }
    var propia = u.origin === location.origin;
    // Páginas que genera el servidor: fichas, sectores
    if (propia && /^\/(plaza|oposiciones)(\/|$)/.test(u.pathname)) { e.preventDefault(); abrirFuera(API + u.pathname + u.search); return; }
    if (!propia && /^https?:$/.test(u.protocol)) { e.preventDefault(); abrirFuera(u.href); }
  }, true);
  var abrirVentana = window.open;
  window.open = function(url){ if (url && /^https?:/i.test(String(url))) { abrirFuera(String(url)); return null; } return abrirVentana.apply(window, arguments); };

  /* 4. Compartir con la hoja nativa de iOS */
  if (P.Share) navigator.share = function(d){ return P.Share.share({ title: d && d.title, text: d && d.text, url: d && d.url, dialogTitle: "Compartir plaza" }).then(function(){}); };

  /* 5. Entrar con Apple y con Google (plugin @capgo/capacitor-social-login). app.js usa window.RADAR_NATIVO */
  (function(){
    var SL = P.SocialLogin; if (!SL) return;
    var init = null, googleIos = null;
    function nonce(){ return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/-/g, ""); }
    function listo(){
      if (init) return init;
      init = fetch(API + "/api/auth/config").then(function(r){ return r.json(); }).catch(function(){ return {}; }).then(function(cfg){
        googleIos = cfg && cfg.googleIos || null;
        var o = { apple: { clientId: "com.radaropos.app" } };
        if (googleIos) o.google = { iOSClientId: googleIos, iOSServerClientId: cfg.google || undefined, mode: "online" };
        return SL.initialize(o);
      }).catch(function(e){ init = null; throw e; });
      return init;
    }
    window.RADAR_NATIVO = {
      apple: function(){ var n = nonce(); return listo().then(function(){ return SL.login({ provider: "apple", options: { scopes: ["email", "name"], nonce: n } }); })
        .then(function(r){ var x = (r && r.result) || {}, p = x.profile || {}; return { idToken: x.idToken, nombre: p.givenName || "" }; }); },
      google: function(){ return listo().then(function(){ return SL.login({ provider: "google", options: { scopes: ["email", "profile"] } }); })
        .then(function(r){ var x = (r && r.result) || {}, p = x.profile || {}; return { idToken: x.idToken, nombre: p.givenName || "" }; }); }
    };
    setTimeout(function(){ listo().catch(function(){}); }, 1500);
  })();

  /* 6. Avisos en el móvil: 3 días y 1 día antes de que cierre una plaza que sigues */
  (function(){
    var LN = P.LocalNotifications; if (!LN) return;
    var SEGUIR = { interesa: 1, presentada: 1, admitido: 1, examen: 1, bolsa: 1 };
    function idDe(s){ var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 2000000000; }
    function programar(){
      var ofertas = (typeof S !== "undefined" && S && S.ofertas) || [];
      if (typeof S === "undefined" || !S.ses) return;
      var ahora = Date.now(), lista = [];
      ofertas.forEach(function(o){
        if (!SEGUIR[o.marca] || !o.plazo_fin) return;
        var fin = new Date(o.plazo_fin + "T09:00:00");
        [[3, "Quedan 3 días"], [1, "Mañana es el último día"]].forEach(function(x){
          var at = new Date(fin.getTime() - x[0] * 864e5);
          if (at.getTime() > ahora + 60e3) lista.push({ id: idDe(o.id + ":" + x[0]), title: x[1] + " para presentarte", body: String(o.titulo).slice(0, 140), schedule: { at: at, allowWhileIdle: true }, extra: { id: o.id } });
        });
      });
      LN.getPending().then(function(p){ var viejos = (p && p.notifications || []).map(function(n){ return { id: n.id }; }); return viejos.length ? LN.cancel({ notifications: viejos }) : null; })
        .then(function(){ if (!lista.length) return; return LN.checkPermissions().then(function(s){ return s.display === "granted" ? s : LN.requestPermissions(); })
          .then(function(s){ if (s.display === "granted") return LN.schedule({ notifications: lista.slice(0, 60) }); }); })
        .catch(function(){});
    }
    window.addEventListener("radar:cargado", programar);
    window.addEventListener("radar:marca", programar);
    LN.addListener && LN.addListener("localNotificationActionPerformed", function(){ try { S.tab = "mias"; render(); } catch (_) {} });
  })();
})();
