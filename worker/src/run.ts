// Ciclo programado: recoger (1 vez al día) → completar fichas por tandas → avisar.
import { actualizar, alertasActivas, getMeta, insertarNuevas, setMeta } from "./db";
import { coincide, estadoActual, hoyMadrid, type Filtros } from "./filters";
import { enviarPush } from "./push";
import { enriquecerBoe, fetchSumario, itemsSeccion2B, ofertaDesdeBoe } from "./sources/boe";
import { CIDO_FEEDS, enriquecerCido, fetchFeed, ofertasDesdeFeed } from "./sources/cido";
import { ofertasTmb, TMB_URL } from "./sources/tmb";
import { fmt } from "./classify";
import type { Env, Oferta } from "./types";

const UA = { "User-Agent": "RadarPlazas/1.0 (uso personal)" };

function horaMadrid(d = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hourCycle: "h23" }).format(d));
}

export interface Resumen { recogidas: number; completadas: number; avisos: number; errores: string[] }

export async function ciclo(env: Env, opts: { forzarRecogida?: boolean } = {}): Promise<Resumen> {
  const hoy = hoyMadrid();
  const ahora = new Date().toISOString();
  const res: Resumen = { recogidas: 0, completadas: 0, avisos: 0, errores: [] };
  let presupuesto = Number(env.ENRICH_BUDGET || 35);

  // 1 · Recogida diaria (BOE se publica hacia las 7:30)
  const ultima = await getMeta(env, "ultima_recogida");
  if (opts.forzarRecogida || (ultima !== hoy && horaMadrid() >= 8)) {
    const nuevas: Oferta[] = [];
    try {
      const json = await fetchSumario(hoy.replace(/-/g, "")); presupuesto--;
      if (json) for (const it of itemsSeccion2B(json)) {
        const o = ofertaDesdeBoe(it, hoy, ahora);
        // Cataluña llega más completa por el CIDO (bolsas, interinos, plazos): no duplicar sus anuncios locales.
        if (o.comunidad === "Cataluña" && o.municipio) continue;
        nuevas.push(o);
      }
    } catch (e) { res.errores.push(String(e)); }
    for (const feed of CIDO_FEEDS) {
      try { nuevas.push(...ofertasDesdeFeed(await fetchFeed(feed), ahora)); presupuesto--; }
      catch (e) { res.errores.push(String(e)); }
    }
    try {
      const r = await fetch(TMB_URL, { headers: UA }); presupuesto--;
      if (r.ok) nuevas.push(...ofertasTmb(await r.text(), hoy, ahora));
    } catch (e) { res.errores.push(String(e)); }
    const unicas = [...new Map(nuevas.map((o) => [o.id, o])).values()];
    res.recogidas = await insertarNuevas(env, unicas);
    await setMeta(env, "ultima_recogida", hoy);
  }

  // 2 · Completar fichas, primero las que encajan con alguna alerta
  const alertas = (await alertasActivas(env)).map((a) => ({ ...a, f: JSON.parse(a.filtros) as Filtros }));
  const pend = (await env.DB.prepare(
    "SELECT * FROM ofertas WHERE detalle_ok = 0 AND detalle_url IS NOT NULL ORDER BY encontrada DESC LIMIT 400",
  ).all<Oferta>()).results;
  const prioridad = (o: Oferta) => (alertas.some((a) => coincide(o, { ...a.f, grupos: undefined, dificultades: undefined }, hoy)) ? 0 : 1);
  pend.sort((a, b) => prioridad(a) - prioridad(b));
  for (const o of pend.slice(0, Math.max(0, presupuesto - 2))) {
    try {
      const r = await fetch(o.detalle_url!, { headers: { ...UA, Accept: o.fuente === "BOE" ? "application/xml" : "text/html" } });
      if (!r.ok) { await actualizar(env, o.id, { detalle_ok: r.status === 404 ? 1 : 0 }); continue; }
      const body = await r.text();
      const extra = o.fuente === "BOE" ? enriquecerBoe(o, body) : enriquecerCido(o, body);
      await actualizar(env, o.id, extra);
      res.completadas++;
    } catch (e) { res.errores.push(`${o.id}: ${String(e)}`); }
  }

  // 3 · Avisos: ofertas ya completadas (o con más de 3 h esperando ficha) aún no avisadas
  const candidatas = (await env.DB.prepare(
    `SELECT * FROM ofertas WHERE notificada = 0 AND (detalle_ok = 1 OR (julianday('now') - julianday(encontrada)) * 24 > 3)`,
  ).all<Oferta>()).results;
  // Sin iPhone registrado, los avisos se guardan y los envía la tarea diaria de Claude (lee meta.avisos_pendientes).
  const pendientes: Array<{ title: string; body: string; fecha: string }> = [];
  if (candidatas.length) {
    for (const a of alertas) {
      const hits = candidatas.filter((o) => estadoActual(o, hoy) !== "cerrada" && coincide(o, a.f, hoy));
      if (!hits.length) continue;
      hits.sort((x, y) => (x.plazo_fin || "9999").localeCompare(y.plazo_fin || "9999"));
      const lineas = hits.slice(0, 3).map((o) => `• ${corto(o.titulo)} · ${o.municipio || o.provincia || o.comunidad || ""}${o.plazo_fin ? ` (hasta ${fmt(o.plazo_fin).slice(0, 5)})` : ""}`);
      const extra = hits.length > 3 ? `\n+${hits.length - 3} más` : "";
      const msg = {
        title: `${hits.length} ${hits.length === 1 ? "plaza nueva" : "plazas nuevas"} · ${a.nombre}`,
        body: lineas.join("\n") + extra,
        data: { alerta: a.id, ids: hits.slice(0, 20).map((o) => o.id) },
      };
      const p = await enviarPush(env, msg);
      res.avisos += p.enviados;
      if (p.enviados === 0) pendientes.push({ title: msg.title, body: msg.body, fecha: ahora });
      else if (p.errores.length) res.errores.push(...p.errores);
    }
    const ids = candidatas.map((o) => o.id);
    for (let i = 0; i < ids.length; i += 90) {
      const lote = ids.slice(i, i + 90);
      await env.DB.prepare(`UPDATE ofertas SET notificada = 1 WHERE id IN (${lote.map(() => "?").join(",")})`).bind(...lote).run();
    }
  }

  if (pendientes.length) {
    const prev = JSON.parse((await getMeta(env, "avisos_pendientes")) || "[]") as unknown[];
    await setMeta(env, "avisos_pendientes", JSON.stringify([...prev, ...pendientes].slice(-50)));
  }
  await setMeta(env, "ultima_ejecucion", JSON.stringify({ fecha: ahora, ...res, errores: res.errores.slice(0, 5) }));
  return res;
}

function corto(t: string): string {
  const s = t.replace(/^Resoluci[oó]n de \d+ de \w+ de \d{4}, /i, "").replace(/, referente a la convocatoria para proveer/i, ":");
  return s.length > 70 ? s.slice(0, 67) + "…" : s;
}
