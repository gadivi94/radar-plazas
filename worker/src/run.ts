// Ciclo programado: recoger (1 vez al día) → completar fichas por tandas → avisar.
import { actualizar, alertasActivas, getMeta, insertarNuevas, setMeta } from "./db";
import { coincide, estadoActual, hoyMadrid, type Filtros } from "./filters";
import { enviarPush } from "./push";
import { enriquecerBoe, fetchSumario, itemsSeccion2B, ofertaDesdeBoe } from "./sources/boe";
import { CIDO_FEEDS, enriquecerCido, fetchFeed, ofertasDesdeFeed } from "./sources/cido";
import { ofertasTmb, TMB_URL } from "./sources/tmb";
import { fmt } from "./classify";
import { correoActivo, enviarCorreo, escHtml, plantilla, sitio, type Correo } from "./mail";
import { tokenBaja } from "./cuentas";
import type { Env, Oferta } from "./types";

const UA = { "User-Agent": "RadarPlazas/1.0 (+https://radaropos.com)" };

function horaMadrid(d = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hourCycle: "h23" }).format(d));
}

export interface Resumen { recogidas: number; completadas: number; avisos: number; correos: number; errores: string[] }

export async function ciclo(env: Env, opts: { forzarRecogida?: boolean } = {}): Promise<Resumen> {
  const hoy = hoyMadrid();
  const ahora = new Date().toISOString();
  const res: Resumen = { recogidas: 0, completadas: 0, avisos: 0, correos: 0, errores: [] };
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
    try { await limpieza(env); } catch (e) { res.errores.push("limpieza: " + String(e)); }
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
  // Avisos: el administrador (y las alertas antiguas sin dueño) por push o por la tarea diaria de Claude
  // (meta.avisos_pendientes); cada cuenta con avisos por correo recibe un único email con todo lo suyo.
  const pendientes: Array<{ title: string; body: string; fecha: string }> = [];
  if (candidatas.length) {
    const usuarios = new Map((await env.DB.prepare("SELECT id, email, admin, avisos_email FROM users").all<{ id: string; email: string; admin: number; avisos_email: number }>()).results.map((u) => [u.id, u]));
    const porCorreo = new Map<string, Array<{ alerta: string; hits: Oferta[] }>>();
    for (const a of alertas) {
      const hits = candidatas.filter((o) => estadoActual(o, hoy) !== "cerrada" && coincide(o, a.f, hoy));
      if (!hits.length) continue;
      hits.sort((x, y) => (x.plazo_fin || "9999").localeCompare(y.plazo_fin || "9999"));
      const dueño = a.uid ? usuarios.get(a.uid) : undefined;
      if (a.uid && !dueño) continue; // cuenta borrada
      if (dueño?.avisos_email) porCorreo.set(dueño.id, [...(porCorreo.get(dueño.id) || []), { alerta: a.nombre, hits }]);
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
    if (correoActivo(env)) {
      for (const [uid, secciones] of porCorreo) {
        try { await enviarCorreo(env, await correoAvisos(env, usuarios.get(uid)!, secciones)); res.correos++; }
        catch (e) { res.errores.push(`correo ${uid}: ${String(e).slice(0, 120)}`); }
      }
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

async function correoAvisos(env: Env, u: { id: string; email: string }, secciones: Array<{ alerta: string; hits: Oferta[] }>): Promise<Correo> {
  const web = sitio(env);
  const total = secciones.reduce((a, s) => a + s.hits.length, 0);
  const baja = `${web}/api/baja?u=${u.id}&t=${await tokenBaja(env, u.id)}`;
  const fila = (o: Oferta) => {
    const lugar = o.municipio || o.provincia || o.comunidad || "";
    const plazo = o.plazo_fin ? `hasta el ${fmt(o.plazo_fin)}` : o.plazo_texto || "plazo aún sin fijar";
    return `<li style="margin:0 0 10px"><a href="${escHtml(o.url || web)}" style="color:#14232b;font-weight:bold">${escHtml(corto(o.titulo))}</a><br>
<span style="color:#5b6b72;font-size:13px">${escHtml([o.organismo, lugar].filter(Boolean).join(" · "))} · ${escHtml(plazo)}</span></li>`;
  };
  const html = plantilla(env, `<p style="font-size:15px;margin:0 0 16px">Han salido <b>${total} ${total === 1 ? "plaza" : "plazas"}</b> que encajan con tus alertas.</p>
${secciones.map((s) => `<p style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#0d6b6b;margin:18px 0 8px;font-weight:bold">${escHtml(s.alerta)} · ${s.hits.length}</p>
<ul style="padding-left:18px;margin:0">${s.hits.slice(0, 10).map(fila).join("")}</ul>${s.hits.length > 10 ? `<p style="font-size:13px;margin:0">y ${s.hits.length - 10} más en la web.</p>` : ""}`).join("")}
<p style="margin:22px 0 0"><a href="${web}" style="display:inline-block;background:#0d6b6b;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">Ver en Radar de Plazas</a></p>
<p style="font-size:12px;color:#5b6b72;margin:16px 0 0">Comprueba siempre los requisitos y el plazo en la convocatoria oficial.</p>`,
    `Recibes este correo porque tienes alertas activas. <a href="${baja}" style="color:#5b6b72">Dejar de recibir avisos</a>`);
  const text = `Han salido ${total} plazas que encajan con tus alertas.\n\n` + secciones.map((s) => `${s.alerta}\n` + s.hits.slice(0, 10).map((o) => `- ${corto(o.titulo)} (${o.municipio || o.provincia || o.comunidad || ""}) ${o.url || ""}`).join("\n")).join("\n\n") + `\n\nVer todo: ${web}\nDejar de recibir avisos: ${baja}`;
  return {
    to: u.email,
    subject: `${total} ${total === 1 ? "plaza nueva" : "plazas nuevas"} para tus alertas · Radar de Plazas`,
    html, text,
    headers: { "List-Unsubscribe": `<${baja}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
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
    db.prepare("DELETE FROM otp WHERE exp < ?").bind(Date.now() - 3600_000),
  ]);
}
