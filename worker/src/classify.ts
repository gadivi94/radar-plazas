// Clasificación por reglas: tipo de puesto, grupo, sistema, interinidad, dificultad y plazo.
import { norm } from "./geo";

import { clasificar, SECTOR_NOMBRE } from "./sectores";

/** Sectores (antes «tipos»). Las claves antiguas se mantienen para no romper alertas guardadas. */
export const TIPOS = SECTOR_NOMBRE;
export type Tipo = string;

export function tipoDe(titulo: string, texto = ""): Tipo {
  return clasificar(titulo, texto).tipo;
}

export function grupoDe(texto: string): string | null {
  const t = norm(texto);
  // CIDO: "C2 - ESO…", "Agrupacions professionals"
  if (/agrupacions? professionals|agrupaciones profesionales|agrupacion profesional|grupo e\b/.test(t)) return "AP";
  const m = t.match(/sub(?:grupo|grup)\s*:?\s*(a1|a2|c1|c2)\b/) || t.match(/\bgrupo\s*:?\s*(a1|a2|b|c1|c2)\b/) || t.match(/^(a1|a2|b|c1|c2)\s*-/);
  if (m) return m[1].toUpperCase();
  if (/\b(a1)\b/.test(t)) return "A1";
  if (/\b(a2)\b/.test(t)) return "A2";
  if (/\b(c1)\b/.test(t)) return "C1";
  if (/\b(c2)\b/.test(t)) return "C2";
  return null;
}

export type Sistema = "concurso" | "concurso-oposicion" | "oposicion" | "bolsa";
export function sistemaDe(texto: string): Sistema | null {
  const t = norm(texto);
  if (/concurso[- ]oposicion|concurs[- ]oposicio|valoracio de merits i prova|valoracion de meritos y prueba/.test(t)) return "concurso-oposicion";
  if (/\boposicio\b|\boposicion\b|oposicio o prova|oposicion o prueba/.test(t)) return "oposicion";
  if (/concurso de meritos|concurs de merits|valoracio de merits|valoracion de meritos|\bconcurso\b|\bconcurs\b/.test(t)) return "concurso";
  if (/borsa|bolsa/.test(t)) return "bolsa";
  return null;
}

export function interinoDe(texto: string): boolean {
  return /interi|interin|temporal|borsa de treball|bolsa de trabajo|bolsa de empleo|substitucio|sustitucion|programa temporal/.test(norm(texto));
}

/** 1 fácil · 2 media · 3 difícil. */
export function dificultadDe(o: { grupo?: string | null; sistema?: string | null; interino?: boolean; tipo?: string }): number {
  const base: Record<string, number> = { AP: 1, C2: 1, C1: 2, B: 2, A2: 3, A1: 3 };
  let d = o.grupo ? base[o.grupo] ?? 2 : 2;
  if (o.sistema === "concurso" || o.sistema === "bolsa") d -= 1;
  if (o.interino) d -= 1;
  if (o.tipo === "seguridad" && o.sistema !== "concurso") d = Math.max(d, 2); // pruebas físicas y temario
  return Math.min(3, Math.max(1, d));
}

export const DIFICULTAD_LABEL = ["", "Fácil", "Media", "Difícil"];

const NUM: Record<string, number> = {
  diez: 10, quince: 15, veinte: 20, "veinticinco": 25, treinta: 30, cuarenta: 40, deu: 10, quinze: 15, vint: 20, trenta: 30,
};

/** Plazo de solicitudes a partir de un anuncio del BOE: "veinte días hábiles … desde el día siguiente". */
export function plazoDesde(texto: string, publicado: string): { fin: string; aprox: boolean; texto: string } | null {
  const t = norm(texto);
  const m = t.match(/(\d{1,2}|diez|quince|veinte|veinticinco|treinta|cuarenta|deu|quinze|vint|trenta)\s+dies?\s+(habiles|naturales|habils|naturals)|(\d{1,2}|diez|quince|veinte|veinticinco|treinta|cuarenta)\s+dias\s+(habiles|naturales)/);
  if (!m) return null;
  const raw = m[1] || m[3];
  const tipo = m[2] || m[4];
  const n = /^\d+$/.test(raw) ? parseInt(raw, 10) : NUM[raw];
  if (!n) return null;
  const habiles = tipo.startsWith("habil");
  const d = new Date(publicado + "T12:00:00Z");
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (!habiles || (wd !== 0 && wd !== 6)) left--;
  }
  return { fin: d.toISOString().slice(0, 10), aprox: habiles, texto: `${n} días ${habiles ? "hábiles" : "naturales"} desde el ${fmt(publicado)}` };
}

export function fmt(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** dd/mm/yyyy → yyyy-mm-dd */
export function isoDe(ddmmyyyy: string | undefined | null): string | null {
  const m = (ddmmyyyy || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function plazasDe(titulo: string): number | null {
  const m = norm(titulo).match(/^(\d+)\s+plac|(\d+)\s+plazas?/);
  if (m) return parseInt(m[1] || m[2], 10);
  if (/^1 placa|una plaza|^una plaza/.test(norm(titulo))) return 1;
  return null;
}
