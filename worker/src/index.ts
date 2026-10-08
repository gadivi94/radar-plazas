// Radar de Plazas · API + web (assets) + tarea programada.
// Las plazas son públicas; las marcas y las alertas son de cada cuenta (entrada con código por correo).
import { ciclo } from "./run";
import { coincide, estadoActual, hoyMadrid, type Filtros } from "./filters";
import { getMeta, setMeta } from "./db";
import { COMUNIDADES } from "./geo";
import { DIFICULTAD_LABEL, TIPOS } from "./classify";
import { asegurarEsquema, CORS, esClaveAdmin, json, limiteAlertas, rutasCuenta, sha256, usuarioDe, type Usuario } from "./cuentas";
import { calendario } from "./ics";
import { iaActiva, preguntaIA, resumenIA } from "./ia";
import { corto, rutaPlaza } from "./avisos";
import { paginaPlaza, paginaSector, sitemap } from "./paginas";
import { estadisticas } from "./estadisticas";
import { telegramWebhook } from "./telegram";
import type { Env, Oferta } from "./types";

async function cupoIA(env: Env, k: string, max: number): Promise<boolean> {
  const dia = new Date().toISOString().slice(0, 10);
  const r = await env.DB.prepare("INSERT INTO ia_uso (k, n, dia) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN dia = excluded.dia THEN n + 1 ELSE 1 END, dia = excluded.dia RETURNING n").bind(k, dia).first<{ n: number }>();
  return (r?.n ?? 0) <= max;
}

const MARCAS = ["visto", "interesa", "presentada", "admitido", "examen", "aprobado", "bolsa", "descartada"];
// Lo que no hace falta enviar al navegador
const OCULTAS = ["detalle_url", "detalle_ok", "notificada", "marca", "mi_marca", "mi_notas", "mi_docs", "revisada", "ia_resumen", "resumen"] as const;

const lista = (v: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined);

function filtrosDesdeQuery(u: URL): Filtros | null {
  const f: Filtros = {
    comunidades: lista(u.searchParams.get("comunidad")),
    provincias: lista(u.searchParams.get("provincia")),
    zonas: lista(u.searchParams.get("zona")),
    tipos: lista(u.searchParams.get("tipo")),
    subtipos: lista(u.searchParams.get("subtipo")),
    nivelMax: u.searchParams.get("nivel") ? Number(u.searchParams.get("nivel")) : undefined,
    dificultades: lista(u.searchParams.get("dificultad"))?.map(Number),
    grupos: lista(u.searchParams.get("grupo")),
    fuentes: lista(u.searchParams.get("fuente")),
    palabras: u.searchParams.get("q") ? [u.searchParams.get("q")!] : undefined,
    soloInterinos: u.searchParams.get("interino") === "1",
  };
  return Object.values(f).some((v) => (Array.isArray(v) ? v.length : v !== undefined && v !== false)) ? f : null;
}

type ConMarca = Oferta & { mi_marca?: string | null; mi_notas?: string | null; mi_docs?: string | null };
const parse = (s: string | null | undefined) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
function publica(o: ConMarca, hoy: string) {
  const r: Record<string, unknown> = { ...o, estado: estadoActual(o, hoy), marca: o.mi_marca || "nueva", requisitos: parse(o.requisitos), historia: parse(o.historia), ruta: rutaPlaza(o) };
  if (o.mi_notas) r.notas = o.mi_notas;
  if (o.mi_docs) r.docs = parse(o.mi_docs);
  for (const k of OCULTAS) if (k !== "marca") delete r[k];
  return r;
}
const ofertaPorRuta = (env: Env, f: string, code: string) => env.DB.prepare("SELECT * FROM ofertas WHERE id = ?").bind(`${f}:${decodeURIComponent(code)}`).first<Oferta>();

async function api(req: Request, env: Env, u: URL, yo: Usuario | null): Promise<Response> {
  const path = u.pathname.replace(/^\/api/, "");
  const hoy = hoyMadrid();
  const conSesion = (fn: (yo: Usuario) => Promise<Response>) =>
    yo ? fn(yo) : Promise.resolve(json({ error: "Entra con tu correo para usar esta función.", sesion: false }, 401));

  if (path === "/ofertas" && req.method === "GET") {
    // Sin sesión la respuesta es igual para todos: se guarda 5 minutos en la caché de Cloudflare.
    const cache = !yo && typeof caches !== "undefined" ? (caches as unknown as { default: Cache }).default : null;
    const clave = new Request(u.toString(), { method: "GET" });
    if (cache) { const c = await cache.match(clave); if (c) return c; }
    // Lo abierto y, con sesión, también lo que guardaste aunque haya cerrado.
    const rows = yo
      ? (await env.DB.prepare(
        `SELECT o.*, m.marca AS mi_marca, m.notas AS mi_notas, m.docs AS mi_docs FROM ofertas o LEFT JOIN marcas m ON m.oferta_id = o.id AND m.uid = ?
         WHERE ((o.plazo_fin IS NULL OR o.plazo_fin >= ?) AND (o.estado IS NULL OR o.estado != 'cerrada')) OR m.marca IN ('interesa','presentada','admitido','examen','aprobado','bolsa')
         ORDER BY CASE WHEN o.plazo_fin IS NULL THEN 1 ELSE 0 END, o.plazo_fin ASC LIMIT 5000`,
      ).bind(yo.id, hoy).all<ConMarca>()).results
      : (await env.DB.prepare(
        `SELECT * FROM ofertas WHERE (plazo_fin IS NULL OR plazo_fin >= ?) AND (estado IS NULL OR estado != 'cerrada')
         ORDER BY CASE WHEN plazo_fin IS NULL THEN 1 ELSE 0 END, plazo_fin ASC LIMIT 5000`,
      ).bind(hoy).all<Oferta>()).results;
    const f = filtrosDesdeQuery(u);
    const limite = Number(u.searchParams.get("limit") || 0);
    const todas = (f ? rows.filter((o) => coincide(o, f, hoy)) : rows);
    const items = (limite > 0 ? todas.slice(0, Math.min(limite, 100)) : todas).map((o) => publica(o, hoy));
    const resp = json({ total: todas.length, items });
    if (cache) { const c = new Response(resp.body, resp); c.headers.set("Cache-Control", "public, max-age=300"); await cache.put(clave, c.clone()); return c; }
    return resp;
  }

  const mId = path.match(/^\/ofertas\/([^/]+)$/);
  if (mId && req.method === "PATCH") return conSesion(async (yo) => {
    const body = (await req.json().catch(() => ({}))) as { marca?: string; notas?: string; docs?: Record<string, boolean> };
    const id = decodeURIComponent(mId[1]);
    if (body.marca !== undefined && !MARCAS.includes(body.marca)) return json({ error: "Marca no válida" }, 400);
    const cur = await env.DB.prepare("SELECT marca, notas, docs FROM marcas WHERE uid = ? AND oferta_id = ?").bind(yo.id, id).first<{ marca: string; notas: string | null; docs: string | null }>();
    const marca = body.marca ?? cur?.marca ?? "interesa";
    const notas = body.notas !== undefined ? String(body.notas).slice(0, 2000) : cur?.notas ?? null;
    const docs = body.docs !== undefined ? JSON.stringify(body.docs).slice(0, 2000) : cur?.docs ?? null;
    await env.DB.prepare("INSERT INTO marcas (uid, oferta_id, marca, ts, notas, docs) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(uid, oferta_id) DO UPDATE SET marca = excluded.marca, ts = excluded.ts, notas = excluded.notas, docs = excluded.docs")
      .bind(yo.id, id, marca, new Date().toISOString(), notas, docs).run();
    return json({ ok: true });
  });

  if (path === "/catalogo") {
    const counts = (await env.DB.prepare(
      "SELECT comunidad, tipo, COUNT(*) n FROM ofertas WHERE (plazo_fin IS NULL OR plazo_fin >= ?) GROUP BY comunidad, tipo",
    ).bind(hoy).all<{ comunidad: string; tipo: string; n: number }>()).results;
    return json({ comunidades: COMUNIDADES, tipos: TIPOS, dificultades: DIFICULTAD_LABEL.slice(1), grupos: ["AP", "C2", "C1", "B", "A2", "A1"], counts });
  }

  if (path === "/alertas" && req.method === "GET") return conSesion(async (yo) => {
    const r = (await env.DB.prepare("SELECT id, nombre, filtros, activa, creada FROM alertas WHERE uid = ? ORDER BY creada").bind(yo.id).all<{ filtros: string }>()).results;
    return json(r.map((a) => ({ ...a, filtros: JSON.parse(a.filtros) })));
  });
  if (path === "/alertas" && req.method === "POST") return conSesion(async (yo) => {
    const b = (await req.json().catch(() => ({}))) as { nombre?: string; filtros?: Filtros };
    if (!b.nombre?.trim()) return json({ error: "Ponle un nombre a la alerta" }, 400);
    const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM alertas WHERE uid = ?").bind(yo.id).first<{ n: number }>())?.n ?? 0;
    const max = limiteAlertas(env, yo);
    if (n >= max) return json({ error: `Con la cuenta gratuita puedes tener hasta ${max} alertas. Borra o edita una para crear otra.`, limite: max }, 403);
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO alertas (id, nombre, filtros, activa, creada, uid) VALUES (?, ?, ?, 1, ?, ?)")
      .bind(id, b.nombre.trim().slice(0, 80), JSON.stringify(b.filtros || {}), new Date().toISOString(), yo.id).run();
    return json({ id }, 201);
  });
  const mA = path.match(/^\/alertas\/([^/]+)$/);
  if (mA && req.method === "PUT") return conSesion(async (yo) => {
    const b = (await req.json().catch(() => ({}))) as { nombre?: string; filtros?: Filtros; activa?: boolean };
    const cur = await env.DB.prepare("SELECT * FROM alertas WHERE id = ? AND uid = ?").bind(mA[1], yo.id).first<{ nombre: string; filtros: string; activa: number }>();
    if (!cur) return json({ error: "No existe" }, 404);
    await env.DB.prepare("UPDATE alertas SET nombre = ?, filtros = ?, activa = ? WHERE id = ? AND uid = ?").bind(
      b.nombre?.trim().slice(0, 80) || cur.nombre, b.filtros ? JSON.stringify(b.filtros) : cur.filtros, b.activa === undefined ? cur.activa : b.activa ? 1 : 0, mA[1], yo.id,
    ).run();
    return json({ ok: true });
  });
  if (mA && req.method === "DELETE") return conSesion(async (yo) => {
    await env.DB.prepare("DELETE FROM alertas WHERE id = ? AND uid = ?").bind(mA[1], yo.id).run();
    return json({ ok: true });
  });

  if (path === "/devices" && req.method === "POST") return conSesion(async () => {
    const b = (await req.json().catch(() => ({}))) as { token?: string; platform?: string };
    if (!b.token || !/^Expo(nent)?PushToken\[/.test(b.token)) return json({ error: "Token de push no válido" }, 400);
    await env.DB.prepare("INSERT OR IGNORE INTO devices (token, platform, creado) VALUES (?, ?, ?)").bind(b.token, b.platform || null, new Date().toISOString()).run();
    return json({ ok: true });
  });

  // Calendario: una plaza o el calendario suscrito de cada usuario
  const mIcs = path.match(/^\/ics\/([a-z]+)\/(.+)$/);
  if (mIcs) {
    const o = await ofertaPorRuta(env, mIcs[1], mIcs[2].replace(/\.ics$/, ""));
    return o ? calendario(env, corto(o.titulo), [o]) : json({ error: "No existe" }, 404);
  }
  const mCal = path.match(/^\/cal\/([a-f0-9]+)\/([a-f0-9]+)\.ics$/);
  if (mCal) {
    const us = await env.DB.prepare("SELECT id FROM users WHERE id = ? AND cal_token = ?").bind(mCal[1], mCal[2]).first<{ id: string }>();
    if (!us) return json({ error: "Calendario no válido" }, 404);
    const filas = (await env.DB.prepare("SELECT o.*, m.marca AS marca FROM marcas m JOIN ofertas o ON o.id = m.oferta_id WHERE m.uid = ? AND m.marca IN ('interesa','presentada','admitido','examen') AND o.plazo_fin IS NOT NULL").bind(us.id).all<Oferta>()).results;
    return calendario(env, "Radar de Plazas", filas);
  }

  // IA: resumen público (se guarda) y preguntas con cuenta (límite diario)
  const mIa = path.match(/^\/ia\/resumen\/([a-z]+)\/(.+)$/);
  if (mIa) {
    const o = await ofertaPorRuta(env, mIa[1], mIa[2]);
    if (!o) return json({ error: "No existe" }, 404);
    if (o.ia_resumen) return json({ resumen: o.ia_resumen, guardado: true });
    if (!iaActiva(env)) return json({ error: "La IA aún no está activada." }, 503);
    if (!(await cupoIA(env, "r:" + (await sha256(req.headers.get("CF-Connecting-IP") || "0")).slice(0, 20), 30))) return json({ error: "Has pedido muchos resúmenes hoy. Vuelve mañana." }, 429);
    try {
      const r = await resumenIA(env, o);
      if (r) await env.DB.prepare("UPDATE ofertas SET ia_resumen = ? WHERE id = ?").bind(r, o.id).run();
      return json({ resumen: r });
    } catch (e) { return json({ error: "La IA no ha podido responder ahora. Inténtalo en un rato.", detalle: String(e).slice(0, 120) }, 502); }
  }
  if (path === "/ia/pregunta" && req.method === "POST") return conSesion(async (yo) => {
    if (!iaActiva(env)) return json({ error: "La IA aún no está activada." }, 503);
    const b = (await req.json().catch(() => ({}))) as { id?: string; pregunta?: string };
    const o = b.id ? await env.DB.prepare("SELECT * FROM ofertas WHERE id = ?").bind(b.id).first<Oferta>() : null;
    if (!o || !b.pregunta?.trim()) return json({ error: "Falta la plaza o la pregunta" }, 400);
    const max = yo.admin || yo.plan === "pro" ? 100 : Number(env.IA_DIARIAS || 10);
    if (!(await cupoIA(env, "p:" + yo.id, max))) return json({ error: `Has llegado a las ${max} preguntas de hoy. Mañana más.` }, 429);
    try { return json({ respuesta: await preguntaIA(env, o, b.pregunta.trim()) }); }
    catch (e) { return json({ error: "La IA no ha podido responder ahora. Inténtalo en un rato.", detalle: String(e).slice(0, 120) }, 502); }
  });

  if (path === "/estadisticas") return json(await estadisticas(env, hoy));

  if (path === "/estado") {
    const e = JSON.parse((await getMeta(env, "ultima_ejecucion")) || "null");
    return json({ ultima_recogida: await getMeta(env, "ultima_recogida"), ultima_ejecucion: e && { fecha: e.fecha, recogidas: e.recogidas, completadas: e.completadas } });
  }

  return json({ error: "No encontrado" }, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const u = new URL(req.url);
    if (u.pathname.startsWith("/api/")) {
      if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
      try {
        await asegurarEsquema(env);
        // La revisión la lanza GitHub Actions cada 15 min sin clave; es idempotente y tiene freno.
        if (u.pathname === "/api/run" && req.method === "POST") {
          const admin = (await esClaveAdmin(req, env)) || !!(await usuarioDe(req, env))?.admin;
          if (!admin) {
            const ultima = Number((await getMeta(env, "run_inicio")) || 0);
            if (Date.now() - ultima < 4 * 60_000) return json({ omitida: "Se ejecutó hace menos de 4 minutos" }, 429);
            await setMeta(env, "run_inicio", String(Date.now()));
            return json(await ciclo(env));
          }
          return json(await ciclo(env, { forzarRecogida: u.searchParams.get("recoger") === "1" }));
        }
        const path = u.pathname.replace(/^\/api/, "");
        if (path === "/telegram/webhook" && req.method === "POST") return await telegramWebhook(req, env);
        const r = await rutasCuenta(req, env, path, u);
        if (r) return r;
        return await api(req, env, u, await usuarioDe(req, env));
      } catch (e) { return json({ error: String(e) }, 500); }
    }
    // Páginas generadas en el servidor (fichas, sectores, sitemap)
    const mP = u.pathname.match(/^\/plaza\/([a-z]+)\/([^/]+)(?:\/[^/]*)?$/);
    const mS = u.pathname.match(/^\/oposiciones(?:\/([a-z0-9-]+))?(?:\/([a-z0-9-]+))?\/?$/);
    if (mP || mS || u.pathname === "/sitemap.xml") {
      try {
        await asegurarEsquema(env);
        const r = mP ? await paginaPlaza(env, mP[1], mP[2]) : mS ? await paginaSector(env, mS[1], mS[2]) : await sitemap(env);
        if (r) return r;
        return new Response("No encontrada", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      } catch (e) { return new Response("Error: " + String(e), { status: 500 }); }
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(_c: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(asegurarEsquema(env).then(() => ciclo(env)).then(() => undefined));
  },
} satisfies ExportedHandler<Env>;
