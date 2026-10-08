// Cuentas sin contraseña: el servidor envía un código de 6 cifras al correo y, al validarlo, da un testigo de sesión
// (en la base de datos solo se guarda su huella). Igual que en opos365.
import { getMeta, setMeta } from "./db";
import { contacto, correoActivo, enviarCorreo, escHtml, plantilla, sitio } from "./mail";
import { configurarWebhook, enlaceTelegram } from "./telegram";
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
const ESQUEMA_VERSION = "4";
export async function asegurarEsquema(env: Env): Promise<void> {
  if (ESQUEMA_OK) return;
  const db = env.DB;
  const columnas: Array<[string, string]> = [
    ["alertas", "uid TEXT"],
    ["ofertas", "subtipo TEXT"], ["ofertas", "nivel INTEGER"], ["ofertas", "requisitos TEXT"], ["ofertas", "historia TEXT"], ["ofertas", "revisada TEXT"], ["ofertas", "ia_resumen TEXT"],
    ["users", "perfil TEXT"], ["users", "frecuencia TEXT DEFAULT 'diaria'"], ["users", "boletin INTEGER DEFAULT 0"], ["users", "telegram TEXT"], ["users", "cal_token TEXT"], ["users", "nombre TEXT"], ["users", "ajustes TEXT"], ["users", "google_sub TEXT"], ["users", "apple_sub TEXT"],
    ["ofertas", "lat REAL"], ["ofertas", "lon REAL"],
    ["marcas", "notas TEXT"], ["marcas", "docs TEXT"], ["marcas", "recordado INTEGER DEFAULT 0"],
  ];
  // Primero las tablas (users y marcas pueden no existir aún), luego las columnas nuevas.
  const tablas = () => db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, creado TEXT NOT NULL, ultimo TEXT, admin INTEGER DEFAULT 0, plan TEXT DEFAULT 'gratis', avisos_email INTEGER DEFAULT 1, acepta TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS otp (email TEXT PRIMARY KEY, hash TEXT, exp INTEGER, intentos INTEGER, enviado INTEGER)"),
    db.prepare("CREATE TABLE IF NOT EXISTS sesiones (th TEXT PRIMARY KEY, uid TEXT NOT NULL, creada INTEGER, ultima INTEGER)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_sesiones_uid ON sesiones(uid)"),
    db.prepare("CREATE TABLE IF NOT EXISTS marcas (uid TEXT NOT NULL, oferta_id TEXT NOT NULL, marca TEXT NOT NULL, ts TEXT, PRIMARY KEY (uid, oferta_id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS mensajes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, email TEXT, mensaje TEXT, fecha TEXT, ip TEXT, leido INTEGER DEFAULT 0)"),
    db.prepare("CREATE TABLE IF NOT EXISTS limites (k TEXT PRIMARY KEY, n INTEGER, dia TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS ia_uso (k TEXT PRIMARY KEY, n INTEGER, dia TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS geocache (k TEXT PRIMARY KEY, lat REAL, lon REAL)"),
  ]);
  await tablas();
  const meta = await db.prepare("SELECT v FROM meta WHERE k = 'esquema'").first<{ v: string }>().catch(() => null);
  if (meta?.v !== ESQUEMA_VERSION) {
    for (const [t, c] of columnas) { try { await db.prepare(`ALTER TABLE ${t} ADD COLUMN ${c}`).run(); } catch (_) { /* ya existe */ } }
    await db.batch([
      db.prepare("CREATE INDEX IF NOT EXISTS idx_ofertas_tipo ON ofertas(tipo, subtipo)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_alertas_uid ON alertas(uid)"),
      db.prepare("INSERT INTO meta (k, v) VALUES ('esquema', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(ESQUEMA_VERSION),
    ]);
  }
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
<p style="font-size:34px;font-weight:bold;letter-spacing:8px;margin:0 0 16px;color:#2f6feb">${code}</p>
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

  if (path === "/auth/config" && req.method === "GET") {
    const g = lista(env.GOOGLE_CLIENT_IDS), a = lista(env.APPLE_CLIENT_IDS);
    return json({ google: g.find((x) => /apps\.googleusercontent\.com$/.test(x) && !/ios/i.test(x)) || g[0] || null, googleIos: g.find((x) => /ios/i.test(x)) || null, apple: a.find((x) => /web|\.service/i.test(x)) || null });
  }

  // Entrar con Google o Apple: se comprueba el id_token con sus claves públicas y se enlaza la cuenta por correo
  if (path === "/auth/social" && req.method === "POST") {
    const b = await cuerpo();
    const prov = b.proveedor === "apple" ? "apple" : b.proveedor === "google" ? "google" : null;
    if (!prov) return json({ error: "Proveedor no válido" }, 400);
    let d: { sub: string; email: string; nombre: string };
    try { d = await verificarIdToken(env, prov, String(b.token || "")); }
    catch (e) { return json({ error: `No se ha podido comprobar la cuenta de ${prov === "google" ? "Google" : "Apple"}. Vuelve a probar.`, detalle: String(e).slice(0, 80) }, 401); }
    const col = prov === "google" ? "google_sub" : "apple_sub";
    let user = await db.prepare(`SELECT id, admin, email, nombre FROM users WHERE ${col} = ?`).bind(d.sub).first<{ id: string; admin: number; email: string; nombre: string | null }>();
    if (!user && d.email) user = await db.prepare("SELECT id, admin, email, nombre FROM users WHERE email = ?").bind(d.email).first();
    const fecha = new Date().toISOString(), nombre = String(b.nombre || d.nombre || "").trim().slice(0, 40) || null;
    let nuevo = false;
    if (!user) {
      if (!d.email) return json({ error: "Tu cuenta no comparte el correo. Entra con tu correo electrónico." }, 400);
      if (b.acepta !== true) return json({ error: "Para crear la cuenta tienes que aceptar las condiciones de uso y la política de privacidad.", acepta: false }, 400);
      user = { id: rnd(12), admin: 0, email: d.email, nombre };
      await db.prepare(`INSERT INTO users (id, email, creado, ultimo, acepta, nombre, ${col}) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(user.id, d.email, fecha, fecha, fecha, nombre, d.sub).run();
      nuevo = true;
    } else {
      await db.prepare(`UPDATE users SET ultimo = ?, ${col} = ?, nombre = COALESCE(nombre, ?) WHERE id = ?`).bind(fecha, d.sub, nombre, user.id).run();
    }
    const k = await claveAdmin(env);
    if (k && typeof b.clave === "string" && b.clave === k && !user.admin) {
      await db.prepare("UPDATE users SET admin = 1, plan = 'pro' WHERE id = ?").bind(user.id).run();
      await adoptarDatosAntiguos(env, user.id);
      user.admin = 1;
    }
    return json({ ok: true, token: await abrirSesion(env, user.id), email: user.email, admin: !!user.admin, nuevo });
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
    b.yaExistia = !!user;
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
    return json({ ok: true, token: await abrirSesion(env, user.id), email, admin: !!user.admin, nuevo: !b.yaExistia });
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
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;padding:0 16px;color:#1d2433;background:#f5f7fb"><h1 style="font-size:24px">Radar de Plazas</h1><p>${msg}</p><p><a href="${sitio(env)}" style="color:#2f6feb">Volver a Radar de Plazas</a></p></body>`,
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
        correo: correoActivo(env), ia: !!env.AI, telegram: !!env.TELEGRAM_BOT_TOKEN,
        mensajes,
      });
    }
    if (path === "/admin/leidos" && req.method === "POST") { await db.prepare("UPDATE mensajes SET leido = 1 WHERE leido = 0").run(); return json({ ok: true }); }
    if (path === "/admin/telegram" && req.method === "POST") {
      if (!env.TELEGRAM_BOT_TOKEN) return json({ error: "Falta el secreto TELEGRAM_BOT_TOKEN" }, 400);
      return json(await configurarWebhook(env));
    }
    return json({ error: "No encontrado" }, 404);
  }
  const yo = me!;

  if (path === "/auth/logout" && req.method === "POST") { await db.prepare("DELETE FROM sesiones WHERE th = ?").bind(yo.th).run(); return json({ ok: true }); }
  if (path === "/cuenta" && req.method === "GET") {
    const n = await db.prepare("SELECT COUNT(*) AS n FROM alertas WHERE uid = ?").bind(yo.id).first<{ n: number }>();
    const ex = await db.prepare("SELECT perfil, frecuencia, boletin, telegram, cal_token, nombre, ajustes, google_sub, apple_sub FROM users WHERE id = ?").bind(yo.id).first<{ perfil: string | null; frecuencia: string | null; boletin: number | null; telegram: string | null; cal_token: string | null; nombre: string | null; ajustes: string | null; google_sub: string | null; apple_sub: string | null }>();
    return json({
      email: yo.email, admin: !!yo.admin, plan: yo.plan, avisos_email: !!yo.avisos_email, alertas: n?.n ?? 0, limite_alertas: limiteAlertas(env, yo), correo: correoActivo(env),
      perfil: ex?.perfil ? JSON.parse(ex.perfil) : null, frecuencia: ex?.frecuencia || "diaria", boletin: !!ex?.boletin,
      telegram: !!ex?.telegram, telegram_url: env.TELEGRAM_BOT_TOKEN ? await enlaceTelegram(env, yo.id) : null,
      calendario: ex?.cal_token ? `${sitio(env)}/api/cal/${yo.id}/${ex.cal_token}.ics` : null, ia: !!env.AI,
      nombre: ex?.nombre || null, ajustes: ex?.ajustes ? JSON.parse(ex.ajustes) : null, google: !!ex?.google_sub, apple: !!ex?.apple_sub,
    });
  }
  if (path === "/cuenta" && req.method === "PATCH") {
    const b = await cuerpo();
    if (typeof b.avisos_email === "boolean") await db.prepare("UPDATE users SET avisos_email = ? WHERE id = ?").bind(b.avisos_email ? 1 : 0, yo.id).run();
    if (b.frecuencia === "diaria" || b.frecuencia === "semanal") await db.prepare("UPDATE users SET frecuencia = ? WHERE id = ?").bind(b.frecuencia, yo.id).run();
    if (typeof b.boletin === "boolean") await db.prepare("UPDATE users SET boletin = ? WHERE id = ?").bind(b.boletin ? 1 : 0, yo.id).run();
    if (b.perfil && typeof b.perfil === "object") {
      const txt = JSON.stringify(b.perfil);
      if (txt.length > 4000) return json({ error: "El perfil es demasiado largo." }, 400);
      await db.prepare("UPDATE users SET perfil = ? WHERE id = ?").bind(txt, yo.id).run();
    }
    if (b.telegram === false) await db.prepare("UPDATE users SET telegram = NULL WHERE id = ?").bind(yo.id).run();
    if (typeof b.nombre === "string") await db.prepare("UPDATE users SET nombre = ? WHERE id = ?").bind(b.nombre.replace(/[<>]/g, "").trim().slice(0, 40) || null, yo.id).run();
    if (b.ajustes && typeof b.ajustes === "object") {
      const txt = JSON.stringify(b.ajustes);
      if (txt.length > 12000) return json({ error: "Los ajustes son demasiado largos." }, 400);
      // Gana la versión más reciente (cada dispositivo manda la hora a la que cambió algo)
      const prev = await db.prepare("SELECT ajustes FROM users WHERE id = ?").bind(yo.id).first<{ ajustes: string | null }>();
      const tPrev = prev?.ajustes ? Number(JSON.parse(prev.ajustes).t || 0) : 0;
      if (Number(b.ajustes.t || 0) >= tPrev) await db.prepare("UPDATE users SET ajustes = ? WHERE id = ?").bind(txt, yo.id).run();
      else return json({ ok: true, ajustes: JSON.parse(prev!.ajustes!) });
    }
    return json({ ok: true });
  }
  if (path === "/cuenta/calendario" && req.method === "POST") {
    const t = rnd(16);
    await db.prepare("UPDATE users SET cal_token = ? WHERE id = ?").bind(t, yo.id).run();
    return json({ url: `${sitio(env)}/api/cal/${yo.id}/${t}.ics` });
  }
  if (path === "/cuenta/admin" && req.method === "POST") {
    const b = await cuerpo(), k = await claveAdmin(env);
    if (!k || b.clave !== k) return json({ error: "La clave no es correcta." }, 403);
    await db.prepare("UPDATE users SET admin = 1, plan = 'pro' WHERE id = ?").bind(yo.id).run();
    await adoptarDatosAntiguos(env, yo.id);
    return json({ ok: true });
  }
  if (path === "/cuenta/datos" && req.method === "GET") {
    const user = await db.prepare("SELECT email, nombre, creado, ultimo, plan, avisos_email, acepta, perfil, ajustes, frecuencia, boletin FROM users WHERE id = ?").bind(yo.id).first();
    const alertas = (await db.prepare("SELECT nombre, filtros, activa, creada FROM alertas WHERE uid = ?").bind(yo.id).all<{ filtros: string }>()).results.map((a) => ({ ...a, filtros: JSON.parse(a.filtros) }));
    const marcas = (await db.prepare("SELECT m.oferta_id, m.marca, m.ts, m.notas, m.docs, o.titulo FROM marcas m LEFT JOIN ofertas o ON o.id = m.oferta_id WHERE m.uid = ?").bind(yo.id).all()).results;
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

// ---------- sesiones y entrada con Google / Apple ----------
async function abrirSesion(env: Env, uid: string): Promise<string> {
  const db = env.DB, ahora = Date.now(), token = rnd(32);
  await db.prepare("DELETE FROM sesiones WHERE uid = ? AND th NOT IN (SELECT th FROM sesiones WHERE uid = ? ORDER BY ultima DESC LIMIT ?)").bind(uid, uid, MAX_SESIONES - 1).run();
  await db.prepare("INSERT INTO sesiones (th, uid, creada, ultima) VALUES (?, ?, ?, ?)").bind(await sha256("ses:" + token), uid, ahora, ahora).run();
  return token;
}
const lista = (s?: string) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
const JWKS_URL = { google: "https://www.googleapis.com/oauth2/v3/certs", apple: "https://appleid.apple.com/auth/keys" } as const;
const JWKS: Record<string, { t: number; keys: Array<{ kid: string; kty: string; n: string; e: string }> }> = {};
const b64u = (s: string) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); s += "=".repeat((4 - (s.length % 4)) % 4); return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
async function clavesJwks(prov: "google" | "apple", fresca = false) {
  const c = JWKS[prov];
  if (!fresca && c && Date.now() - c.t < 6 * 3600_000) return c.keys;
  const r = await fetch(JWKS_URL[prov], { headers: { Accept: "application/json" } });
  const d = (await r.json()) as { keys?: Array<{ kid: string; kty: string; n: string; e: string }> };
  JWKS[prov] = { t: Date.now(), keys: d.keys || [] };
  return JWKS[prov].keys;
}
export async function verificarIdToken(env: Env, prov: "google" | "apple", token: string): Promise<{ sub: string; email: string; nombre: string }> {
  const partes = token.split(".");
  if (partes.length !== 3) throw new Error("formato");
  const dec = (x: string) => JSON.parse(new TextDecoder().decode(b64u(x)));
  const cab = dec(partes[0]), pl = dec(partes[1]);
  if (cab.alg !== "RS256") throw new Error("alg");
  let k = (await clavesJwks(prov)).find((x) => x.kid === cab.kid);
  if (!k) k = (await clavesJwks(prov, true)).find((x) => x.kid === cab.kid);
  if (!k) throw new Error("kid");
  const key = await crypto.subtle.importKey("jwk", { kty: k.kty, n: k.n, e: k.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(partes[2]), new TextEncoder().encode(partes[0] + "." + partes[1])))) throw new Error("firma");
  if (!(pl.exp > Date.now() / 1000 - 60)) throw new Error("caducado");
  const iss = prov === "google" ? ["https://accounts.google.com", "accounts.google.com"] : ["https://appleid.apple.com"];
  if (!iss.includes(pl.iss)) throw new Error("iss");
  const auds = lista(prov === "google" ? env.GOOGLE_CLIENT_IDS : env.APPLE_CLIENT_IDS), aud = Array.isArray(pl.aud) ? pl.aud : [pl.aud];
  if (!aud.some((a: string) => auds.includes(a))) throw new Error("aud");
  if (pl.email_verified === false || pl.email_verified === "false") throw new Error("correo sin verificar");
  return { sub: String(pl.sub || ""), email: pl.email ? normEmail(pl.email) : "", nombre: String(pl.given_name || pl.name || "").trim() };
}
