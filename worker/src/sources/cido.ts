// CIDO (Diputació de Barcelona): todas las administraciones catalanas, incluidas bolsas e interinos.
import { coordCatalana, provinciaCatalana, provinciaDe } from "../geo";
import { dificultadDe, grupoDe, interinoDe, isoDe, plazasDe, sistemaDe } from "../classify";
import { clasificar, nivelDe, requisitosDe } from "../sectores";
import { campo, parseRss, toText } from "../text";
import type { Oferta } from "../types";

export const CIDO_OBERTES = "https://cido.diba.cat/rss/oposicions/obertes";
export const CIDO_FEEDS = [
  CIDO_OBERTES,
  "https://cido.diba.cat/rss/oposicions/oposicions",
  "https://cido.diba.cat/rss/oposicions/borses-treball",
  "https://cido.diba.cat/rss/oposicions/places-interinatge",
];

const UA = { "User-Agent": "RadarPlazas/1.0 (uso personal)" };

export async function fetchFeed(url: string): Promise<string> {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`CIDO ${r.status} ${url}`);
  return r.text();
}

/** Municipio a partir del ens o de "(Ciudad)" al final del título. */
export function municipioDe(ens: string, titulo: string): string | null {
  const m = ens.match(/^(?:Ajuntament|Consell Comarcal|Consorci|Mancomunitat)\s+(?:de l'|de la |dels |de les |del |de |d')([^-–]+?)(?:\s+[-–].*)?$/i);
  if (m) return m[1].trim();
  const p = titulo.match(/\(([^()]+)\)\s*$/);
  if (p && !/^\d/.test(p[1])) return p[1].trim();
  const dip = ens.match(/Diputaci[oó] de (Barcelona|Girona|Lleida|Tarragona)/i);
  if (dip) return dip[1];
  return null;
}

/** Plazas de un feed del CIDO. Solo el feed «obertes» garantiza que el plazo está abierto: los demás también traen
 *  procesos cerrados o resueltos que vuelven a salir cuando se publica algo nuevo (listas, resolución…), así que
 *  quedan «por revisar» hasta leer su ficha. */
export function ofertasDesdeFeed(xml: string, ahora: string, abiertas = false): Oferta[] {
  return parseRss(xml).flatMap((it) => {
    const id = it.link.match(/\/oposicions\/(\d+)/)?.[1];
    if (!id) return [];
    const desc = toText(it.description);
    const ens = desc.match(/Ens:\s*([^\n]+)/)?.[1]?.trim() || "";
    const municipio = municipioDe(ens, it.title);
    const prov = provinciaDe(municipio);
    const texto = `${it.title} ${ens}`;
    const { tipo, subtipo } = clasificar(it.title);
    const interino = interinoDe(texto);
    const sistema = /borsa de treball/i.test(it.title) ? "bolsa" : null;
    return [{
      id: `cido:${id}`,
      fuente: "CIDO" as const,
      titulo: it.title,
      organismo: ens || null,
      municipio,
      provincia: prov?.provincia ?? provinciaCatalana(municipio),
      lat: coordCatalana(municipio)?.[1] ?? null, lon: coordCatalana(municipio)?.[0] ?? null,
      comunidad: "Cataluña",
      tipo, subtipo, sistema, interino: interino ? 1 : 0, grupo: null,
      dificultad: dificultadDe({ grupo: null, sistema, interino, tipo }),
      estado: abiertas ? ("abierta" as const) : ("revisar" as const),
      plazas: plazasDe(it.title),
      url: it.link.replace(/^http:/, "https:"),
      detalle_url: it.link.replace(/^http:/, "https:"),
      publicado: pubDateIso(it.pubDate),
      encontrada: ahora,
      detalle_ok: 0,
    }];
  });
}

function pubDateIso(s: string): string | null {
  const d = new Date(s);
  return isNaN(+d) ? null : d.toISOString().slice(0, 10);
}

// Estado del proceso: el CIDO lo muestra justo después de la tabla de publicaciones, antes del botón «Guarda».
const ESTADOS: Array<[RegExp, Oferta["estado"]]> = [
  [/termini obert/i, "abierta"],
  [/pendent de termini|pendent de convocat[oò]ria/i, "pendiente"],
  [/termini tancat|\bresolt\b|proc[eé]s no vigent|en tr[aà]mit|desert|anul·lat|anul\.lat|susp[eè]s|finalitzat/i, "cerrada"],
];
const UN_ESTADO = /termini obert|pendent de termini|pendent de convocat[oò]ria|termini tancat|\bresolt\b|proc[eé]s no vigent|en tr[aà]mit|\bdesert\b|anul·lat|anul\.lat|susp[eè]s|finalitzat/gi;
/** Estado que muestra la ficha (null si no aparece). Se mira lo que hay antes de «Guarda» y se toma el último. */
export function estadoFicha(desde: string): Oferta["estado"] | null {
  const g = desde.search(/\bGuarda\b/);
  const zona = g > 0 ? desde.slice(Math.max(0, g - 400), g) : desde;
  const todos = [...zona.matchAll(UN_ESTADO)];
  const ultimo = todos.length ? todos[todos.length - 1][0] : null;
  if (!ultimo) return null;
  for (const [re, e] of ESTADOS) if (re.test(ultimo)) return e;
  return null;
}

const SISTEMA_ES: Record<string, string> = { concurso: "concurso", "concurso-oposicion": "concurso-oposicion", oposicion: "oposicion", bolsa: "bolsa" };

/** Completa una oferta del CIDO con su ficha HTML. */
export function enriquecerCido(o: Oferta, html: string, hoy = new Date().toISOString().slice(0, 10)): Partial<Oferta> {
  const text = toText(html);
  // A partir del título de la ficha, para no confundir el estado con los filtros del menú.
  const idx = text.indexOf(o.titulo.slice(0, 40));
  const desde = idx >= 0 ? text.slice(idx) : text;
  const fin = isoDe(campo(desde, "Finalització de presentació de sol·licituds"));
  // El estado de la ficha manda; si no aparece, se deduce de la fecha de fin; si tampoco hay fecha, queda pendiente.
  let estado: Oferta["estado"] = estadoFicha(desde) ?? (fin ? (fin >= hoy ? "abierta" : "cerrada") : o.estado === "revisar" || !o.estado ? "pendiente" : o.estado);
  if (estado === "abierta" && fin && fin < hoy) estado = "cerrada";
  const termini = fin ? null : campo(desde, "Termini");
  const grupoTxt = campo(desde, "Grup de titulació o assimilat") || "";
  const grupo = grupoDe(grupoTxt);
  const tipusPersonal = campo(desde, "Tipus de personal") || "";
  const sistemaTxt = campo(desde, "Sistema de selecció") || "";
  const sistema = SISTEMA_ES[sistemaDe(sistemaTxt) || ""] || (o.sistema as string | null) || null;
  const interino = interinoDe(`${o.titulo} ${tipusPersonal}`) || Boolean(o.interino);
  const cls = o.tipo && o.tipo !== "otros" && o.subtipo ? { tipo: o.tipo, subtipo: o.subtipo } : clasificar(o.titulo, `${campo(desde, "Matèries") || ""} ${desde.slice(0, 1500)}`);
  const tipo = cls.tipo;

  // Enlace "Accés al tràmit": primer href después de la etiqueta.
  let tramite: string | null = null;
  const at = html.search(/Acc[eé]s al tr(?:à|&agrave;|&#224;)mit/i);
  if (at >= 0) tramite = html.slice(at, at + 1500).match(/href="(https?:[^"]+)"/i)?.[1] ?? null;

  const req = campo(desde, "Titulació requerida");
  const altres = campo(desde, "Altres requisits");
  const requisitos = requisitosDe(desde.slice(0, 12000), req || grupoTxt || null);
  return {
    subtipo: cls.subtipo,
    nivel: nivelDe(grupo, req || grupoTxt),
    requisitos: JSON.stringify(requisitos),
    estado,
    plazo_fin: fin,
    plazo_texto: termini && !/^\d/.test(termini) ? termini.slice(0, 160) : null,
    grupo,
    sistema,
    interino: interino ? 1 : 0,
    tipo,
    dificultad: dificultadDe({ grupo, sistema, interino, tipo }),
    tramite_url: tramite ? tramite.replace(/&amp;/g, "&") : null,
    resumen: [tipusPersonal && `Personal: ${tipusPersonal}`, req && `Titulación: ${req}`, altres && `Requisitos: ${altres}`].filter(Boolean).join(" · ").slice(0, 500) || null,
    detalle_ok: 1,
  };
}

