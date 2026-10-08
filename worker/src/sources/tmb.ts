// TMB · ofertas de empleo (la web no tiene RSS: se lee la página de ofertas).
import { dificultadDe, isoDe } from "../classify";
import { clasificar } from "../sectores";
import { decode } from "../text";
import type { Oferta } from "../types";

export const TMB_URL = "https://www.tmb.cat/ca/treball-i-practiques";

export function ofertasTmb(html: string, hoy: string, ahora: string): Oferta[] {
  const out = new Map<string, Oferta>();
  for (const m of html.matchAll(/<a\b[^>]*href="([^"]*\/(?:w|-)\/[^"]*(?:oferta|\d{5})[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].startsWith("http") ? m[1] : `https://www.tmb.cat${m[1]}`;
    const titulo = decode(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (titulo.length < 6) continue;
    const num = href.match(/(?:oferta-)?(\d{5})/)?.[1] ?? titulo.match(/\b(\d{5})\b/)?.[1];
    if (!num) continue;
    // Fechas del periodo de inscripción cerca del enlace.
    const after = html.slice((m.index ?? 0), (m.index ?? 0) + 1500);
    const fechas = [...after.matchAll(/(\d{2}\/\d{2}\/\d{4})/g)].map((x) => isoDe(x[1])!).filter(Boolean);
    const fin = fechas[1] ?? fechas[0] ?? null;
    if (!fin || fin < hoy) continue; // solo abiertas
    const c = clasificar(titulo);
    const tipo = c.tipo === "otros" ? "transporte" : c.tipo;
    const borsa = /borsa|bolsa/i.test(titulo);
    out.set(num, {
      id: `tmb:${num}`, fuente: "TMB", titulo: titulo.replace(/^\d{5}\s*[-–]?\s*/, ""),
      organismo: "Transports Metropolitans de Barcelona (TMB)", municipio: "Barcelona", provincia: "Barcelona", comunidad: "Cataluña",
      tipo, subtipo: c.tipo === "otros" ? "atencion-viajeros" : c.subtipo, grupo: null, sistema: borsa ? "bolsa" : null, interino: borsa ? 1 : 0,
      dificultad: dificultadDe({ grupo: null, sistema: borsa ? "bolsa" : null, interino: borsa, tipo }),
      estado: "abierta", plazo_fin: fin, url: href, tramite_url: href, publicado: fechas[0] ?? null,
      encontrada: ahora, detalle_ok: 1,
    });
  }
  return [...out.values()];
}
