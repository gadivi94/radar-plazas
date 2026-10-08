// Estadísticas públicas a partir de lo recogido: por sector, comunidad, provincia y mes, y municipios con más plazas de policía.
import { SECTOR_NOMBRE, SUBTIPOS } from "./sectores";
import type { Env } from "./types";

export async function estadisticas(env: Env, hoy: string) {
  const db = env.DB;
  const abiertas = "(plazo_fin IS NULL OR plazo_fin >= ?) AND (estado IS NULL OR estado NOT IN ('cerrada','revisar'))";
  const q = async <T>(sql: string, ...b: unknown[]) => (await db.prepare(sql).bind(...b).all<T>()).results;
  const [tot] = await q<{ n: number; plazas: number }>(`SELECT COUNT(*) AS n, COALESCE(SUM(plazas),0) AS plazas FROM ofertas WHERE ${abiertas}`, hoy);
  const [hist] = await q<{ n: number; desde: string }>("SELECT COUNT(*) AS n, MIN(encontrada) AS desde FROM ofertas");
  const [semana] = await q<{ n: number }>("SELECT COUNT(*) AS n FROM ofertas WHERE encontrada >= ?", new Date(Date.now() - 7 * 864e5).toISOString());
  const sectores = await q<{ k: string; n: number }>(`SELECT COALESCE(tipo,'otros') AS k, COUNT(*) AS n FROM ofertas WHERE ${abiertas} GROUP BY k ORDER BY n DESC`, hoy);
  const subtipos = await q<{ k: string; n: number }>(`SELECT subtipo AS k, COUNT(*) AS n FROM ofertas WHERE subtipo IS NOT NULL AND ${abiertas} GROUP BY k ORDER BY n DESC LIMIT 15`, hoy);
  const comunidades = await q<{ k: string; n: number }>(`SELECT COALESCE(comunidad,'?') AS k, COUNT(*) AS n FROM ofertas WHERE ${abiertas} GROUP BY k ORDER BY n DESC`, hoy);
  const provincias = await q<{ k: string; n: number }>(`SELECT provincia AS k, COUNT(*) AS n FROM ofertas WHERE provincia IS NOT NULL AND ${abiertas} GROUP BY k ORDER BY n DESC`, hoy);
  const meses = await q<{ k: string; n: number }>("SELECT substr(COALESCE(publicado, encontrada),1,7) AS k, COUNT(*) AS n FROM ofertas GROUP BY k ORDER BY k DESC LIMIT 12");
  const mesesSector = await q<{ k: string; s: string; n: number }>("SELECT substr(COALESCE(publicado, encontrada),1,7) AS k, COALESCE(tipo,'otros') AS s, COUNT(*) AS n FROM ofertas GROUP BY k, s");
  const policia = await q<{ k: string; n: number; plazas: number }>("SELECT municipio AS k, COUNT(*) AS n, COALESCE(SUM(plazas),0) AS plazas FROM ofertas WHERE subtipo = 'policia-local' AND municipio IS NOT NULL GROUP BY municipio ORDER BY n DESC, plazas DESC LIMIT 15");
  const dificultad = await q<{ k: number; n: number }>(`SELECT COALESCE(dificultad,2) AS k, COUNT(*) AS n FROM ofertas WHERE ${abiertas} GROUP BY k`, hoy);
  const grupos = await q<{ k: string; n: number }>(`SELECT COALESCE(grupo,'?') AS k, COUNT(*) AS n FROM ofertas WHERE ${abiertas} GROUP BY k`, hoy);
  return {
    actualizado: new Date().toISOString(), abiertas: tot?.n ?? 0, plazasAbiertas: tot?.plazas ?? 0, historico: hist?.n ?? 0, desde: hist?.desde ?? null, ultimos7: semana?.n ?? 0,
    sectores: sectores.map((r) => ({ ...r, nombre: SECTOR_NOMBRE[r.k] || r.k })),
    subtipos: subtipos.map((r) => ({ ...r, nombre: SUBTIPOS[r.k]?.nombre || r.k })),
    comunidades, provincias, meses: meses.reverse(), mesesSector, policia, dificultad, grupos,
  };
}
