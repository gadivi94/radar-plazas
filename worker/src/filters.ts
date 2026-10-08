// Filtros compartidos por la búsqueda (API) y las alertas.
import { centroProvincia, coordCatalana, distanciaKm, expandirZonas, norm } from "./geo";
import { SUBTIPOS } from "./sectores";
import type { Oferta } from "./types";

export interface Filtros {
  comunidades?: string[];
  provincias?: string[];
  zonas?: string[];          // municipios / comarcas ("Maresme")
  tipos?: string[];           // sectores
  subtipos?: string[];        // subcategorías (policia-local, tcae…); si hay, basta con que coincida una
  nivelMax?: number;          // solo plazas que piden como mucho este nivel de estudios (0-4)
  cerca?: { lat: number; lon: number; km: number; etiqueta?: string }; // a menos de km de un punto (código postal o ubicación)
  dificultades?: number[];
  grupos?: string[];         // A1 A2 B C1 C2 AP · "?" = sin especificar
  palabras?: string[];       // alguna debe aparecer en título u organismo
  excluir?: string[];
  soloInterinos?: boolean;
  sistemas?: string[];       // oposicion · concurso-oposicion · concurso · bolsa · interino
  soloAbiertas?: boolean;
  fuentes?: string[];
}

export function hoyMadrid(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function estadoActual(o: Oferta, hoy = hoyMadrid()): string {
  if (o.plazo_fin && o.plazo_fin < hoy) return "cerrada";
  if (o.estado === "revisar") return "cerrada";
  return o.estado || "abierta";
}

/** [lon, lat] de una plaza: su municipio o, si no se sabe, el centro de su provincia. Las estatales no tienen lugar. */
export function coordDe(o: Oferta): [number, number] | null {
  if (o.comunidad === "Estatal") return null;
  if (o.lat && o.lon) return [Number(o.lon), Number(o.lat)];
  if (!o.comunidad || o.comunidad === "Cataluña") { const c = coordCatalana(o.municipio); if (c) return c; }
  return centroProvincia(o.provincia);
}

export function coincide(o: Oferta, f: Filtros, hoy = hoyMadrid()): boolean {
  const has = (a?: unknown[]) => Array.isArray(a) && a.length > 0;
  if (has(f.fuentes) && !f.fuentes!.includes(o.fuente)) return false;
  if (has(f.comunidades) && !f.comunidades!.includes(o.comunidad || "")) return false;
  if (has(f.provincias) && !f.provincias!.includes(o.provincia || "")) return false;
  if (has(f.subtipos)) {
    // Una subcategoría manda sobre su sector; los sectores elegidos sin subcategoría entran enteros.
    const conSub = new Set(f.subtipos!.map((k) => SUBTIPOS[k]?.sector).filter(Boolean));
    const okSub = !!o.subtipo && f.subtipos!.includes(o.subtipo);
    const okSector = has(f.tipos) && f.tipos!.includes(o.tipo || "otros") && !conSub.has(o.tipo || "");
    if (!okSub && !okSector) return false;
  } else if (has(f.tipos) && !f.tipos!.includes(o.tipo || "otros")) return false;
  if (typeof f.nivelMax === "number" && o.nivel != null && Number(o.nivel) > f.nivelMax) return false;
  if (f.cerca && typeof f.cerca.lat === "number") {
    const p = coordDe(o);
    if (!p || distanciaKm(p, [f.cerca.lon, f.cerca.lat]) > (f.cerca.km || 25)) return false;
  }
  if (has(f.dificultades) && !f.dificultades!.includes(Number(o.dificultad || 2))) return false;
  if (has(f.grupos) && !f.grupos!.includes(o.grupo || "?")) return false;
  if (f.soloInterinos && !Number(o.interino)) return false;
  if (has(f.sistemas) && !f.sistemas!.some((k) => (k === "interino" ? Number(o.interino) === 1 : o.sistema === k))) return false;
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
