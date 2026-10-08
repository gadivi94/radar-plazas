import type { Env, Oferta } from "./types";

const COLS = [
  "id", "fuente", "titulo", "organismo", "municipio", "provincia", "comunidad", "tipo", "grupo", "sistema",
  "dificultad", "interino", "estado", "plazo_fin", "plazo_texto", "plazo_aprox", "plazas", "url", "tramite_url",
  "detalle_url", "resumen", "publicado", "encontrada", "detalle_ok", "notificada", "marca",
  "subtipo", "nivel", "requisitos", "historia", "revisada", "ia_resumen", "lat", "lon",
] as const;

const val = (v: unknown) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

/** Inserta ofertas nuevas sin tocar las existentes (el usuario puede haberlas marcado). */
export async function insertarNuevas(env: Env, ofertas: Oferta[]): Promise<number> {
  if (!ofertas.length) return 0;
  const sql = `INSERT OR IGNORE INTO ofertas (${COLS.join(",")}) VALUES (${COLS.map(() => "?").join(",")})`;
  const stmts = ofertas.map((o) => env.DB.prepare(sql).bind(...COLS.map((c) => val((o as unknown as Record<string, unknown>)[c] ?? (c === "marca" ? "nueva" : c === "notificada" ? 0 : null)))));
  let n = 0;
  for (let i = 0; i < stmts.length; i += 50) {
    const res = await env.DB.batch(stmts.slice(i, i + 50));
    n += res.reduce((a, r) => a + (r.meta?.changes || 0), 0);
  }
  return n;
}

export async function actualizar(env: Env, id: string, cambios: Partial<Oferta>): Promise<void> {
  const keys = Object.keys(cambios).filter((k) => (COLS as readonly string[]).includes(k) && k !== "id");
  if (!keys.length) return;
  await env.DB.prepare(`UPDATE ofertas SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`)
    .bind(...keys.map((k) => val((cambios as Record<string, unknown>)[k])), id).run();
}

export async function getMeta(env: Env, k: string): Promise<string | null> {
  const r = await env.DB.prepare("SELECT v FROM meta WHERE k = ?").bind(k).first<{ v: string }>();
  return r?.v ?? null;
}
export async function setMeta(env: Env, k: string, v: string): Promise<void> {
  await env.DB.prepare("INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(k, v).run();
}

export interface Alerta { id: string; nombre: string; filtros: string; activa: number; creada: string; uid: string | null }
export async function alertasActivas(env: Env): Promise<Alerta[]> {
  return (await env.DB.prepare("SELECT * FROM alertas WHERE activa = 1").all<Alerta>()).results;
}
