// Avisos push con el servicio de Expo (gestiona APNs con las credenciales que subes a EAS).
import type { Env } from "./types";

export interface PushMsg { title: string; body: string; data?: Record<string, unknown> }

export async function enviarPush(env: Env, msg: PushMsg): Promise<{ enviados: number; errores: string[] }> {
  const tokens = (await env.DB.prepare("SELECT token FROM devices").all<{ token: string }>()).results.map((r) => r.token);
  if (!tokens.length) return { enviados: 0, errores: ["sin dispositivos"] };
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
  const r = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers,
    body: JSON.stringify(tokens.map((to) => ({ to, sound: "default", ...msg }))),
  });
  const errores: string[] = [];
  if (!r.ok) return { enviados: 0, errores: [`Expo ${r.status}`] };
  const res = (await r.json()) as { data?: Array<{ status: string; message?: string; details?: { error?: string } }> };
  for (const [i, t] of (res.data || []).entries()) {
    if (t.status === "error") {
      errores.push(t.message || "error");
      if (t.details?.error === "DeviceNotRegistered") await env.DB.prepare("DELETE FROM devices WHERE token = ?").bind(tokens[i]).run();
    }
  }
  return { enviados: tokens.length - errores.length, errores };
}
