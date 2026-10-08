// Radar de Plazas · API + web (assets) + tarea programada.
// Las plazas son públicas; las marcas y las alertas son de cada cuenta (entrada con código por correo).
import { ciclo } from "./run";
import { coincide, estadoActual, hoyMadrid, type Filtros } from "./filters";
import { getMeta, setMeta } from "./db";
import { COMUNIDADES } from "./geo";
import { DIFICULTAD_LABEL, TIPOS } from "./classify";
import { asegurarEsquema, CORS, esClaveAdmin, json, limiteAlertas, rutasCuenta, usuarioDe, type Usuario } from "./cuentas";
import type { Env, Oferta } from "./types";

const MARCAS = ["visto", "interesa", "presentada", "descartada"];
// Lo que no hace falta enviar al navegador
const OCULTAS = ["detalle_url", "detalle_ok", "notificada", "marca", "mi_marca"] as const;

const lista = (v: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined);

function filtrosDesdeQuery(u: URL): Filtros | null {
  const f: Filtros = {
    comunidades: lista(u.searchParams.get("comunidad")),
    provincias: lista(u.searchParams.get("provincia")),
    zonas: lista(u.searchParams.get("zona")),
    tipos: lista(u.searchParams.get("tipo")),
    dificultades: lista(u.searchParams.get("dificultad"))?.map(Number),
    grupos: lista(u.searchParams.get("grupo")),
    fuentes: lista(u.searchParams.get("fuente")),
    palabras: u.searchParams.get("q") ? [u.searchParams.get("q")!] : undefined,
    soloInterinos: u.searchParams.get("interino") === "1",
  };
  return Object.values(f).some((v) => (Array.isArray(v) ? v.length : v)) ? f : null;
}

function publica(o: Oferta & { mi_marca?: string | null }, hoy: string) {
  const r: Record<string, unknown> = { ...o, estado: estadoActual(o, hoy), marca: o.mi_marca || "nueva" };
  for (const k of OCULTAS) if (k !== "marca") delete r[k];
  return r;
}

async function api(req: Request, env: Env, u: URL, yo: Usuario | null): Promise<Response> {
  const path = u.pathname.replace(/^\/api/, "");
  const hoy = hoyMadrid();
  const conSesion = (fn: (yo: Usuario) => Promise<Response>) =>
    yo ? fn(yo) : Promise.resolve(json({ error: "Entra con tu correo para usar esta función.", sesion: false }, 401));

  if (path === "/ofertas" && req.method === "GET") {
    // Lo abierto y, con sesión, también lo que guardaste aunque haya cerrado.
    const rows = yo
      ? (await env.DB.prepare(
        `SELECT o.*, m.marca AS mi_marca FROM ofertas o LEFT JOIN marcas m ON m.oferta_id = o.id AND m.uid = ?
         WHERE ((o.plazo_fin IS NULL OR o.plazo_fin >= ?) AND (o.estado IS NULL OR o.estado != 'cerrada')) OR m.marca IN ('interesa','presentada')
         ORDER BY CASE WHEN o.plazo_fin IS NULL THEN 1 ELSE 0 END, o.plazo_fin ASC LIMIT 5000`,
      ).bind(yo.id, hoy).all<Oferta & { mi_marca: string | null }>()).results
      : (await env.DB.prepare(
        `SELECT * FROM ofertas WHERE (plazo_fin IS NULL OR plazo_fin >= ?) AND (estado IS NULL OR estado != 'cerrada')
         ORDER BY CASE WHEN plazo_fin IS NULL THEN 1 ELSE 0 END, plazo_fin ASC LIMIT 5000`,
      ).bind(hoy).all<Oferta>()).results;
    const f = filtrosDesdeQuery(u);
    const items = (f ? rows.filter((o) => coincide(o, f, hoy)) : rows).map((o) => publica(o, hoy));
    return json({ total: items.length, items });
  }

  const mId = path.match(/^\/ofertas\/([^/]+)$/);
  if (mId && req.method === "PATCH") return conSesion(async (yo) => {
    const body = (await req.json().catch(() => ({}))) as { marca?: string };
    if (!body.marca || !MARCAS.includes(body.marca)) return json({ error: "Marca no válida" }, 400);
    await env.DB.prepare("INSERT INTO marcas (uid, oferta_id, marca, ts) VALUES (?, ?, ?, ?) ON CONFLICT(uid, oferta_id) DO UPDATE SET marca = excluded.marca, ts = excluded.ts")
      .bind(yo.id, decodeURIComponent(mId[1]), body.marca, new Date().toISOString()).run();
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
        const r = await rutasCuenta(req, env, path, u);
        if (r) return r;
        return await api(req, env, u, await usuarioDe(req, env));
      } catch (e) { return json({ error: String(e) }, 500); }
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(_c: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(asegurarEsquema(env).then(() => ciclo(env)).then(() => undefined));
  },
} satisfies ExportedHandler<Env>;
