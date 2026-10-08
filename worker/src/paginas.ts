// Páginas generadas en el servidor para Google y para compartir: ficha de cada plaza (/plaza/…),
// páginas por sector y lugar (/oposiciones/…) y sitemap.xml dinámico.
import { corto, rutaPlaza, slug } from "./avisos";
import { fmt } from "./classify";
import { estadoActual, hoyMadrid } from "./filters";
import { COMUNIDADES, norm, PROVINCIAS } from "./geo";
import { escHtml as e, sitio } from "./mail";
import { NIVELES, ORDEN_SECTORES, PRUEBAS_NOMBRE, SECTOR_NOMBRE, SECTORES, SUBTIPOS, type Requisitos } from "./sectores";
import type { Env, Oferta } from "./types";

const SISTEMA: Record<string, string> = { concurso: "Concurso de méritos", "concurso-oposicion": "Concurso-oposición", oposicion: "Oposición", bolsa: "Bolsa de trabajo" };
const DIF = ["", "Fácil", "Media", "Difícil"];
const lugarSlug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const LUGARES = [
  ...COMUNIDADES.filter((c) => c !== "Estatal").map((c) => ({ slug: lugarSlug(c), nombre: c, tipo: "comunidad" as const })),
  ...PROVINCIAS.filter((p) => !COMUNIDADES.includes(p.provincia as never)).map((p) => ({ slug: lugarSlug(p.provincia), nombre: p.provincia, tipo: "provincia" as const })),
];

function shell(env: Env, o: { titulo: string; desc: string; ruta: string; cuerpo: string; jsonld?: unknown[]; noindex?: boolean }): Response {
  const url = sitio(env) + o.ruta;
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(o.titulo)} · Radar de Plazas</title>
<meta name="description" content="${e(o.desc.slice(0, 160))}">
<link rel="canonical" href="${e(url)}">${o.noindex ? '\n<meta name="robots" content="noindex">' : ""}
<meta property="og:type" content="website"><meta property="og:title" content="${e(o.titulo)}"><meta property="og:description" content="${e(o.desc.slice(0, 200))}"><meta property="og:url" content="${e(url)}"><meta property="og:image" content="${sitio(env)}/icon-512.png">
<meta name="theme-color" content="#0d6b6b">
<link rel="icon" href="/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Source+Sans+3:wght@400;600;700&family=JetBrains+Mono:wght@400&display=swap">
<link rel="stylesheet" href="/legal/legal.css">
<link rel="stylesheet" href="/paginas.css">
${(o.jsonld || []).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("\n")}
</head>
<body>
<div class="wrap">
  <div class="top"><a class="marca" href="/">Radar de <span>Plazas</span></a><a class="volver" href="/">Todas las plazas →</a></div>
${o.cuerpo}
  <footer><nav aria-label="Más"><a href="/oposiciones">Por sector</a><a href="/estadisticas.html">Estadísticas</a><a href="/guias/">Guías</a><a href="/sueldos.html">Sueldos</a><a href="/legal/aviso-legal.html">Aviso legal</a><a href="/legal/privacidad.html">Privacidad</a><a href="/contacto.html">Contacto</a></nav><span>© 2026 @gadivi · Radar de Plazas. Información de fuentes oficiales (BOE, CIDO, TMB): comprueba siempre la convocatoria publicada.</span></footer>
</div>
<script src="/cumple.js"></script>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}

const lugarDe = (o: Oferta) => o.municipio || o.provincia || (o.comunidad === "Estatal" ? "Toda España" : o.comunidad) || "";
function diasHasta(fin: string, hoy: string) { return Math.round((Date.parse(fin + "T00:00:00Z") - Date.parse(hoy + "T00:00:00Z")) / 864e5); }

function plazoHtml(o: Oferta, hoy: string): string {
  const est = estadoActual(o, hoy);
  if (o.plazo_fin) {
    const n = diasHasta(o.plazo_fin, hoy);
    if (n < 0 || est === "cerrada") return `<div class="plazo cerrada"><b>Cerrada</b><span>El plazo terminó el ${fmt(o.plazo_fin)}</span></div>`;
    return `<div class="plazo ${n <= 3 ? "urgente" : n <= 7 ? "pronto" : ""}"><b>${n === 0 ? "Hoy" : n}</b><span>${n === 0 ? "último día" : n === 1 ? "día para presentar" : "días para presentar"} · hasta el ${fmt(o.plazo_fin)}${o.plazo_aprox ? " (aprox.)" : ""}</span></div>`;
  }
  return `<div class="plazo nada"><b>Sin plazo</b><span>${e(o.plazo_texto || (est === "pendiente" ? "Pendiente de que se abra el plazo" : "Consulta el plazo en la convocatoria"))}</span></div>`;
}

function filaLista(o: Oferta, hoy: string): string {
  const n = o.plazo_fin ? diasHasta(o.plazo_fin, hoy) : null;
  return `<li><a href="${e(rutaPlaza(o))}"><b class="d ${n === null ? "nada" : n <= 3 ? "urgente" : n <= 7 ? "pronto" : ""}">${n === null ? "—" : n}</b><span>${e(corto(o.titulo))}<small>${e([o.organismo, lugarDe(o)].filter(Boolean).join(" · "))}${o.plazo_fin ? ` · hasta ${fmt(o.plazo_fin)}` : ""}</small></span></a></li>`;
}

export async function paginaPlaza(env: Env, fuente: string, code: string): Promise<Response | null> {
  const id = `${fuente}:${decodeURIComponent(code)}`;
  const o = await env.DB.prepare("SELECT * FROM ofertas WHERE id = ?").bind(id).first<Oferta>();
  if (!o) return null;
  const hoy = hoyMadrid();
  const req: Requisitos = JSON.parse(o.requisitos || "{}");
  const historia: Array<{ fecha: string; texto: string }> = JSON.parse(o.historia || "[]");
  const sector = SECTOR_NOMBRE[o.tipo || "otros"] || "Otros";
  const sub = o.subtipo ? SUBTIPOS[o.subtipo]?.nombre : null;
  const titulo = corto(o.titulo);
  const ruta = rutaPlaza(o);
  const abierta = estadoActual(o, hoy) !== "cerrada" && (!o.plazo_fin || o.plazo_fin >= hoy);
  const relacionadas = (await env.DB.prepare(
    `SELECT * FROM ofertas WHERE id != ? AND tipo = ? AND COALESCE(subtipo,'') = COALESCE(?, '') AND (plazo_fin IS NULL OR plazo_fin >= ?) AND (estado IS NULL OR estado != 'cerrada')
     ORDER BY CASE WHEN comunidad = ? THEN 0 ELSE 1 END, CASE WHEN plazo_fin IS NULL THEN 1 ELSE 0 END, plazo_fin LIMIT 6`,
  ).bind(o.id, o.tipo || "otros", o.subtipo, hoy, o.comunidad || "").all<Oferta>()).results;

  const datos: Array<[string, string | null | undefined]> = [
    ["Sector", sub ? `${sector} · ${sub}` : sector],
    ["Organismo", o.organismo],
    ["Lugar", [o.municipio, o.provincia && o.provincia !== o.municipio ? o.provincia : null, o.comunidad].filter(Boolean).join(", ")],
    ["Plazas", o.plazas ? String(o.plazas) : null],
    ["Grupo", o.grupo],
    ["Estudios mínimos", o.nivel != null ? NIVELES[o.nivel] : null],
    ["Sistema de selección", o.sistema ? SISTEMA[o.sistema] || o.sistema : null],
    ["Tipo de personal", Number(o.interino) ? "Interino, temporal o bolsa" : null],
    ["Dificultad orientativa", o.dificultad ? DIF[o.dificultad] : null],
    ["Publicada", o.publicado ? fmt(o.publicado) : null],
    ["Fuente", o.fuente === "CIDO" ? "CIDO · Diputació de Barcelona" : o.fuente === "BOE" ? "Boletín Oficial del Estado" : o.fuente === "EMPRESA" ? `Web de empleo de ${o.organismo}` : "TMB"],
  ];
  const reqs: Array<[string, string | null | undefined]> = [
    ["Titulación", req.titulacion],
    ["Edad", req.edadMin || req.edadMax ? [req.edadMin && `mínimo ${req.edadMin} años`, req.edadMax && `máximo ${req.edadMax} años`].filter(Boolean).join(", ") : null],
    ["Carné de conducir", req.carne?.join(", ")],
    ["Catalán", req.catalan ? `Nivel ${req.catalan}` : null],
    ["Otro idioma", req.otroIdioma],
    ["Estatura mínima", req.altura ? "Sí (ver bases)" : null],
    ["Nacionalidad", req.nacionalidad === "es" ? "Española" : req.nacionalidad === "ue" ? "Española o de la UE" : null],
    ["Tasa de examen", req.tasa ? `${req.tasa.toFixed(2).replace(".", ",")} €` : null],
  ];
  const promo = o.tipo === "seguridad" && (o.subtipo === "mossos" || (o.comunidad === "Cataluña" && ["policia-local", "agente-civico", "vigilante"].includes(o.subtipo || "")));
  const datosOferta = { id: o.id, nivel: o.nivel, requisitos: req, comunidad: o.comunidad };
  const desc = `${titulo}. ${o.organismo || ""} ${lugarDe(o) ? "(" + lugarDe(o) + ")" : ""}. ${o.plazo_fin ? `Plazo hasta el ${fmt(o.plazo_fin)}.` : ""} Requisitos, pruebas y enlace a la solicitud.`;
  const share = encodeURIComponent(`${titulo} — ${sitio(env)}${ruta}`);

  const cuerpo = `  <nav class="migas" aria-label="Ruta"><a href="/oposiciones">Oposiciones</a> › <a href="/oposiciones/${e(o.tipo || "otros")}">${e(sector)}</a>${o.subtipo ? ` › <a href="/oposiciones/${e(o.subtipo)}">${e(sub || "")}</a>` : ""}</nav>
  <main>
    <p class="org">${e([o.organismo, lugarDe(o)].filter(Boolean).join(" · "))}</p>
    <h1>${e(titulo)}</h1>
    ${plazoHtml(o, hoy)}
    <div class="botones">
      ${o.tramite_url && abierta ? `<a class="btn primario" href="${e(o.tramite_url)}" target="_blank" rel="noopener">Presentar solicitud</a>` : ""}
      ${o.url ? `<a class="btn" href="${e(o.url)}" target="_blank" rel="noopener">Convocatoria oficial</a>` : ""}
      <a class="btn" href="/?seguir=${encodeURIComponent(o.id)}">☆ Seguir esta plaza</a>
      ${o.plazo_fin && abierta ? `<a class="btn" href="/api/ics/${e(fuente)}/${e(code)}">📅 Añadir al calendario</a>` : ""}
      <a class="btn" href="https://wa.me/?text=${share}" target="_blank" rel="noopener">Compartir por WhatsApp</a>
    </div>
    <section class="cumple" id="cumple" data-oferta='${e(JSON.stringify(datosOferta))}'><p class="note">¿Cumples los requisitos? <a href="/#perfil">Rellena tu perfil</a> y te lo decimos al momento.</p></section>

    <h2>Datos de la convocatoria</h2>
    <table class="datos">${datos.filter(([, v]) => v).map(([k, v]) => `<tr><th>${e(k)}</th><td>${e(v)}</td></tr>`).join("")}</table>
    ${o.grupo ? `<p class="note">Sueldo orientativo del grupo ${e(o.grupo)}: <a href="/sueldos.html#${e(o.grupo)}">ver calculadora de sueldos</a>.</p>` : ""}

    <h2>Requisitos</h2>
    ${reqs.some(([, v]) => v) ? `<table class="datos">${reqs.filter(([, v]) => v).map(([k, v]) => `<tr><th>${e(k)}</th><td>${e(v)}</td></tr>`).join("")}</table>` : `<p>No hemos podido leer los requisitos automáticamente. Consulta las bases en la <a href="${e(o.url || "#")}" target="_blank" rel="noopener">convocatoria oficial</a>.</p>`}
    ${req.pruebas?.length ? `<h2>Pruebas</h2><div class="chips">${req.pruebas.map((p) => `<span class="chip">${e(PRUEBAS_NOMBRE[p] || p)}</span>`).join("")}</div>` : ""}
    ${o.resumen ? `<p class="note">${e(o.resumen)}</p>` : ""}
    <p class="nota">Datos extraídos automáticamente del texto oficial: pueden contener errores. Lo que vale es lo que dicen las bases publicadas.</p>

    <h2>Resumen con IA</h2>
    <section class="ia" id="ia" data-ruta="${e(fuente)}/${e(code)}">
      <p class="note">Te resumimos las bases en 5 líneas y puedes preguntar dudas («¿puedo presentarme con un FP de grado medio?», «hazme un plan de estudio»).</p>
      <button type="button" class="btn" id="iaResumen">✨ Resumir con IA</button>
      <div id="iaOut" class="iaout" hidden></div>
      <form id="iaForm" class="iaform"><input id="iaQ" maxlength="300" placeholder="Pregunta sobre esta plaza" autocomplete="off"><button class="btn" type="submit">Preguntar</button></form>
      <p class="note" id="iaNota"></p>
    </section>

    ${historia.length ? `<h2>Novedades</h2><ul class="hist">${historia.slice().reverse().map((h) => `<li><b>${e(new Date(h.fecha).toLocaleDateString("es-ES"))}</b> ${e(h.texto)}</li>`).join("")}</ul>` : ""}
    ${promo ? `<aside class="promo"><b>¿Vas a por policía en Cataluña?</b> Prepárate con <a href="https://opos365.com" target="_blank" rel="noopener">OPOS 365</a>: temario, psicotécnicos y exámenes tipo test de Mossos y policía.</aside>` : ""}
  </main>
  ${relacionadas.length ? `<section class="rel"><h2>Plazas parecidas abiertas</h2><ul class="lista">${relacionadas.map((r) => filaLista(r, hoy)).join("")}</ul><p><a href="/oposiciones/${e(o.subtipo || o.tipo || "otros")}">Ver todas: ${e(sub || sector)} →</a></p></section>` : ""}
<script src="/plaza.js" defer></script>`;

  const jobPosting = {
    "@context": "https://schema.org", "@type": "JobPosting",
    title: titulo, description: `<p>${e(o.titulo)}</p>${o.resumen ? `<p>${e(o.resumen)}</p>` : ""}<p>Más información y solicitud en la convocatoria oficial.</p>`,
    identifier: { "@type": "PropertyValue", name: o.fuente, value: o.id },
    datePosted: o.publicado || (o.encontrada || "").slice(0, 10),
    ...(o.plazo_fin ? { validThrough: `${o.plazo_fin}T23:59:00+02:00` } : {}),
    employmentType: Number(o.interino) ? "TEMPORARY" : "FULL_TIME",
    hiringOrganization: { "@type": "Organization", name: o.organismo || "Administración pública" },
    jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: o.municipio || o.provincia || undefined, addressRegion: o.comunidad && o.comunidad !== "Estatal" ? o.comunidad : undefined, addressCountry: "ES" } },
    ...(o.comunidad === "Estatal" ? { applicantLocationRequirements: { "@type": "Country", name: "España" } } : {}),
    directApply: false, url: sitio(env) + ruta,
  };
  const migas = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Oposiciones", item: `${sitio(env)}/oposiciones` },
    { "@type": "ListItem", position: 2, name: sector, item: `${sitio(env)}/oposiciones/${o.tipo || "otros"}` },
    { "@type": "ListItem", position: 3, name: titulo, item: sitio(env) + ruta },
  ] };
  return shell(env, { titulo, desc, ruta, cuerpo, jsonld: abierta ? [jobPosting, migas] : [migas] });
}

export async function paginaSector(env: Env, clave?: string, lugar?: string): Promise<Response | null> {
  const hoy = hoyMadrid();
  const ABIERTA = "(plazo_fin IS NULL OR plazo_fin >= ?) AND (estado IS NULL OR estado != 'cerrada')";

  if (!clave) {
    const filas = (await env.DB.prepare(`SELECT COALESCE(tipo,'otros') AS t, subtipo AS s, COUNT(*) AS n FROM ofertas WHERE ${ABIERTA} GROUP BY t, s`).bind(hoy).all<{ t: string; s: string | null; n: number }>()).results;
    const porSector = new Map<string, number>(), porSub = new Map<string, number>();
    let total = 0;
    for (const f of filas) { total += f.n; porSector.set(f.t, (porSector.get(f.t) || 0) + f.n); if (f.s) porSub.set(f.s, (porSub.get(f.s) || 0) + f.n); }
    const cuerpo = `  <main>
    <h1>Oposiciones y bolsas por sector</h1>
    <p>${total} plazas con el plazo abierto o a punto de abrirse en toda España, ordenadas por sector. Elige el tuyo para ver las convocatorias, bolsas de trabajo e interinidades.</p>
    <div class="sectores">${[...ORDEN_SECTORES, "otros"].map((s) => `<section class="sector"><h2><a href="/oposiciones/${s}">${e(SECTOR_NOMBRE[s])}</a> <small>${porSector.get(s) || 0}</small></h2>
      ${s !== "otros" ? `<ul>${SECTORES[s].subs.map(([k, n]) => `<li><a href="/oposiciones/${k}">${e(n)}</a> <small>${porSub.get(k) || 0}</small></li>`).join("")}</ul>` : ""}</section>`).join("")}</div>
  </main>`;
    return shell(env, { titulo: "Oposiciones por sector: seguridad, sanidad, justicia, educación…", desc: "Todas las oposiciones, bolsas de trabajo e interinos de España clasificados por sector: policía, bomberos, sanidad, justicia, educación, administración y más.", ruta: "/oposiciones", cuerpo });
  }

  const esSector = clave in SECTOR_NOMBRE, esSub = clave in SUBTIPOS;
  if (!esSector && !esSub) return null;
  const lug = lugar ? LUGARES.find((l) => l.slug === lugar) : null;
  if (lugar && !lug) return null;
  const nombre = esSub ? SUBTIPOS[clave].nombre : SECTOR_NOMBRE[clave];
  const delSector = (await env.DB.prepare(
    `SELECT * FROM ofertas WHERE ${esSub ? "subtipo = ?" : "COALESCE(tipo,'otros') = ?"} AND ${ABIERTA} ORDER BY CASE WHEN plazo_fin IS NULL THEN 1 ELSE 0 END, plazo_fin LIMIT 3000`,
  ).bind(clave, hoy).all<Oferta>()).results;
  const enLugar = lug ? delSector.filter((o) => (lug.tipo === "comunidad" ? o.comunidad === lug.nombre || o.comunidad === "Estatal" : o.provincia === lug.nombre || o.comunidad === "Estatal")) : delSector;
  const porLugar = new Map<string, number>();
  for (const o of delSector) if (o.comunidad && o.comunidad !== "Estatal") porLugar.set(o.comunidad, (porLugar.get(o.comunidad) || 0) + 1);
  const porProv = new Map<string, number>();
  for (const o of delSector) if (o.provincia) porProv.set(o.provincia, (porProv.get(o.provincia) || 0) + 1);
  const titulo = `${nombre}${lug ? ` en ${lug.nombre}` : ""}: oposiciones, bolsas e interinos`;
  const ruta = `/oposiciones/${clave}${lug ? `/${lug.slug}` : ""}`;
  const sectorPadre = esSub ? SUBTIPOS[clave].sector : null;
  const cuerpo = `  <nav class="migas"><a href="/oposiciones">Oposiciones</a>${sectorPadre ? ` › <a href="/oposiciones/${sectorPadre}">${e(SECTOR_NOMBRE[sectorPadre])}</a>` : ""}${lug ? ` › <a href="/oposiciones/${clave}">${e(nombre)}</a>` : ""}</nav>
  <main>
    <h1>${e(nombre)}${lug ? ` en ${e(lug.nombre)}` : ""}</h1>
    <p>${enLugar.length ? `Hay <b>${enLugar.length}</b> ${enLugar.length === 1 ? "plaza" : "plazas"} con el plazo abierto o pendiente de abrir${lug ? ` en ${e(lug.nombre)} (incluidas las de ámbito estatal)` : " en toda España"}. Se actualiza cada mañana con el BOE, el CIDO y TMB.` : `Ahora mismo no hay plazas abiertas${lug ? ` en ${e(lug.nombre)}` : ""}. Crea una alerta gratis y te avisamos en cuanto salga una.`}</p>
    <p><a class="btn primario" href="/?sector=${e(clave)}${lug ? `&lugar=${encodeURIComponent(lug.nombre)}` : ""}">🔔 Crear una alerta con esta búsqueda</a></p>
    <ul class="lista">${enLugar.slice(0, 150).map((o) => filaLista(o, hoy)).join("")}</ul>
    ${enLugar.length > 150 ? `<p class="note">Y ${enLugar.length - 150} más en <a href="/">la búsqueda completa</a>.</p>` : ""}
  </main>
  ${!lug && porLugar.size ? `<section class="rel"><h2>${e(nombre)} por comunidad</h2><p class="lugares">${[...porLugar].sort((a, b) => b[1] - a[1]).map(([c, n]) => `<a href="/oposiciones/${clave}/${lugarSlug(c)}">${e(c)} <small>${n}</small></a>`).join("")}</p>
    ${porProv.size ? `<h2>Por provincia</h2><p class="lugares">${[...porProv].sort((a, b) => b[1] - a[1]).map(([p, n]) => `<a href="/oposiciones/${clave}/${lugarSlug(p)}">${e(p)} <small>${n}</small></a>`).join("")}</p>` : ""}</section>` : ""}
  ${esSector && clave !== "otros" ? `<section class="rel"><h2>Subcategorías</h2><p class="lugares">${SECTORES[clave].subs.map(([k, n]) => `<a href="/oposiciones/${k}${lug ? `/${lug.slug}` : ""}">${e(n)}</a>`).join("")}</p></section>` : ""}`;
  const lista = { "@context": "https://schema.org", "@type": "ItemList", itemListElement: enLugar.slice(0, 50).map((o, i) => ({ "@type": "ListItem", position: i + 1, url: sitio(env) + rutaPlaza(o), name: corto(o.titulo) })) };
  return shell(env, { titulo, desc: `${enLugar.length} plazas de ${nombre.toLowerCase()}${lug ? ` en ${lug.nombre}` : " en España"}: convocatorias, bolsas de trabajo e interinos con plazo abierto, requisitos y alertas gratis por correo.`, ruta, cuerpo, jsonld: [lista] });
}

export async function sitemap(env: Env): Promise<Response> {
  const hoy = hoyMadrid();
  const web = sitio(env);
  const filas = (await env.DB.prepare("SELECT id, titulo, tipo, subtipo, comunidad, provincia, encontrada FROM ofertas WHERE (plazo_fin IS NULL OR plazo_fin >= ?) AND (estado IS NULL OR estado != 'cerrada') LIMIT 20000").bind(hoy).all<Oferta>()).results;
  const urls = new Map<string, string | undefined>();
  for (const r of ["/", "/oposiciones", "/estadisticas.html", "/sueldos.html", "/guias/", "/guias/interino-y-bolsa.html", "/guias/grupos-y-titulacion.html", "/guias/como-presentar-solicitud.html", "/guias/tipos-de-pruebas.html", "/guias/glosario.html", "/contacto.html"]) urls.set(r, undefined);
  for (const s of [...ORDEN_SECTORES, "otros"]) urls.set(`/oposiciones/${s}`, undefined);
  for (const k of Object.keys(SUBTIPOS)) urls.set(`/oposiciones/${k}`, undefined);
  for (const o of filas) {
    urls.set(rutaPlaza(o), (o.encontrada || "").slice(0, 10));
    for (const clave of [o.tipo || "otros", o.subtipo].filter(Boolean) as string[]) {
      if (o.comunidad && o.comunidad !== "Estatal") urls.set(`/oposiciones/${clave}/${lugarSlug(o.comunidad)}`, undefined);
      if (o.provincia) urls.set(`/oposiciones/${clave}/${lugarSlug(o.provincia)}`, undefined);
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls].map(([u, d]) => `  <url><loc>${e(web + u)}</loc>${d ? `<lastmod>${d}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}

export { slug };
