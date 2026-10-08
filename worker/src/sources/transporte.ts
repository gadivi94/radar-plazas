// Empresas públicas de transporte de toda España (metro, autobuses urbanos, ferrocarriles autonómicos, Renfe, Adif…).
// Cada empresa publica sus procesos a su manera: se lee la página de empleo con un patrón de enlaces por empresa.
// Lo que desaparece de la lista de una empresa se da por cerrado. TMB tiene su propio lector (tmb.ts).
import { clasificar } from "../sectores";
import { provinciaDe } from "../geo";
import { dificultadDe, interinoDe, isoDe, plazasDe } from "../classify";
import { decode } from "../text";
import type { Oferta } from "../types";

export interface Empresa {
  id: string;
  nombre: string;
  comunidad: string;           // comunidad autónoma o "Estatal"
  municipio?: string;
  url: string;
  enlace: RegExp;              // href de cada oferta (sin la parte de la consulta si quitarQuery)
  base?: string;               // para enlaces relativos (por defecto, el origen de url)
  tren?: boolean;              // ferrocarril / metro: subcategoría metro-tren por defecto
  seccion?: [RegExp, RegExp?]; // solo el HTML entre estas dos marcas
  incluir?: RegExp;            // el título (o el texto cercano) debe contener esto
  excluir?: RegExp;            // y no esto (procesos cerrados, resueltos…)
  quitarPrefijo?: RegExp;
  quitarQuery?: boolean;
  frescura?: number;           // sin plazo: solo lo publicado en los últimos N días (por la fecha del enlace o del texto)
  ultimos?: number;            // quedarse con los N más recientes (por el número del enlace)
  json?: "drupal";             // la lista viene de una API JSON:API de Drupal
  tituloCabecera?: boolean;    // el título es el encabezado del bloque, no el texto del enlace
}

export const EMPRESAS: Empresa[] = [
  // Estatales
  { id: "renfe", nombre: "Renfe", comunidad: "Estatal", url: "https://empleo.renfe.com/search/", enlace: /\/job\/[^"'\s<>]+\/\d+\//, tren: true },
  { id: "adif", nombre: "Adif", comunidad: "Estatal", url: "https://www.adif.es/empleo/oferta-empleo-publico/plazo-solicitud-abierto", enlace: /\/w\/[a-z0-9-]+\?redirect=%2Fempleo[^"'\s<>]*/, quitarQuery: true, tren: true },
  // Madrid
  { id: "emtmadrid", nombre: "EMT Madrid", comunidad: "Madrid", municipio: "Madrid", url: "https://www.emtmadrid.es/Empresa/Empleo?lang=es-ES", enlace: /\/EMPRESA\/Empleo\/[^"'\s<>]+\.aspx/i, frescura: 45 },
  { id: "metromadrid", nombre: "Metro de Madrid", comunidad: "Madrid", municipio: "Madrid", url: "https://www.metromadrid.es/es/trabaja-con-nosotros", enlace: /\/es\/oferta-empleo\/[a-z0-9-]+/, excluir: /finalizad|cerrad/i, tren: true },
  // Castilla y León
  { id: "auvasa", nombre: "AUVASA (Autobuses Urbanos de Valladolid)", comunidad: "Castilla y León", municipio: "Valladolid", url: "https://www.auvasa.es/empresa/ofertas-de-empleo/", enlace: /\/wp-content\/uploads\/\d{4}\/\d{2}\/convocatoria_oe\d+_\d{4}[^"'\s<>]*\.pdf/i, incluir: /^bases/i, tituloCabecera: true, frescura: 120 },
  // Cataluña
  { id: "fgc", nombre: "FGC (Ferrocarrils de la Generalitat de Catalunya)", comunidad: "Cataluña", url: "https://treballar.fgc.cat/go/CONVOCATORIES/814602/", enlace: /\/job\/[^"'\s<>]+\/\d+\//, tren: true },
  { id: "atm", nombre: "ATM (Autoritat del Transport Metropolità)", comunidad: "Cataluña", municipio: "Barcelona", url: "https://www.atm.cat/atm/transparencia/organitzacio", enlace: /\/documents\/[^"'\s<>]+/, seccion: [/Ofertes d.ocupaci[oó] en curs/i, /Ofertes d.ocupaci[oó] resoltes/i], tituloCabecera: true },
  { id: "tusgsal", nombre: "Tusgsal (autobuses de Badalona y el Barcelonès Nord)", comunidad: "Cataluña", municipio: "Badalona", url: "https://www.tusgsal.cat/cat/2-empresa/753-talent-ofertas.html", enlace: /https:\/\/direxis\.es\/ofertes\/[^"'\s<>]+/ },
  { id: "tussabadell", nombre: "TUS (Transports Urbans de Sabadell)", comunidad: "Cataluña", municipio: "Sabadell", url: "https://www.tus.es/index.php/ca/noticies", enlace: /\/noticies\/item\/[a-z0-9-]+/, incluir: /treballa|oferta|convocat|borsa|selecci/i, frescura: 90 },
  // País Vasco
  { id: "metrobilbao", nombre: "Metro Bilbao", comunidad: "País Vasco", municipio: "Bilbao", url: "https://cms.metrobilbao.eus/es/jsonapi/node/news?filter[t][condition][path]=title&filter[t][condition][operator]=CONTAINS&filter[t][condition][value]=selecci&sort=-created&page[limit]=10", enlace: /./, json: "drupal", base: "https://cms.metrobilbao.eus", frescura: 30, tren: true },
  { id: "euskotren", nombre: "Euskotren", comunidad: "País Vasco", url: "https://gardentasuna.euskotren.eus/trabaja-con-nosotros", enlace: /\/sites\/transparencia\/files\/\d{4}-\d{2}\/[^"'\s<>]+\.pdf/i, frescura: 120, tren: true },
  { id: "dbus", nombre: "Dbus (autobuses de Donostia)", comunidad: "País Vasco", municipio: "San Sebastián", url: "https://dbus.eus/es/otros-servicios/seleccion-de-personal/", enlace: /\/es\/seleccion-de-personal\/[a-z0-9-]+\//, incluir: /\[ABIERTA\]/i, quitarPrefijo: /^\s*\[ABIERTA\]\s*/i },
  { id: "tuvisa", nombre: "TUVISA (autobuses de Vitoria-Gasteiz)", comunidad: "País Vasco", municipio: "Vitoria-Gasteiz", url: "https://www.vitoria-gasteiz.org/wb021/was/contenidoAction.do?idioma=es&uid=a5de718_1855726948b__7e6a", enlace: /contenidoAction\.do\?[^"'\s<>]*uid=[^"'\s<>&]+/, incluir: /TUVISA/i },
  // Andalucía
  { id: "aucorsa", nombre: "Aucorsa (autobuses de Córdoba)", comunidad: "Andalucía", municipio: "Córdoba", url: "https://aucorsa.es/empleo/", enlace: /\/oferta-de-empleo\/[a-z0-9-]+\//, frescura: 90 },
  { id: "emtmalaga", nombre: "EMT Málaga", comunidad: "Andalucía", municipio: "Málaga", url: "https://convocatorias.emtmalaga.es/convocatorias", enlace: /\/convocatorias?\/[a-z0-9-]+[^"'\s<>]*/i, excluir: /finalizad|cerrad|resuelt/i },
  { id: "tussam", nombre: "TUSSAM (autobuses de Sevilla)", comunidad: "Andalucía", municipio: "Sevilla", url: "https://www.tussam.es/es/empleo", enlace: /\/(?:es\/)?(?:empleo|oferta|convocatoria)[^"'\s<>]*\/[a-z0-9-]+/i, excluir: /finalizad|cerrad|resuelt/i },
  // Cantabria
  { id: "tussantander", nombre: "TUS (Transportes Urbanos de Santander)", comunidad: "Cantabria", municipio: "Santander", url: "https://santander.es/ayuntamiento/estructura-administrativa/oferta-empleo-publico", enlace: /\/oferta-empleo-publico\/[a-z0-9-]+/, incluir: /\bTUS\b/ },
  // Canarias
  { id: "guaguas", nombre: "Guaguas Municipales (Las Palmas de Gran Canaria)", comunidad: "Canarias", municipio: "Las Palmas de Gran Canaria", url: "https://www.guaguas.com/empresa/trabaja-con-nosotros", enlace: /\/ofertas_trabajo\/bases_\d+\.pdf/, tituloCabecera: true, excluir: /conclu|finaliz|cerrad|resuelt/i },
  { id: "titsa", nombre: "TITSA (guaguas de Tenerife)", comunidad: "Canarias", municipio: "Santa Cruz de Tenerife", url: "https://titsa.com/index.php/titsa/trabaja-con-nosotros", enlace: /\/trabaja-con-nosotros\/\d+-[a-z0-9-]+/, ultimos: 4 },
  { id: "metrotenerife", nombre: "Metrotenerife (tranvía)", comunidad: "Canarias", municipio: "Santa Cruz de Tenerife", url: "https://metrotenerife.com/contrataciones/", enlace: /\/wp-content\/uploads\/\d{4}\/\d{2}\/[^"'\s<>]+\.pdf/i, seccion: [/Recursos Humanos/i], frescura: 120, tren: true },
];

const GENERICO = /^(ver|veure|leer|llegir|m[aá]s|m[eé]s|info|informaci[oó]n|descargar|descarregar|bases|pdf|aqu[ií]|enlace|enlla[cç]|oferta|ver oferta|veure oferta|m[aá]s informaci[oó]n|m[eé]s informaci[oó])\b.{0,20}$/i;
const limpiar = (s: string) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const MESES: Record<string, number> = { ene: 1, jan: 1, gen: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, mai: 5, jun: 6, jul: 7, ago: 8, aug: 8, set: 9, sep: 9, oct: 10, nov: 11, dic: 12, dec: 12, des: 12 };

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/** Encabezado más cercano por encima de un enlace (o texto destacado si no hay): título y posición. */
function cabecera(html: string, idx: number): { titulo: string; pos: number } | null {
  const desde = Math.max(0, idx - 1500), antes = html.slice(desde, idx);
  for (const re of [/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi, /<(strong|b|td|li|p)\b[^>]*>([\s\S]*?)<\/\1>/gi]) {
    const m = [...antes.matchAll(re)].map((x) => ({ titulo: limpiar(x[2]), pos: desde + (x.index ?? 0) })).filter((t) => t.titulo.length > 8 && !GENERICO.test(t.titulo) && !/^\W*(convocatoria|convocat[oò]ria|plazo|termini)\s*:/i.test(t.titulo));
    if (m.length) return m[m.length - 1];
  }
  return null;
}

/** Fecha aproximada de publicación a partir del enlace (/2026/09/, /2026-09/) o del texto (13Mar2026, 13 Septiembre 2026, dd-mm-yyyy). */
export function fechaPublicacion(href: string, texto: string): string | null {
  const a = href.match(/\/(20\d{2})[\/-](\d{2})\//);
  if (a) return `${a[1]}-${a[2]}-01`;
  const b = texto.match(/\b(\d{1,2})\s*([a-zç]{3})[a-zç]*\.?,?\s*(20\d{2})\b/i);
  if (b && MESES[b[2].toLowerCase()]) return `${b[3]}-${String(MESES[b[2].toLowerCase()]).padStart(2, "0")}-${b[1].padStart(2, "0")}`;
  const c = texto.match(/\b(\d{2})[-/](\d{2})[-/](20\d{2})\b/);
  if (c) return `${c[3]}-${c[2]}-${c[1]}`;
  return null;
}

function oferta(e: Empresa, href: string, titulo: string, ctx: string, hoy: string, ahora: string): Oferta | null {
  const t = (e.quitarPrefijo ? titulo.replace(e.quitarPrefijo, "") : titulo).replace(/\s+/g, " ").trim().slice(0, 300);
  if (t.length < 6) return null;
  // Plazo: la última fecha dd/mm/yyyy futura cerca del enlace (p. ej. «del 01/10/2026 al 15/10/2026»)
  const fechas = [...ctx.matchAll(/\b(\d{2}\/\d{2}\/20\d{2})\b/g)].map((x) => isoDe(x[1])!).filter(Boolean);
  const fin = fechas.filter((f) => f >= hoy).sort().at(-1) || null;
  if (fechas.length && !fin && fechas.every((f) => f < hoy)) return null; // todas las fechas ya pasaron
  const publicado = fechaPublicacion(href, `${titulo} ${ctx}`);
  if (e.frescura && !fin) {
    if (!publicado) return null;
    if ((Date.parse(hoy) - Date.parse(publicado)) / 864e5 > e.frescura) return null;
  }
  const c = clasificar(t);
  const subtipo = c.tipo === "transporte" ? c.subtipo : e.tren && /maquinist|conduc|agente|operador|estaci/i.test(t) ? "metro-tren" : "otros-transporte";
  const bolsa = /bolsa|borsa|lista de reserva|reserva/i.test(t);
  const prov = provinciaDe(e.municipio) || provinciaDe(e.comunidad);
  return {
    id: `tr:${e.id}:${hash(href)}`, fuente: "EMPRESA", titulo: t, organismo: e.nombre,
    municipio: e.municipio ?? null, provincia: prov?.provincia ?? null, comunidad: e.comunidad,
    tipo: "transporte", subtipo, grupo: null, sistema: bolsa ? "bolsa" : null, interino: bolsa || interinoDe(t) ? 1 : 0,
    dificultad: dificultadDe({ grupo: null, sistema: bolsa ? "bolsa" : null, interino: bolsa, tipo: "transporte" }),
    estado: "abierta", plazo_fin: fin, plazo_texto: fin ? null : "Consulta el plazo en la web de la empresa",
    plazas: plazasDe(t), url: href, tramite_url: href, publicado, encontrada: ahora, detalle_ok: 1,
  };
}

/** Ofertas de la página de empleo de una empresa. */
export function ofertasEmpresa(e: Empresa, body: string, hoy: string, ahora: string): Oferta[] {
  const base = e.base || new URL(e.url).origin;
  const abs = (h: string) => { try { return new URL(decode(h), e.url.startsWith("http") ? e.url : base).toString(); } catch { return h; } };
  if (e.json === "drupal") {
    const d = JSON.parse(body) as { data?: Array<{ attributes?: { title?: string; created?: string; drupal_internal__nid?: number; body?: { summary?: string; value?: string } } }> };
    return (d.data || []).flatMap((n) => {
      const a = n.attributes || {};
      if (!a.title || !a.drupal_internal__nid) return [];
      const extra = limpiar(a.body?.summary || a.body?.value || "").slice(0, 160);
      const o = oferta(e, `${base}/es/node/${a.drupal_internal__nid}`, extra && !extra.startsWith(a.title) ? `${a.title}: ${extra}` : a.title, `${(a.created || "").slice(0, 10).split("-").reverse().join("-")} ${limpiar(a.body?.value || "")}`, hoy, ahora);
      if (o && a.created) o.publicado = a.created.slice(0, 10);
      return o ? [o] : [];
    });
  }
  let html = body;
  if (e.seccion) {
    const i = html.search(e.seccion[0]);
    if (i < 0) return [];
    html = html.slice(i);
    if (e.seccion[1]) { const j = html.search(e.seccion[1]); if (j > 0) html = html.slice(0, j); }
  }
  const vistos = new Map<string, Oferta>();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (!e.enlace.test(m[1]) && !e.enlace.test(decode(m[1]))) continue;
    let href = decode(m[1]);
    if (e.quitarQuery) href = href.split("?")[0];
    href = abs(href);
    const idx = m.index ?? 0;
    let titulo = limpiar(m[2]);
    const cab = e.tituloCabecera || !titulo || titulo.length < 8 || GENERICO.test(titulo) ? cabecera(html, idx) : null;
    if (cab) titulo = cab.titulo;
    // Contexto (fechas): desde el encabezado de su bloque hasta el siguiente encabezado
    const sig = html.slice(idx + m[0].length).search(/<h[1-6]\b/i);
    const fin = idx + m[0].length + Math.min(sig < 0 ? 600 : sig, 600);
    const ctx = limpiar(html.slice(cab ? cab.pos : Math.max(0, idx - 500), fin));
    if (e.incluir && !e.incluir.test(titulo) && !e.incluir.test(limpiar(m[2]))) continue;
    if (e.excluir && e.excluir.test(titulo)) continue;
    const o = oferta(e, href, titulo, ctx, hoy, ahora);
    // Una oferta por título (algunas webs enlazan el mismo proceso varias veces)
    if (o && !vistos.has(o.id) && ![...vistos.values()].some((x) => x.titulo.toLowerCase() === o.titulo.toLowerCase())) vistos.set(o.id, o);
  }
  let lista = [...vistos.values()];
  if (e.ultimos) lista = lista.sort((a, b) => Number(b.url!.match(/\/(\d+)-/)?.[1] || 0) - Number(a.url!.match(/\/(\d+)-/)?.[1] || 0)).slice(0, e.ultimos);
  return lista;
}

const UA = { "User-Agent": "Mozilla/5.0 (compatible; RadarPlazas/1.0; +https://radaropos.com)", Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8", "Accept-Language": "es-ES,es;q=0.9,ca;q=0.8" };

/** Lee todas las empresas (6 a la vez). Devuelve las ofertas y, por empresa, si se pudo leer. */
export async function recogerEmpresas(hoy: string, ahora: string, empresas = EMPRESAS): Promise<{ ofertas: Oferta[]; leidas: Map<string, string[]>; errores: string[] }> {
  const ofertas: Oferta[] = [], leidas = new Map<string, string[]>(), errores: string[] = [];
  const cola = [...empresas];
  const trabajador = async () => {
    for (let e = cola.shift(); e; e = cola.shift()) {
      try {
        const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 15_000);
        const r = await fetch(e.url, { headers: UA, signal: ctrl.signal, redirect: "follow" }).finally(() => clearTimeout(to));
        if (!r.ok) { errores.push(`${e.id}: ${r.status}`); continue; }
        const lista = ofertasEmpresa(e, await r.text(), hoy, ahora);
        ofertas.push(...lista);
        leidas.set(e.id, lista.map((o) => o.id));
      } catch (err) { errores.push(`${e.id}: ${String(err).slice(0, 80)}`); }
    }
  };
  await Promise.all(Array.from({ length: 6 }, trabajador));
  return { ofertas, leidas, errores };
}
