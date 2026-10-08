// Cuentas sin contraseña: el servidor envía un código de 6 cifras al correo y, al validarlo, da un testigo de sesión
// (en la base de datos solo se guarda su huella). Igual que en opos365.
import { getMeta, setMeta } from "./db";
import { contacto, correoActivo, enviarCorreo, escHtml, plantilla, sitio } from "./mail";
import type { Env } from "./types";

const SESION_DIAS = 365, OTP_MIN = 10, OTP_INTENTOS = 5, MAX_SESIONES = 8;

export interface Usuario { id: string; email: string; admin: number; plan: string; avisos_email: number; th: string }

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};
export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors } });
export const CORS = cors;

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const rnd = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((x) => x.toString(16).padStart(2, "0")).join("");
export const normEmail = (e: unknown) => String(e || "").trim().toLowerCase();
export const okEmail = (e: string) => e.length <= 120 && /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/.test(e);
const hoy = () => new Date().toISOString().slice(0, 10);
const ipDe = (req: Request) => req.headers.get("CF-Connecting-IP") || "0";

// ---------- esquema: las tablas nuevas se crean solas la primera vez ----------
let ESQUEMA_OK = false;
export async function asegurarEsquema(env: Env): Promise<void> {
  if (ESQUEMA_OK) return;
  const db = env.DB;
  try { await db.prepare("ALTER TABLE alertas ADD COLUMN uid TEXT").run(); } catch (_) { /* ya existe */ }
  await db.batch([
    db.prepare("CREATE INDEX IF NOT EXISTS idx_alertas_uid ON alertas(uid)"),
    db.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, creado TEXT NOT NULL, ultimo TEXT, admin INTEGER DEFAULT 0, plan TEXT DEFAULT 'gratis', avisos_email INTEGER DEFAULT 1, acepta TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS otp (email TEXT PRIMARY KEY, hash TEXT, exp INTEGER, intentos INTEGER, enviado INTEGER)"),
    db.prepare("CREATE TABLE IF NOT EXISTS sesiones (th TEXT PRIMARY KEY, uid TEXT NOT NULL, creada INTEGER, ultima INTEGER)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_sesiones_uid ON sesiones(uid)"),
    db.prepare("CREATE TABLE IF NOT EXISTS marcas (uid TEXT NOT NULL, oferta_id TEXT NOT NULL, marca TEXT NOT NULL, ts TEXT, PRIMARY KEY (uid, oferta_id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS mensajes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, email TEXT, mensaje TEXT, fecha TEXT, ip TEXT, leido INTEGER DEFAULT 0)"),
    db.prepare("CREATE TABLE IF NOT EXISTS limites (k TEXT PRIMARY KEY, n INTEGER, dia TEXT)"),
  ]);
  ESQUEMA_OK = true;
}

// ---------- clave de administración (la de siempre: APP_TOKEN o meta.app_token) ----------
export async function claveAdmin(env: Env): Promise<string | null> {
  return env.APP_TOKEN || (await getMeta(env, "app_token")) || null;
}
export async function esClaveAdmin(req: Request, env: Env): Promise<boolean> {
  const k = await claveAdmin(env);
  return !!k && (req.headers.get("Authorization") || "") === `Bearer ${k}`;
}

/** Límite diario aproximado (códigos, contacto) guardado en D1. */
async function dentroDeLimite(env: Env, clave: string, max: number): Promise<boolean> {
  const r = await env.DB.prepare(
    "INSERT INTO limites (k, n, dia) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN dia = excluded.dia THEN n + 1 ELSE 1 END, dia = excluded.dia RETURNING n",
  ).bind(clave, hoy()).first<{ n: number }>();
  return (r?.n ?? 0) <= max;
}

export async function usuarioDe(req: Request, env: Env): Promise<Usuario | null> {
  const m = (req.headers.get("Authorization") || "").match(/^Bearer\s+([a-f0-9]{64})$/i);
  if (!m) return null;
  const th = await sha256("ses:" + m[1].toLowerCase()), ahora = Date.now();
  const u = await env.DB.prepare(
    "SELECT s.th, s.ultima, u.id, u.email, u.admin, u.plan, u.avisos_email FROM sesiones s JOIN users u ON u.id = s.uid WHERE s.th = ?",
  ).bind(th).first<Usuario & { ultima: number }>();
  if (!u) return null;
  if (ahora - u.ultima > SESION_DIAS * 864e5) { await env.DB.prepare("DELETE FROM sesiones WHERE th = ?").bind(th).run(); return null; }
  if (ahora - u.ultima > 6 * 3600e3) await env.DB.prepare("UPDATE sesiones SET ultima = ? WHERE th = ?").bind(ahora, th).run();
  return u;
}

export const limiteAlertas = (env: Env, u: Usuario) => (u.admin || u.plan === "pro" ? 1000 : Number(env.ALERTAS_GRATIS || 3));
export const tokenBaja = async (env: Env, uid: string) => (await sha256(`baja:${uid}:${env.OTP_PEPPER || (await claveAdmin(env)) || "radar"}`)).slice(0, 32);
const otpHash = (env: Env, email: string, code: string) => sha256(`otp:${email}:${code}:${env.OTP_PEPPER || "radar-plazas"}`);

async function enviarCodigo(env: Env, email: string, code: string) {
  const html = plantilla(env, `<p style="font-size:15px;margin:0 0 16px">Tu código para entrar en Radar de Plazas es:</p>
<p style="font-size:34px;font-weight:bold;letter-spacing:8px;margin:0 0 16px;color:#0d6b6b">${code}</p>
<p style="font-size:13px;color:#5b6b72;margin:0">Caduca en ${OTP_MIN} minutos. Si no lo has pedido tú, ignora este correo.</p>`);
  await enviarCorreo(env, { to: email, subject: `Tu código de Radar de Plazas: ${code}`, html, text: `Tu código para entrar en Radar de Plazas es ${code}. Caduca en ${OTP_MIN} minutos.` });
}

/** Pasa las alertas y marcas de antes de las cuentas (sin dueño) a la cuenta del administrador. */
async function adoptarDatosAntiguos(env: Env, uid: string) {
  const ahora = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE alertas SET uid = ? WHERE uid IS NULL").bind(uid),
    env.DB.prepare("INSERT OR IGNORE INTO marcas (uid, oferta_id, marca, ts) SELECT ?, id, marca, ? FROM ofertas WHERE marca IS NOT NULL AND marca != 'nueva'").bind(uid, ahora),
  ]);
}

/** /api/auth/*, /api/cuenta*, /api/contacto, /api/baja y /api/admin/*. Devuelve null si la ruta no es suya. */
export async function rutasCuenta(req: Request, env: Env, path: string, u: URL): Promise<Response | null> {
  const db = env.DB, ahora = Date.now();
  const cuerpo = async () => { try { return (await req.json()) as Record<string, unknown>; } catch { return {}; } };

  if (path === "/auth/start" && req.method === "POST") {
    if (!correoActivo(env)) return json({ error: "El envío de correos aún no está activado. Inténtalo más tarde." }, 503);
    const b = await cuerpo();
    const email = normEmail(b.email);
    if (!okEmail(email)) return json({ error: "Revisa el correo: no parece correcto." }, 400);
    const prev = await db.prepare("SELECT enviado FROM otp WHERE email = ?").bind(email).first<{ enviado: number }>();
    if (prev && ahora - prev.enviado < 45_000) return json({ error: "Ya te hemos enviado un código. Espera un minuto antes de pedir otro." }, 429);
    if (!(await dentroDeLimite(env, "otp:e:" + (await sha256(email)).slice(0, 24), 8)) || !(await dentroDeLimite(env, "otp:i:" + (await sha256(ipDe(req))).slice(0, 24), 25)))
      return json({ error: `Has pedido demasiados códigos hoy. Vuelve a probar mañana o escribe a ${contacto(env)}.` }, 429);
    const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    await db.prepare("INSERT INTO otp (email, hash, exp, intentos, enviado) VALUES (?, ?, ?, 0, ?) ON CONFLICT(email) DO UPDATE SET hash = excluded.hash, exp = excluded.exp, intentos = 0, enviado = excluded.enviado")
      .bind(email, await otpHash(env, email, code), ahora + OTP_MIN * 60_000, ahora).run();
    try { await enviarCodigo(env, email, code); }
    catch (e) {
      await db.prepare("DELETE FROM otp WHERE email = ?").bind(email).run();
      return json({ error: "No hemos podido enviar el correo ahora mismo. Inténtalo dentro de un rato.", detalle: String(e).slice(0, 160) }, 502);
    }
    const existe = await db.prepare("SELECT 1 AS x FROM users WHERE email = ?").bind(email).first();
    return json({ ok: true, nuevo: !existe });
  }

  if (path === "/auth/verify" && req.method === "POST") {
    const b = await cuerpo();
    const email = normEmail(b.email), code = String(b.code || "").replace(/\D/g, "");
    if (!okEmail(email) || code.length !== 6) return json({ error: "El código tiene 6 cifras." }, 400);
    const o = await db.prepare("SELECT hash, exp, intentos FROM otp WHERE email = ?").bind(email).first<{ hash: string; exp: number; intentos: number }>();
    if (!o || o.exp < ahora) return json({ error: "El código ha caducado. Pide uno nuevo." }, 400);
    if (o.intentos >= OTP_INTENTOS) return json({ error: "Demasiados intentos. Pide un código nuevo." }, 400);
    if (o.hash !== (await otpHash(env, email, code))) {
      await db.prepare("UPDATE otp SET intentos = intentos + 1 WHERE email = ?").bind(email).run();
      return json({ error: "Código incorrecto. Revísalo y vuelve a probar." }, 400);
    }
    let user = await db.prepare("SELECT id, admin FROM users WHERE email = ?").bind(email).first<{ id: string; admin: number }>();
    const fecha = new Date().toISOString();
    if (!user) {
      if (b.acepta !== true) return json({ error: "Para crear la cuenta tienes que aceptar las condiciones de uso y la política de privacidad.", acepta: false }, 400);
      user = { id: rnd(12), admin: 0 };
      await db.prepare("INSERT INTO users (id, email, creado, ultimo, acepta) VALUES (?, ?, ?, ?, ?)").bind(user.id, email, fecha, fecha, fecha).run();
    } else await db.prepare("UPDATE users SET ultimo = ? WHERE id = ?").bind(fecha, user.id).run();
    await db.prepare("DELETE FROM otp WHERE email = ?").bind(email).run();
    // Quien entra con la clave antigua del Radar queda como administrador y recupera sus alertas y marcas.
    const k = await claveAdmin(env);
    if (k && typeof b.clave === "string" && b.clave === k && !user.admin) {
      await db.prepare("UPDATE users SET admin = 1, plan = 'pro' WHERE id = ?").bind(user.id).run();
      await adoptarDatosAntiguos(env, user.id);
      user.admin = 1;
    }
    const token = rnd(32);
    await db.prepare("DELETE FROM sesiones WHERE uid = ? AND th NOT IN (SELECT th FROM sesiones WHERE uid = ? ORDER BY ultima DESC LIMIT ?)").bind(user.id, user.id, MAX_SESIONES - 1).run();
    await db.prepare("INSERT INTO sesiones (th, uid, creada, ultima) VALUES (?, ?, ?, ?)").bind(await sha256("ses:" + token), user.id, ahora, ahora).run();
    return json({ ok: true, token, email, admin: !!user.admin });
  }

  if (path === "/contacto" && req.method === "POST") {
    const b = await cuerpo();
    if (b.web) return json({ ok: true }); // trampa para bots
    const nombre = String(b.nombre || "").trim().slice(0, 80), email = normEmail(b.email), mensaje = String(b.mensaje || "").trim().slice(0, 4000);
    if (!okEmail(email)) return json({ error: "Revisa el correo: no parece correcto." }, 400);
    if (mensaje.length < 10) return json({ error: "Cuéntanos un poco más (mínimo 10 caracteres)." }, 400);
    if (b.acepta !== true) return json({ error: "Tienes que aceptar la política de privacidad para enviar el mensaje." }, 400);
    if (!(await dentroDeLimite(env, "contacto:" + (await sha256(ipDe(req))).slice(0, 24), 5))) return json({ error: "Has enviado varios mensajes hoy. Escríbenos directamente a " + contacto(env) + "." }, 429);
    const fecha = new Date().toISOString();
    await db.prepare("INSERT INTO mensajes (nombre, email, mensaje, fecha, ip) VALUES (?, ?, ?, ?, ?)").bind(nombre, email, mensaje, fecha, (await sha256(ipDe(req))).slice(0, 16)).run();
    // Aviso al móvil del administrador por la tarea diaria de Claude
    const prev = JSON.parse((await getMeta(env, "avisos_pendientes")) || "[]") as unknown[];
    await setMeta(env, "avisos_pendientes", JSON.stringify([...prev, { title: "Nuevo mensaje de contacto", body: `${nombre || email}: ${mensaje.slice(0, 140)}`, fecha }].slice(-50)));
    if (correoActivo(env)) {
      try {
        await enviarCorreo(env, {
          to: contacto(env), replyTo: email, subject: `Contacto Radar de Plazas: ${nombre || email}`,
          html: plantilla(env, `<p><b>${escHtml(nombre)}</b> &lt;${escHtml(email)}&gt;</p><p style="white-space:pre-wrap">${escHtml(mensaje)}</p>`),
          text: `${nombre} <${email}>\n\n${mensaje}`,
        });
      } catch (_) { /* queda guardado en D1 */ }
    }
    return json({ ok: true });
  }

  if (path === "/baja" && (req.method === "GET" || req.method === "POST")) {
    const uid = u.searchParams.get("u") || "", t = u.searchParams.get("t") || "";
    const ok = uid && t === (await tokenBaja(env, uid));
    if (ok) await db.prepare("UPDATE users SET avisos_email = 0 WHERE id = ?").bind(uid).run();
    const msg = ok ? "Listo: ya no recibirás avisos por correo. Puedes volver a activarlos en Mi cuenta." : "El enlace no es válido. Desactiva los avisos desde Mi cuenta.";
    return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Avisos por correo</title>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;padding:0 16px;color:#14232b;background:#eef2f1"><h1 style="font-size:24px">Radar de Plazas</h1><p>${msg}</p><p><a href="${sitio(env)}" style="color:#0d6b6b">Volver a Radar de Plazas</a></p></body>`,
      { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // ---------- a partir de aquí, con sesión ----------
  const esCuenta = path.startsWith("/auth/") || path.startsWith("/cuenta") || path.startsWith("/admin/");
  if (!esCuenta) return null;
  const me = await usuarioDe(req, env);
  const adminPorClave = !me && path.startsWith("/admin/") && (await esClaveAdmin(req, env));
  if (!me && !adminPorClave) return json({ error: "La sesión ha caducado. Vuelve a entrar con tu correo.", sesion: false }, 401);

  if (path.startsWith("/admin/")) {
    if (!adminPorClave && !me?.admin) return json({ error: "Solo para administración" }, 403);
    if (path === "/admin/resumen") {
      const n = async (sql: string) => ((await db.prepare(sql).first<{ n: number }>())?.n ?? 0);
      const mensajes = (await db.prepare("SELECT id, nombre, email, mensaje, fecha, leido FROM mensajes ORDER BY id DESC LIMIT 30").all()).results;
      return json({
        usuarios: await n("SELECT COUNT(*) AS n FROM users"),
        nuevos7: await n("SELECT COUNT(*) AS n FROM users WHERE creado >= datetime('now','-7 days')"),
        avisosEmail: await n("SELECT COUNT(*) AS n FROM users WHERE avisos_email = 1"),
        alertas: await n("SELECT COUNT(*) AS n FROM alertas WHERE activa = 1"),
        sinLeer: await n("SELECT COUNT(*) AS n FROM mensajes WHERE leido = 0"),
        correo: correoActivo(env),
        mensajes,
      });
    }
    if (path === "/admin/leidos" && req.method === "POST") { await db.prepare("UPDATE mensajes SET leido = 1 WHERE leido = 0").run(); return json({ ok: true }); }
    return json({ error: "No encontrado" }, 404);
  }
  const yo = me!;

  if (path === "/auth/logout" && req.method === "POST") { await db.prepare("DELETE FROM sesiones WHERE th = ?").bind(yo.th).run(); return json({ ok: true }); }
  if (path === "/cuenta" && req.method === "GET") {
    const n = await db.prepare("SELECT COUNT(*) AS n FROM alertas WHERE uid = ?").bind(yo.id).first<{ n: number }>();
    return json({ email: yo.email, admin: !!yo.admin, plan: yo.plan, avisos_email: !!yo.avisos_email, alertas: n?.n ?? 0, limite_alertas: limiteAlertas(env, yo), correo: correoActivo(env) });
  }
  if (path === "/cuenta" && req.method === "PATCH") {
    const b = await cuerpo();
    if (typeof b.avisos_email === "boolean") await db.prepare("UPDATE users SET avisos_email = ? WHERE id = ?").bind(b.avisos_email ? 1 : 0, yo.id).run();
    return json({ ok: true });
  }
  if (path === "/cuenta/admin" && req.method === "POST") {
    const b = await cuerpo(), k = await claveAdmin(env);
    if (!k || b.clave !== k) return json({ error: "La clave no es correcta." }, 403);
    await db.prepare("UPDATE users SET admin = 1, plan = 'pro' WHERE id = ?").bind(yo.id).run();
    await adoptarDatosAntiguos(env, yo.id);
    return json({ ok: true });
  }
  if (path === "/cuenta/datos" && req.method === "GET") {
    const user = await db.prepare("SELECT email, creado, ultimo, plan, avisos_email, acepta FROM users WHERE id = ?").bind(yo.id).first();
    const alertas = (await db.prepare("SELECT nombre, filtros, activa, creada FROM alertas WHERE uid = ?").bind(yo.id).all<{ filtros: string }>()).results.map((a) => ({ ...a, filtros: JSON.parse(a.filtros) }));
    const marcas = (await db.prepare("SELECT m.oferta_id, m.marca, m.ts, o.titulo FROM marcas m LEFT JOIN ofertas o ON o.id = m.oferta_id WHERE m.uid = ?").bind(yo.id).all()).results;
    return new Response(JSON.stringify({ exportado: new Date().toISOString(), cuenta: user, alertas, marcas }, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="radar-plazas-mis-datos.json"', ...cors },
    });
  }
  if (path === "/cuenta" && req.method === "DELETE") {
    await db.batch([
      db.prepare("DELETE FROM alertas WHERE uid = ?").bind(yo.id),
      db.prepare("DELETE FROM marcas WHERE uid = ?").bind(yo.id),
      db.prepare("DELETE FROM sesiones WHERE uid = ?").bind(yo.id),
      db.prepare("DELETE FROM otp WHERE email = ?").bind(yo.email),
      db.prepare("DELETE FROM users WHERE id = ?").bind(yo.id),
    ]);
    return json({ ok: true });
  }
  return json({ error: "No encontrado" }, 404);
}
