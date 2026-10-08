// Coordenadas de los municipios fuera de Cataluña (Cataluña se resuelve en la web con el mapa del ICGC) para el mapa 3D.
// Nominatim (OpenStreetMap): como mucho 1 petición por segundo y pocas al día; se guarda todo en geocache.
import type { Env } from "./types";

const UA = { "User-Agent": "RadarPlazas/1.0 (+https://radaropos.com; hola@radaropos.com)", "Accept-Language": "es" };
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function geocodificar(env: Env, max = 12, hoy = new Date().toISOString().slice(0, 10)): Promise<number> {
  const filas = (await env.DB.prepare(
    `SELECT DISTINCT municipio, provincia FROM ofertas WHERE lat IS NULL AND municipio IS NOT NULL AND comunidad IS NOT NULL AND comunidad NOT IN ('Cataluña','Estatal')
       AND (plazo_fin IS NULL OR plazo_fin >= ?) AND (estado IS NULL OR estado != 'cerrada') LIMIT ?`,
  ).bind(hoy, max).all<{ municipio: string; provincia: string | null }>()).results;
  let hechas = 0;
  for (const f of filas) {
    const k = `${f.municipio}|${f.provincia || ""}`.toLowerCase();
    let g = await env.DB.prepare("SELECT lat, lon FROM geocache WHERE k = ?").bind(k).first<{ lat: number | null; lon: number | null }>();
    if (!g) {
      try {
        const q = encodeURIComponent([f.municipio, f.provincia, "España"].filter(Boolean).join(", "));
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=es&q=${q}`, { headers: UA });
        const d = r.ok ? ((await r.json()) as Array<{ lat: string; lon: string }>) : [];
        g = d[0] ? { lat: +d[0].lat, lon: +d[0].lon } : { lat: null, lon: null };
        await env.DB.prepare("INSERT OR REPLACE INTO geocache (k, lat, lon) VALUES (?, ?, ?)").bind(k, g.lat, g.lon).run();
        await pausa(1100);
      } catch { continue; }
    }
    // Sin resultado se guarda 0,0 para no volver a preguntar; la web lo ignora.
    await env.DB.prepare("UPDATE ofertas SET lat = ?, lon = ? WHERE municipio = ? AND COALESCE(provincia,'') = ? AND lat IS NULL")
      .bind(g.lat ?? 0, g.lon ?? 0, f.municipio, f.provincia || "").run();
    hechas++;
  }
  return hechas;
}
