// Mensajes que salen del Radar: correos (alertas, recordatorios, cambios, resumen y boletín semanal) y Telegram.
import { fmt } from "./classify";
import { tokenBaja } from "./cuentas";
import { norm } from "./geo";
import { escHtml, plantilla, sitio, type Correo } from "./mail";
import { SECTOR_NOMBRE } from "./sectores";
import type { Env, Oferta } from "./types";

export function corto(t: string): string {
  const s = t.replace(/^Resoluci[oó]n de \d+ de \w+ de \d{4}, /i, "").replace(/, referente a la convocatoria para proveer/i, ":");
  return s.length > 90 ? s.slice(0, 87) + "…" : s;
}

export function slug(t: string): string {
  return norm(corto(t)).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").split("-").slice(0, 10).join("-") || "plaza";
}
/** /plaza/cido/22173139/agent-civic-badalona */
export function rutaPlaza(o: Pick<Oferta, "id" | "titulo">): string {
  const [f, ...code] = o.id.split(":");
  return `/plaza/${f}/${encodeURIComponent(code.join(":"))}/${slug(o.titulo)}`;
}
export const enlacePlaza = (env: Env, o: Pick<Oferta, "id" | "titulo">) => sitio(env) + rutaPlaza(o);

const lugarDe = (o: Oferta) => o.municipio || o.provincia || o.comunidad || "";
const plazoDe = (o: Oferta) => (o.plazo_fin ? `hasta el ${fmt(o.plazo_fin)}` : o.plazo_texto || "plazo aún sin fijar");

function fila(env: Env, o: Oferta, extra = ""): string {
  return `<li style="margin:0 0 10px"><a href="${escHtml(enlacePlaza(env, o))}" style="color:#14232b;font-weight:bold">${escHtml(corto(o.titulo))}</a><br>
<span style="color:#5b6b72;font-size:13px">${escHtml([o.organismo, lugarDe(o)].filter(Boolean).join(" · "))} · ${escHtml(plazoDe(o))}${extra}</span></li>`;
}
const boton = (env: Env, texto = "Ver en Radar de Plazas", url = sitio(env)) =>
  `<p style="margin:22px 0 0"><a href="${url}" style="display:inline-block;background:#0d6b6b;color:#ffffff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">${texto}</a></p>`;
const aviso = `<p style="font-size:12px;color:#5b6b72;margin:16px 0 0">Comprueba siempre los requisitos y el plazo en la convocatoria oficial.</p>`;

async function pieBaja(env: Env, uid: string, motivo: string) {
  const baja = `${sitio(env)}/api/baja?u=${uid}&t=${await tokenBaja(env, uid)}`;
  return { baja, pie: `${motivo} <a href="${baja}" style="color:#5b6b72">Dejar de recibir correos</a>` };
}
const cabeceras = (baja: string) => ({ "List-Unsubscribe": `<${baja}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });

export type Seccion = { alerta: string; hits: Oferta[] };

export async function correoAvisos(env: Env, u: { id: string; email: string }, secciones: Seccion[], semanal = false): Promise<Correo> {
  const total = secciones.reduce((a, s) => a + s.hits.length, 0);
  const { baja, pie } = await pieBaja(env, u.id, semanal ? "Recibes este resumen semanal porque tienes alertas activas." : "Recibes este correo porque tienes alertas activas.");
  const html = plantilla(env, `<p style="font-size:15px;margin:0 0 16px">${semanal ? "Esta semana han salido" : "Han salido"} <b>${total} ${total === 1 ? "plaza" : "plazas"}</b> que encajan con tus alertas.</p>
${secciones.map((s) => `<p style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#0d6b6b;margin:18px 0 8px;font-weight:bold">${escHtml(s.alerta)} · ${s.hits.length}</p>
<ul style="padding-left:18px;margin:0">${s.hits.slice(0, 10).map((o) => fila(env, o)).join("")}</ul>${s.hits.length > 10 ? `<p style="font-size:13px;margin:0">y ${s.hits.length - 10} más en la web.</p>` : ""}`).join("")}
${boton(env)}${aviso}`, pie);
  const text = `${semanal ? "Esta semana han salido" : "Han salido"} ${total} plazas que encajan con tus alertas.\n\n` + secciones.map((s) => `${s.alerta}\n` + s.hits.slice(0, 10).map((o) => `- ${corto(o.titulo)} (${lugarDe(o)}, ${plazoDe(o)}) ${enlacePlaza(env, o)}`).join("\n")).join("\n\n") + `\n\nVer todo: ${sitio(env)}\nDejar de recibir correos: ${baja}`;
  return {
    to: u.email, html, text, headers: cabeceras(baja),
    subject: semanal ? `Resumen semanal: ${total} ${total === 1 ? "plaza" : "plazas"} para tus alertas · Radar de Plazas` : `${total} ${total === 1 ? "plaza nueva" : "plazas nuevas"} para tus alertas · Radar de Plazas`,
  };
}

export async function correoRecordatorio(env: Env, u: { id: string; email: string }, plazas: Oferta[]): Promise<Correo> {
  const { baja, pie } = await pieBaja(env, u.id, "Te avisamos porque guardaste estas plazas en «Me interesa».");
  const dias = (o: Oferta) => Math.round((Date.parse(o.plazo_fin + "T00:00:00Z") - Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z")) / 864e5);
  const cuando = (o: Oferta) => { const d = dias(o); return d <= 0 ? " · <b style=\"color:#b4232c\">cierra hoy</b>" : ` · <b style="color:#b4232c">cierra en ${d} ${d === 1 ? "día" : "días"}</b>`; };
  const html = plantilla(env, `<p style="font-size:15px;margin:0 0 16px">⏰ ${plazas.length === 1 ? "Una plaza que te interesa está a punto de cerrar" : `${plazas.length} plazas que te interesan están a punto de cerrar`} y aún no la${plazas.length === 1 ? "" : "s"} has marcado como presentada${plazas.length === 1 ? "" : "s"}.</p>
<ul style="padding-left:18px;margin:0">${plazas.map((o) => fila(env, o, cuando(o))).join("")}</ul>${boton(env, "Revisar mis plazas")}${aviso}`, pie);
  return {
    to: u.email, html, headers: cabeceras(baja),
    subject: plazas.length === 1 ? `⏰ Cierra pronto: ${corto(plazas[0].titulo).slice(0, 60)}` : `⏰ ${plazas.length} plazas que te interesan cierran pronto`,
    text: `Estas plazas que te interesan cierran pronto:\n` + plazas.map((o) => `- ${corto(o.titulo)} (${plazoDe(o)}) ${enlacePlaza(env, o)}`).join("\n") + `\n\nDejar de recibir correos: ${baja}`,
  };
}

export async function correoCambios(env: Env, u: { id: string; email: string }, cambios: Array<{ o: Oferta; texto: string }>): Promise<Correo> {
  const { baja, pie } = await pieBaja(env, u.id, "Te avisamos porque sigues estas plazas.");
  const html = plantilla(env, `<p style="font-size:15px;margin:0 0 16px">Hay novedades en ${cambios.length === 1 ? "una plaza que sigues" : `${cambios.length} plazas que sigues`}:</p>
<ul style="padding-left:18px;margin:0">${cambios.map((c) => fila(env, c.o, ` · <b>${escHtml(c.texto)}</b>`)).join("")}</ul>${boton(env)}${aviso}`, pie);
  return {
    to: u.email, html, headers: cabeceras(baja),
    subject: `Novedades en ${cambios.length === 1 ? "una plaza que sigues" : `${cambios.length} plazas que sigues`} · Radar de Plazas`,
    text: cambios.map((c) => `- ${corto(c.o.titulo)}: ${c.texto} ${enlacePlaza(env, c.o)}`).join("\n") + `\n\nDejar de recibir correos: ${baja}`,
  };
}

export async function correoBoletin(env: Env, u: { id: string; email: string }, plazas: Oferta[]): Promise<Correo> {
  const { baja, pie } = await pieBaja(env, u.id, "Recibes el boletín semanal porque te suscribiste en Mi cuenta.");
  const porSector = new Map<string, Oferta[]>();
  for (const o of plazas) porSector.set(o.tipo || "otros", [...(porSector.get(o.tipo || "otros") || []), o]);
  const bloques = [...porSector].sort((a, b) => b[1].length - a[1].length).slice(0, 8);
  const html = plantilla(env, `<p style="font-size:15px;margin:0 0 16px">Las plazas destacadas de la semana: <b>${plazas.length}</b> nuevas con plazo abierto.</p>
${bloques.map(([s, l]) => `<p style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#0d6b6b;margin:18px 0 8px;font-weight:bold">${escHtml(SECTOR_NOMBRE[s] || s)} · ${l.length}</p>
<ul style="padding-left:18px;margin:0">${l.slice(0, 4).map((o) => fila(env, o)).join("")}</ul>`).join("")}${boton(env, "Ver todas las plazas")}${aviso}`, pie);
  return {
    to: u.email, html, headers: cabeceras(baja), subject: `Boletín semanal: ${plazas.length} plazas nuevas · Radar de Plazas`,
    text: bloques.map(([s, l]) => `${SECTOR_NOMBRE[s] || s}\n` + l.slice(0, 4).map((o) => `- ${corto(o.titulo)} (${lugarDe(o)}) ${enlacePlaza(env, o)}`).join("\n")).join("\n\n") + `\n\nDejar de recibir correos: ${baja}`,
  };
}

// ---------- Telegram (opcional: TELEGRAM_BOT_TOKEN) ----------
export const telegramActivo = (env: Env) => !!env.TELEGRAM_BOT_TOKEN;
export async function enviarTelegram(env: Env, chat: string, texto: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: texto.slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!r.ok) throw new Error(`telegram_${r.status}`);
}
export function textoTelegram(env: Env, titulo: string, plazas: Oferta[]): string {
  return `<b>${escHtml(titulo)}</b>\n\n` + plazas.slice(0, 8).map((o) => `• <a href="${escHtml(enlacePlaza(env, o))}">${escHtml(corto(o.titulo))}</a>\n   ${escHtml(lugarDe(o))} · ${escHtml(plazoDe(o))}`).join("\n") + (plazas.length > 8 ? `\n\n+${plazas.length - 8} más en ${sitio(env)}` : "");
}
