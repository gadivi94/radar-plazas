// Bot de Telegram: el usuario abre t.me/<bot>?start=<código> desde Mi cuenta y queda vinculado.
import { sha256 } from "./cuentas";
import { sitio } from "./mail";
import { enviarTelegram } from "./avisos";
import type { Env } from "./types";

const secreto = async (env: Env) => (await sha256("tg:" + (env.TELEGRAM_BOT_TOKEN || ""))).slice(0, 32);
export const codigoTelegram = async (env: Env, uid: string) => `${uid}_${(await sha256(`tgcode:${uid}:${env.TELEGRAM_BOT_TOKEN}`)).slice(0, 12)}`;
export const enlaceTelegram = async (env: Env, uid: string) => (env.TELEGRAM_BOT ? `https://t.me/${env.TELEGRAM_BOT}?start=${await codigoTelegram(env, uid)}` : null);

export async function telegramWebhook(req: Request, env: Env): Promise<Response> {
  if (!env.TELEGRAM_BOT_TOKEN || req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== (await secreto(env))) return new Response("no", { status: 403 });
  const u = (await req.json().catch(() => ({}))) as { message?: { chat?: { id: number }; text?: string } };
  const chat = u.message?.chat?.id, text = (u.message?.text || "").trim();
  if (!chat) return new Response("ok");
  const responder = (t: string) => enviarTelegram(env, String(chat), t).catch(() => undefined);
  const m = text.match(/^\/start\s+([a-f0-9]+)_([a-f0-9]{12})$/);
  if (m) {
    const uid = m[1];
    if ((await codigoTelegram(env, uid)) === `${m[1]}_${m[2]}`) {
      await env.DB.prepare("UPDATE users SET telegram = ? WHERE id = ?").bind(String(chat), uid).run();
      await responder("✅ Listo. Te avisaré aquí de las plazas nuevas de tus alertas, de los cambios en las que sigues y de los plazos que están a punto de cerrar.\n\nEscribe /stop para dejar de recibir avisos.");
    } else await responder("Ese enlace no es válido. Vuelve a abrirlo desde Mi cuenta en " + sitio(env));
  } else if (/^\/stop/.test(text)) {
    await env.DB.prepare("UPDATE users SET telegram = NULL WHERE telegram = ?").bind(String(chat)).run();
    await responder("Hecho: ya no recibirás avisos por aquí. Puedes volver a conectarlo desde Mi cuenta.");
  } else {
    await responder(`Soy el bot de Radar de Plazas. Para recibir avisos, entra en ${sitio(env)}, abre Mi cuenta y pulsa «Conectar Telegram».`);
  }
  return new Response("ok");
}

/** Registra la dirección del webhook en Telegram (lo lanza el administrador desde Mi cuenta). */
export async function configurarWebhook(env: Env): Promise<unknown> {
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `${sitio(env)}/api/telegram/webhook`, secret_token: await secreto(env), allowed_updates: ["message"] }),
  });
  return r.json();
}
