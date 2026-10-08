// Filtros compartidos por la búsqueda (API) y las alertas.
import { expandirZonas, norm } from "./geo";
import type { Oferta } from "./types";

export interface Filtros {
  comunidades?: string[];
  provincias?: string[];
  zonas?: string[];          // municipios / comarcas ("Maresme")
  tipos?: string[];
  dificultades?: number[];
  grupos?: string[];         // A1 A2 B C1 C2 AP · "?" = sin especificar
  palabras?: string[];       // alguna debe aparecer en título u organismo
  excluir?: string[];
  soloInterinos?: boolean;
  soloAbiertas?: boolean;
  fuentes?: string[];
}

export function hoyMadrid(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function estadoActual(o: Oferta, hoy = hoyMadrid()): string {
  if (o.plazo_fin && o.plazo_fin < hoy) return "cerrada";
  return o.estado || "abierta";
}

export function coincide(o: Oferta, f: Filtros, hoy = hoyMadrid()): boolean {
  const has = (a?: unknown[]) => Array.isArray(a) && a.length > 0;
  if (has(f.fuentes) && !f.fuentes!.includes(o.fuente)) return false;
  if (has(f.comunidades) && !f.comunidades!.includes(o.comunidad || "")) return false;
  if (has(f.provincias) && !f.provincias!.includes(o.provincia || "")) return false;
  if (has(f.tipos) && !f.tipos!.includes(o.tipo || "otros")) return false;
  if (has(f.dificultades) && !f.dificultades!.includes(Number(o.dificultad || 2))) return false;
  if (has(f.grupos) && !f.grupos!.includes(o.grupo || "?")) return false;
  if (f.soloInterinos && !Number(o.interino)) return false;
  if (f.soloAbiertas && estadoActual(o, hoy) === "cerrada") return false;
  const hay = norm(`${o.titulo} ${o.organismo || ""} ${o.municipio || ""}`);
  if (has(f.zonas)) {
    const lugar = norm(`${o.municipio || ""} | ${o.organismo || ""} | ${o.titulo}`);
    if (!expandirZonas(f.zonas!).some((z) => contienePalabra(lugar, norm(z)))) return false;
  }
  if (has(f.palabras) && !f.palabras!.some((p) => hay.includes(norm(p)))) return false;
  if (has(f.excluir) && f.excluir!.some((p) => hay.includes(norm(p)))) return false;
  return true;
}

/** Coincidencia por palabra completa: "Mataró" sí, pero "Barcelona" no casa con "Barcelonaesports". */
function contienePalabra(texto: string, z: string): boolean {
  const re = new RegExp(`(^|[^a-z])${z.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`);
  return re.test(texto);
}
