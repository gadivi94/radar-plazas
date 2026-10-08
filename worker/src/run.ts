// Ciclo programado (cada 15 min por la mañana):
// recoger (1 vez al día) → reclasificar → completar y revisar fichas → avisos de plazas nuevas, cambios y plazos → resúmenes semanales.
import { actualizar, alertasActivas, getMeta, insertarNuevas, setMeta } from "./db";
import { coincide, estadoActual, hoyMadrid, type Filtros } from "./filters";
import { enviarPush } from "./push";
import { enriquecerBoe, fetchSumario, itemsSeccion2B, ofertaDesdeBoe } from "./sources/boe";
import { CIDO_FEEDS, enriquecerCido, fetchFeed, ofertasDesdeFeed } from "./sources/cido";
import { ofertasTmb, TMB_URL } from "./sources/tmb";
import { recogerEmpresas } from "./sources/transporte";
import { geocodificar } from "./geocodificar";
import { fmt } from "./classify";
import { correoActivo, enviarCorreo } from "./mail";
import { clasificar, nivelDe } from "./sectores";
import { provinciaCatalana } from "./geo";
import { corto, correoAvisos, correoBoletin, correoCambios, correoRecordatorio, enviarTelegram, textoTelegram, type Seccion } from "./avisos";
import type { Env, Oferta } from "./types";

export { corto };
const UA = { "User-Agent": "RadarPlazas/1.0 (+https://radaropos.com)" };

function horaMadrid(d = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hourCycle: "h23" }).format(d));
}
function diaSemanaMadrid(d = new Date()): number { // 1 = lunes
  const w = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "short" }).format(d);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(w);
}
const masDias = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export interface Resumen { recogidas: number; completadas: number; revisadas: number; avisos: number; correos: number; errores: string[]; geo?: number; empresas?: { leidas: number; ofertas: number; fallos: string[] } }
interface Usuario { id: string; email: string; admin: number; avisos_email: number; frecuencia: string | null; boletin: number | null; telegram: string | null }

export async function ciclo(env: Env, opts: { forzarRecogida?: boolean; forzarSemanal?: boolean } = {}): Promise<Resumen> {
  const hoy = hoyMadrid();
  const ahora = new Date().toISOString();
  const res: Resumen = { recogidas: 0, completadas: 0, revisadas: 0, avisos: 0, correos: 0, errores: [] };
  let presupuesto = Number(env.ENRICH_BUDGET || 35);
  const usuarios = new Map((await env.DB.prepare("SELECT id, email, admin, avisos_email, frecuencia, boletin, telegram FROM users").all<Usuario>()).results.map((u) => [u.id, u]));
  const correo = async (c: Promise<Parameters<typeof enviarCorreo>[1]>, quien: string) => {
    if (!correoActivo(env)) return;
    try { await enviarCorreo(env, await c); res.correos++; } catch (e) { res.errores.push(`correo ${quien}: ${String(e).slice(0, 120)}`); }
  };
  const telegram = async (u: Usuario | undefined, titulo: string, plazas: Oferta[]) => {
    if (!u?.telegram || !env.TELEGRAM_BOT_TOKEN) return;
    try { await enviarTelegram(env, u.telegram, textoTelegram(env, titulo, plazas)); } catch (e) { res.errores.push(`telegram ${u.id}: ${String(e).slice(0, 80)}`); }
  };

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
    // Empresas públicas de transporte de toda España
    const emp = await recogerEmpresas(hoy, ahora);
    nuevas.push(...emp.ofertas);
    res.empresas = { leidas: emp.leidas.size, ofertas: emp.ofertas.length, fallos: emp.errores.slice(0, 12) }; // algunas webs bloquean robots: no es un error del Radar
    const unicas = [...new Map(nuevas.map((o) => [o.id, o])).values()];
    res.recogidas = await insertarNuevas(env, unicas);
    // Lo que una empresa ya no muestra se da por cerrado; lo que vuelve a aparecer, se reabre.
    for (const [empresa, ids] of emp.leidas) {
      const fuera = ids.length ? ` AND id NOT IN (${ids.map(() => "?").join(",")})` : "";
      await env.DB.prepare(`UPDATE ofertas SET estado = 'cerrada' WHERE id LIKE ? AND (estado IS NULL OR estado != 'cerrada')${fuera}`).bind(`tr:${empresa}:%`, ...ids).run();
      if (ids.length) await env.DB.prepare(`UPDATE ofertas SET estado = 'abierta' WHERE estado = 'cerrada' AND id IN (${ids.map(() => "?").join(",")})`).bind(...ids).run();
    }
    await setMeta(env, "ultima_recogida", hoy);
    try { await limpieza(env); } catch (e) { res.errores.push("limpieza: " + String(e)); }
  }

  // 2 · Reclasificar una vez lo que se guardó con la clasificación antigua (sin subcategoría ni requisitos)
  if ((await getMeta(env, "reclasificado")) !== "2") {
    try { await reclasificar(env, hoy); await setMeta(env, "reclasificado", "2"); } catch (e) { res.errores.push("reclasificar: " + String(e)); }
  }

  // 3 · Completar fichas (primero las que encajan con alguna alerta) y revisar las que la gente sigue
  const alertas = (await alertasActivas(env)).map((a) => ({ ...a, f: JSON.parse(a.filtros) as Filtros }));
  const pend = (await env.DB.prepare(
    "SELECT * FROM ofertas WHERE detalle_ok = 0 AND detalle_url IS NOT NULL ORDER BY encontrada DESC LIMIT 400",
  ).all<Oferta>()).results;
  const prioridad = (o: Oferta) => (alertas.some((a) => coincide(o, { ...a.f, grupos: undefined, dificultades: undefined, nivelMax: undefined }, hoy)) ? 0 : 1);
  pend.sort((a, b) => prioridad(a) - prioridad(b));
  // Fichas del CIDO guardadas por alguien y sin revisar en 3 días: estado, plazos y novedades
  const seguidas = (await env.DB.prepare(
    `SELECT o.* FROM ofertas o WHERE o.fuente = 'CIDO' AND o.detalle_ok = 1 AND o.detalle_url IS NOT NULL
       AND (o.revisada IS NULL OR o.revisada < ?) AND (o.plazo_fin IS NULL OR o.plazo_fin >= ?)
       AND EXISTS (SELECT 1 FROM marcas m WHERE m.oferta_id = o.id AND m.marca NOT IN ('descartada','visto'))
     ORDER BY o.revisada LIMIT 15`,
  ).bind(new Date(Date.now() - 3 * 864e5).toISOString(), masDias(hoy, -60)).all<Oferta>()).results;
  const cupo = Math.max(0, presupuesto - 2);
  const nRevision = Math.min(seguidas.length, 5, cupo);
  const elegidas = [...pend.slice(0, cupo - nRevision).map((o) => ({ o, revision: false })), ...seguidas.slice(0, nRevision).map((o) => ({ o, revision: true }))];
  const cambios: Array<{ o: Oferta; texto: string }> = [];
  // Fichas en paralelo (6 a la vez) y con tope de tiempo, para que cada revisión termine siempre.
  const tope = Date.now() + Number(env.TIEMPO_FICHAS_MS || 70_000);
  const cola = [...elegidas];
  const trabajador = async () => {
    for (let x = cola.shift(); x; x = cola.shift()) {
      if (Date.now() > tope) return;
      const { o, revision } = x;
      try {
        const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 15_000);
        const r = await fetch(o.detalle_url!, { headers: { ...UA, Accept: o.fuente === "BOE" ? "application/xml" : "text/html" }, signal: ctrl.signal }).finally(() => clearTimeout(to));
        if (!r.ok) { await actualizar(env, o.id, revision ? { revisada: ahora } : { detalle_ok: r.status === 404 ? 1 : 0 }); continue; }
        const body = await r.text();
        const extra: Partial<Oferta> = o.fuente === "BOE" ? enriquecerBoe(o, body) : enriquecerCido(o, body);
        const texto = revision ? describirCambio(o, extra) : null;
        if (texto) {
          extra.historia = JSON.stringify([...JSON.parse(o.historia || "[]"), { fecha: ahora, texto }].slice(-20));
          cambios.push({ o: { ...o, ...extra } as Oferta, texto });
        }
        await actualizar(env, o.id, { ...extra, revisada: ahora });
        if (revision) res.revisadas++; else res.completadas++;
      } catch (e) { res.errores.push(`${o.id}: ${String(e).slice(0, 100)}`); }
    }
  };
  await Promise.all(Array.from({ length: 6 }, trabajador));
  if (cambios.length) {
    const ids = cambios.map((c) => c.o.id);
    const quien = (await env.DB.prepare(`SELECT uid, oferta_id FROM marcas WHERE marca NOT IN ('descartada','visto') AND oferta_id IN (${ids.map(() => "?").join(",")})`)
      .bind(...ids).all<{ uid: string; oferta_id: string }>()).results;
    const porUsuario = new Map<string, Array<{ o: Oferta; texto: string }>>();
    for (const q of quien) porUsuario.set(q.uid, [...(porUsuario.get(q.uid) || []), cambios.find((c) => c.o.id === q.oferta_id)!]);
    for (const [uid, lista] of porUsuario) {
      const u = usuarios.get(uid);
      if (u?.avisos_email) await correo(correoCambios(env, u, lista), uid);
      await telegram(u, "Novedades en plazas que sigues", lista.map((c) => c.o));
    }
  }

  // Coordenadas para el mapa 3D (pocas por vuelta, con pausa)
  try { res.geo = await geocodificar(env, Number(env.GEO_POR_VUELTA || 12)); } catch (_) { /* opcional */ }

  // 4 · Avisos de plazas nuevas: ya completadas (o con más de 3 h esperando ficha) y aún no avisadas
  const candidatas = (await env.DB.prepare(
    `SELECT * FROM ofertas WHERE notificada = 0 AND (detalle_ok = 1 OR (julianday('now') - julianday(encontrada)) * 24 > 3)`,
  ).all<Oferta>()).results;
  // El administrador (y las alertas antiguas sin dueño) por push o por la tarea diaria de Claude (meta.avisos_pendientes);
  // cada cuenta recibe un único correo con todo lo suyo (o nada si eligió el resumen semanal).
  const pendientes: Array<{ title: string; body: string; fecha: string }> = [];
  if (candidatas.length) {
    const porUsuario = new Map<string, Seccion[]>();
    for (const a of alertas) {
      const hits = candidatas.filter((o) => estadoActual(o, hoy) !== "cerrada" && coincide(o, a.f, hoy));
      if (!hits.length) continue;
      hits.sort((x, y) => (x.plazo_fin || "9999").localeCompare(y.plazo_fin || "9999"));
      const dueño = a.uid ? usuarios.get(a.uid) : undefined;
      if (a.uid && !dueño) continue; // cuenta borrada
      if (dueño) porUsuario.set(dueño.id, [...(porUsuario.get(dueño.id) || []), { alerta: a.nombre, hits }]);
      if (dueño && !dueño.admin) continue;
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
    for (const [uid, secciones] of porUsuario) {
      const u = usuarios.get(uid)!;
      if (u.avisos_email && u.frecuencia !== "semanal") await correo(correoAvisos(env, u, secciones), uid);
      const todas = [...new Map(secciones.flatMap((s) => s.hits).map((o) => [o.id, o])).values()];
      await telegram(u, `${todas.length} ${todas.length === 1 ? "plaza nueva" : "plazas nuevas"} para tus alertas`, todas);
    }
    const ids = candidatas.map((o) => o.id);
    for (let i = 0; i < ids.length; i += 90) {
      const lote = ids.slice(i, i + 90);
      await env.DB.prepare(`UPDATE ofertas SET notificada = 1 WHERE id IN (${lote.map(() => "?").join(",")})`).bind(...lote).run();
    }
  }

  // 5 · Recordatorio: plazas en «Me interesa» (sin presentar) que cierran en 3 días o menos
  if (horaMadrid() >= 9 || opts.forzarRecogida) {
    const rec = (await env.DB.prepare(
      `SELECT m.uid AS uid_marca, o.* FROM marcas m JOIN ofertas o ON o.id = m.oferta_id
       WHERE m.marca = 'interesa' AND COALESCE(m.recordado, 0) = 0 AND o.plazo_fin IS NOT NULL AND o.plazo_fin >= ? AND o.plazo_fin <= ?`,
    ).bind(hoy, masDias(hoy, 3)).all<Oferta & { uid_marca: string }>()).results;
    const porUsuario = new Map<string, Oferta[]>();
    for (const r of rec) porUsuario.set(r.uid_marca, [...(porUsuario.get(r.uid_marca) || []), r]);
    for (const [uid, plazas] of porUsuario) {
      const u = usuarios.get(uid);
      if (!u) continue;
      if (u.avisos_email) await correo(correoRecordatorio(env, u, plazas), uid);
      await telegram(u, "⏰ Cierran pronto y aún no las has presentado", plazas);
      if (u.admin) pendientes.push({ title: `⏰ ${plazas.length === 1 ? "Cierra pronto una plaza que te interesa" : `${plazas.length} plazas que te interesan cierran pronto`}`, body: plazas.map((o) => `• ${corto(o.titulo)} (hasta ${fmt(o.plazo_fin!)})`).join("\n"), fecha: ahora });
      await env.DB.batch(plazas.map((o) => env.DB.prepare("UPDATE marcas SET recordado = 1 WHERE uid = ? AND oferta_id = ?").bind(uid, o.id)));
    }
  }

  // 6 · Lunes: resumen semanal de alertas (para quien lo eligió) y boletín de plazas destacadas
  const semana = `semanal:${hoy}`;
  if (opts.forzarSemanal || (diaSemanaMadrid() === 1 && horaMadrid() >= 10 && (await getMeta(env, "ultimo_semanal")) !== semana)) {
    await setMeta(env, "ultimo_semanal", semana);
    const desde = new Date(Date.now() - 7 * 864e5).toISOString();
    const semanales = (await env.DB.prepare(
      "SELECT * FROM ofertas WHERE encontrada >= ? AND (plazo_fin IS NULL OR plazo_fin >= ?) AND (estado IS NULL OR estado != 'cerrada')",
    ).bind(desde, hoy).all<Oferta>()).results;
    for (const u of usuarios.values()) {
      if (u.frecuencia === "semanal" && u.avisos_email) {
        const secciones = alertas.filter((a) => a.uid === u.id).map((a) => ({ alerta: a.nombre, hits: semanales.filter((o) => coincide(o, a.f, hoy)) })).filter((s) => s.hits.length);
        if (secciones.length) await correo(correoAvisos(env, u, secciones, true), u.id);
      }
      if (u.boletin && semanales.length) {
        const destacadas = [...semanales].sort((a, b) => (Number(b.plazas) || 1) - (Number(a.plazas) || 1) || (a.plazo_fin || "9999").localeCompare(b.plazo_fin || "9999"));
        await correo(correoBoletin(env, u, destacadas), u.id);
      }
    }
  }

  if (pendientes.length) {
    const prev = JSON.parse((await getMeta(env, "avisos_pendientes")) || "[]") as unknown[];
    await setMeta(env, "avisos_pendientes", JSON.stringify([...prev, ...pendientes].slice(-50)));
  }
  await setMeta(env, "ultima_ejecucion", JSON.stringify({ fecha: ahora, ...res, errores: res.errores.slice(0, 5) }));
  return res;
}

/** Qué ha cambiado en una ficha que alguien sigue. */
export function describirCambio(antes: Oferta, despues: Partial<Oferta>): string | null {
  const est: Record<string, string> = { abierta: "plazo de solicitudes abierto", pendiente: "pendiente de plazo", cerrada: "plazo cerrado o proceso resuelto" };
  const partes: string[] = [];
  if (despues.plazo_fin && despues.plazo_fin !== antes.plazo_fin) partes.push(antes.plazo_fin ? `nuevo plazo: hasta el ${fmt(despues.plazo_fin)} (antes ${fmt(antes.plazo_fin)})` : `ya tiene plazo: hasta el ${fmt(despues.plazo_fin)}`);
  if (despues.estado && antes.estado && despues.estado !== antes.estado) partes.push(`estado: ${est[despues.estado] || despues.estado}`);
  return partes.length ? partes.join(" · ") : null;
}

/** Aplica la clasificación por sectores a lo ya guardado y vuelve a leer las fichas abiertas sin requisitos. */
async function reclasificar(env: Env, hoy: string) {
  const filas = (await env.DB.prepare("SELECT id, titulo, resumen, grupo, nivel, municipio, provincia, comunidad FROM ofertas WHERE subtipo IS NULL").all<Oferta>()).results;
  const stmts = filas.map((o) => {
    const c = clasificar(o.titulo, o.resumen || "");
    const prov = o.provincia || (o.comunidad === "Cataluña" ? provinciaCatalana(o.municipio) : null);
    return env.DB.prepare("UPDATE ofertas SET tipo = ?, subtipo = ?, nivel = COALESCE(nivel, ?), provincia = ? WHERE id = ?").bind(c.tipo, c.subtipo, nivelDe(o.grupo), prov, o.id);
  });
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  await env.DB.prepare("UPDATE ofertas SET detalle_ok = 0 WHERE requisitos IS NULL AND detalle_url IS NOT NULL AND fuente != 'TMB' AND (plazo_fin IS NULL OR plazo_fin >= ?)").bind(hoy).run();
}

/** Plazos de conservación de la política de privacidad (una vez al día). */
async function limpieza(env: Env) {
  const db = env.DB;
  const viejas = (await db.prepare("SELECT id, email FROM users WHERE admin = 0 AND COALESCE(ultimo, creado) < datetime('now', '-24 months')").all<{ id: string; email: string }>()).results;
  for (const u of viejas) {
    await db.batch([
      db.prepare("DELETE FROM alertas WHERE uid = ?").bind(u.id), db.prepare("DELETE FROM marcas WHERE uid = ?").bind(u.id),
      db.prepare("DELETE FROM sesiones WHERE uid = ?").bind(u.id), db.prepare("DELETE FROM users WHERE id = ?").bind(u.id),
    ]);
  }
  await db.batch([
    db.prepare("DELETE FROM mensajes WHERE fecha < datetime('now', '-12 months')"),
    db.prepare("DELETE FROM limites WHERE dia < date('now', '-2 days')"),
    db.prepare("DELETE FROM ia_uso WHERE dia < date('now', '-2 days')"),
    db.prepare("DELETE FROM otp WHERE exp < ?").bind(Date.now() - 3600_000),
  ]);
}
