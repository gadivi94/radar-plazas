// Radar de Plazas · API + web (assets) + tarea programada.
import { ciclo } from "./run";
import { coincide, estadoActual, hoyMadrid, type Filtros } from "./filters";
import { getMeta, setMeta } from "./db";
import { COMUNIDADES } from "./geo";
import { DIFICULTAD_LABEL, TIPOS } from "./classify";
import type { Env, Oferta } from "./types";

const MARCAS = ["nueva", "visto", "interesa", "presentada", "descartada"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });

let claveCache: string | null = null;
/** La clave puede venir de un secreto (APP_TOKEN) o de la tabla meta de D1 (k = "app_token"). */
async function clave(env: Env): Promise<string | null> {
  if (env.APP_TOKEN) return env.APP_TOKEN;
  if (claveCache === null) claveCache = (await getMeta(env, "app_token")) || "";
  return claveCache || null;
}
async function autorizado(req: Request, env: Env): Promise<boolean> {
  const k = await clave(env);
  if (!k) return false;
  const h = req.headers.get("Authorization") || "";
  return h === `Bearer ${k}`;
}

const lista = (v: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined);

function filtrosDesdeQuery(u: URL): Filtros & { q?: string } {
  return {
    comunidades: lista(u.searchParams.get("comunidad")),
    provincias: lista(u.searchParams.get("provincia")),
    zonas: lista(u.searchParams.get("zona")),
    tipos: lista(u.searchParams.get("tipo")),
    dificultades: lista(u.searchParams.get("dificultad"))?.map(Number),
    grupos: lista(u.searchParams.get("grupo")),
    fuentes: lista(u.searchParams.get("fuente")),
    palabras: u.searchParams.get("q") ? [u.searchParams.get("q")!] : undefined,
    soloInterinos: u.searchParams.get("interino") === "1",
    soloAbiertas: u.searchParams.get("abiertas") !== "0",
  };
}

async function api(req: Request, env: Env, u: URL): Promise<Response> {
  const path = u.pathname.replace(/^\/api/, "");
  const hoy = hoyMadrid();

  if (path === "/ofertas" && req.method === "GET") {
    const f = filtrosDesdeQuery(u);
    const marca = u.searchParams.get("marca"); // "guardadas" = interesa+presentada
    const where: string[] = [];
    const binds: unknown[] = [];
    if (u.searchParams.get("vista") === "panel") {
      // Todo lo que el panel necesita: lo abierto (con cualquier marca) y lo que marcaste aunque haya cerrado.
      const rows = (await env.DB.prepare(
        `SELECT * FROM ofertas WHERE ((plazo_fin IS NULL OR plazo_fin >= ?) AND (estado IS NULL OR estado != 'cerrada')) OR marca IN ('interesa','presentada')
         ORDER BY CASE WHEN plazo_fin IS NULL THEN 1 ELSE 0 END, plazo_fin ASC LIMIT 5000`,
      ).bind(hoy).all<Oferta>()).results;
      return json({ total: rows.length, items: rows.map((o) => ({ ...o, estado: estadoActual(o, hoy) })) });
    }
    if (marca === "guardadas") where.push("marca IN ('interesa','presentada')");
    else if (marca && MARCAS.includes(marca)) { where.push("marca = ?"); binds.push(marca); }
    else where.push("marca != 'descartada'");
    if (f.comunidades?.length) { where.push(`comunidad IN (${f.comunidades.map(() => "?").join(",")})`); binds.push(...f.comunidades); }
    if (f.tipos?.length) { where.push(`tipo IN (${f.tipos.map(() => "?").join(",")})`); binds.push(...f.tipos); }
    if (f.soloAbiertas) { where.push("(plazo_fin IS NULL OR plazo_fin >= ?) AND (estado IS NULL OR estado != 'cerrada')"); binds.push(hoy); }
    const rows = (await env.DB.prepare(
      `SELECT * FROM ofertas WHERE ${where.join(" AND ")} ORDER BY CASE WHEN plazo_fin IS NULL THEN 1 ELSE 0 END, plazo_fin ASC, encontrada DESC LIMIT 3000`,
    ).bind(...binds).all<Oferta>()).results;
    const filtradas = rows.filter((o) => coincide(o, { ...f, comunidades: undefined, tipos: undefined }, hoy));
    const limit = Math.min(Number(u.searchParams.get("limit") || 50), 200);
    const offset = Number(u.searchParams.get("offset") || 0);
    return json({
      total: filtradas.length,
      items: filtradas.slice(offset, offset + limit).map((o) => ({ ...o, estado: estadoActual(o, hoy) })),
    });
  }

  const mId = path.match(/^\/ofertas\/([^/]+)$/);
  if (mId && req.method === "PATCH") {
    const body = (await req.json()) as { marca?: string };
    if (!body.marca || !MARCAS.includes(body.marca)) return json({ error: "Marca no válida" }, 400);
    await env.DB.prepare("UPDATE ofertas SET marca = ? WHERE id = ?").bind(body.marca, decodeURIComponent(mId[1])).run();
    return json({ ok: true });
  }

  if (path === "/catalogo") {
    const counts = (await env.DB.prepare(
      "SELECT comunidad, tipo, COUNT(*) n FROM ofertas WHERE (plazo_fin IS NULL OR plazo_fin >= ?) AND marca != 'descartada' GROUP BY comunidad, tipo",
    ).bind(hoy).all<{ comunidad: string; tipo: string; n: number }>()).results;
    return json({ comunidades: COMUNIDADES, tipos: TIPOS, dificultades: DIFICULTAD_LABEL.slice(1), grupos: ["AP", "C2", "C1", "B", "A2", "A1"], counts });
  }

  if (path === "/alertas" && req.method === "GET") {
    const r = (await env.DB.prepare("SELECT * FROM alertas ORDER BY creada").all<{ filtros: string }>()).results;
    return json(r.map((a) => ({ ...a, filtros: JSON.parse(a.filtros) })));
  }
  if (path === "/alertas" && req.method === "POST") {
    const b = (await req.json()) as { nombre?: string; filtros?: Filtros };
    if (!b.nombre?.trim()) return json({ error: "Ponle un nombre a la alerta" }, 400);
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO alertas (id, nombre, filtros, activa, creada) VALUES (?, ?, ?, 1, ?)")
      .bind(id, b.nombre.trim(), JSON.stringify(b.filtros || {}), new Date().toISOString()).run();
    return json({ id }, 201);
  }
  const mA = path.match(/^\/alertas\/([^/]+)$/);
  if (mA && req.method === "PUT") {
    const b = (await req.json()) as { nombre?: string; filtros?: Filtros; activa?: boolean };
    const cur = await env.DB.prepare("SELECT * FROM alertas WHERE id = ?").bind(mA[1]).first<{ nombre: string; filtros: string; activa: number }>();
    if (!cur) return json({ error: "No existe" }, 404);
    await env.DB.prepare("UPDATE alertas SET nombre = ?, filtros = ?, activa = ? WHERE id = ?").bind(
      b.nombre?.trim() || cur.nombre, b.filtros ? JSON.stringify(b.filtros) : cur.filtros, b.activa === undefined ? cur.activa : b.activa ? 1 : 0, mA[1],
    ).run();
    return json({ ok: true });
  }
  if (mA && req.method === "DELETE") {
    await env.DB.prepare("DELETE FROM alertas WHERE id = ?").bind(mA[1]).run();
    return json({ ok: true });
  }

  if (path === "/devices" && req.method === "POST") {
    const b = (await req.json()) as { token?: string; platform?: string };
    if (!b.token || !/^Expo(nent)?PushToken\[/.test(b.token)) return json({ error: "Token de push no válido" }, 400);
    await env.DB.prepare("INSERT OR IGNORE INTO devices (token, platform, creado) VALUES (?, ?, ?)").bind(b.token, b.platform || null, new Date().toISOString()).run();
    return json({ ok: true });
  }

  if (path === "/estado") {
    return json({ ultima_recogida: await getMeta(env, "ultima_recogida"), ultima_ejecucion: JSON.parse((await getMeta(env, "ultima_ejecucion")) || "null") });
  }

  if (path === "/run" && req.method === "POST") {
    return json(await ciclo(env, { forzarRecogida: u.searchParams.get("recoger") === "1" }));
  }

  return json({ error: "No encontrado" }, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const u = new URL(req.url);
    if (u.pathname.startsWith("/api/")) {
      if (req.method === "OPTIONS") return new Response(null, { headers: cors });
      // La revisión la lanza GitHub Actions cada 15 min sin clave; es idempotente y tiene freno.
      if (u.pathname === "/api/run" && req.method === "POST" && !(await autorizado(req, env))) {
        const ultima = Number((await getMeta(env, "run_inicio")) || 0);
        if (Date.now() - ultima < 4 * 60_000) return json({ omitida: "Se ejecutó hace menos de 4 minutos" }, 429);
        await setMeta(env, "run_inicio", String(Date.now()));
        return json(await ciclo(env));
      }
      if (!(await autorizado(req, env))) return json({ error: "Falta la clave de acceso" }, 401);
      try { return await api(req, env, u); }
      catch (e) { return json({ error: String(e) }, 500); }
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(_c: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(ciclo(env).then(() => undefined));
  },
} satisfies ExportedHandler<Env>;
