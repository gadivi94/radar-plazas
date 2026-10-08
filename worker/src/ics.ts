// Calendario: fin de plazo de una plaza (.ics) y calendario suscrito con las plazas que sigue cada usuario.
import { corto, enlacePlaza } from "./avisos";
import type { Env, Oferta } from "./types";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const dia = (iso: string) => iso.replace(/-/g, "");
const sig = (iso: string) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10).replace(/-/g, ""); };
// Las líneas de un .ics no deben pasar de 75 octetos
const plegar = (l: string) => { const out: string[] = []; let s = l; while (s.length > 70) { out.push(s.slice(0, 70)); s = " " + s.slice(70); } out.push(s); return out.join("\r\n"); };

function evento(env: Env, o: Oferta, marca?: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const etiqueta = marca === "presentada" ? "Presentada" : marca === "examen" ? "Examen" : "Cierra plazo";
  return [
    "BEGIN:VEVENT",
    `UID:${o.id.replace(/[^a-zA-Z0-9-]/g, "-")}@radaropos.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dia(o.plazo_fin!)}`,
    `DTEND;VALUE=DATE:${sig(o.plazo_fin!)}`,
    `SUMMARY:${esc(`${etiqueta}: ${corto(o.titulo)}`)}`,
    `DESCRIPTION:${esc(`${o.organismo || ""}\nÚltimo día para presentar la solicitud. Comprueba el plazo en la convocatoria oficial.\n${enlacePlaza(env, o)}`)}`,
    `URL:${enlacePlaza(env, o)}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-P3D", `DESCRIPTION:${esc("Quedan 3 días: " + corto(o.titulo))}`, "END:VALARM",
    "END:VEVENT",
  ].map(plegar).join("\r\n");
}

export function calendario(env: Env, nombre: string, plazas: Array<Oferta & { marca?: string }>): Response {
  const cuerpo = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Radar de Plazas//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(nombre)}`, "X-WR-TIMEZONE:Europe/Madrid", "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    ...plazas.filter((o) => o.plazo_fin).map((o) => evento(env, o, o.marca)), "END:VCALENDAR"].join("\r\n");
  return new Response(cuerpo, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `inline; filename="radar-plazas.ics"`, "Access-Control-Allow-Origin": "*" } });
}
