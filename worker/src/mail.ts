// Correos con Resend: códigos de acceso, avisos de alertas y mensajes de contacto.
import type { Env } from "./types";

export const sitio = (env: Env) => (env.SITE_URL || "https://radaropos.com").replace(/\/$/, "");
export const contacto = (env: Env) => env.CONTACT_TO || "hola@radaropos.com";
export const correoActivo = (env: Env) => !!env.RESEND_API_KEY;

// Si la clave de Resend no llegó como secreto de Cloudflare, se lee de la tabla meta (privada).
let CLAVE_RESEND: string | null | undefined;
export async function cargarClaves(env: Env): Promise<void> {
  if (env.RESEND_API_KEY) return;
  if (CLAVE_RESEND === undefined) {
    const r = await env.DB.prepare("SELECT v FROM meta WHERE k = 'resend_api_key'").first<{ v: string }>().catch(() => null);
    CLAVE_RESEND = r?.v?.trim() || null;
  }
  if (CLAVE_RESEND) env.RESEND_API_KEY = CLAVE_RESEND;
}

export const escHtml = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface Correo { to: string; subject: string; html: string; text: string; replyTo?: string; headers?: Record<string, string> }

export async function enviarCorreo(env: Env, c: Correo): Promise<void> {
  if (!env.RESEND_API_KEY) throw new Error("correo_no_configurado");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + env.RESEND_API_KEY.trim(), "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.MAIL_FROM || "Radar de Plazas <avisos@radaropos.com>",
      to: [c.to],
      reply_to: c.replyTo || contacto(env),
      subject: c.subject,
      html: c.html,
      text: c.text,
      headers: c.headers,
    }),
  });
  if (!r.ok) throw new Error(`resend_${r.status}: ${(await r.text().catch(() => "")).slice(0, 200)}`);
}

/** Envoltorio común de los correos: cabecera, contenido y pie con el titular. */
export function plantilla(env: Env, cuerpo: string, pie = ""): string {
  const web = sitio(env);
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1d2433;background:#ffffff">
<p style="font-size:20px;font-weight:bold;margin:0 0 16px">Radar de <span style="color:#2f6feb">Plazas</span> <span style="color:#2f6feb;font-weight:normal">/</span> Oposiciones</p>
${cuerpo}
<p style="font-size:12px;color:#657084;margin:24px 0 0;border-top:1px solid #e2e7ef;padding-top:12px">${pie}${pie ? "<br>" : ""}Radar de Plazas · <a href="${web}" style="color:#2f6feb">${web.replace(/^https?:\/\//, "")}</a> · ${escHtml(contacto(env))}</p></div>`;
}
