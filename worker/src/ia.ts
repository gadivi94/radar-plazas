// IA con Workers AI: resumen de las bases en pocas líneas y preguntas sobre una convocatoria concreta.
import { toText } from "./text";
import type { Env, Oferta } from "./types";

export const iaActiva = (env: Env) => !!env.AI;
const MODELO = (env: Env) => env.IA_MODELO || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const UA = { "User-Agent": "RadarPlazas/1.0 (+https://radaropos.com)" };

/** Texto de la convocatoria (anuncio del BOE o ficha del CIDO), recortado para el modelo. */
export async function textoConvocatoria(o: Oferta): Promise<string> {
  const datos = [
    `Título: ${o.titulo}`, o.organismo && `Organismo: ${o.organismo}`, o.municipio && `Lugar: ${o.municipio}`,
    o.grupo && `Grupo: ${o.grupo}`, o.sistema && `Sistema: ${o.sistema}`, o.plazo_fin && `Fin de plazo: ${o.plazo_fin}`,
    o.plazo_texto && `Plazo: ${o.plazo_texto}`, o.resumen && `Resumen: ${o.resumen}`, o.requisitos && `Requisitos detectados: ${o.requisitos}`,
  ].filter(Boolean).join("\n");
  let cuerpo = "";
  if (o.detalle_url) {
    try {
      const r = await fetch(o.detalle_url, { headers: UA });
      if (r.ok) {
        const raw = await r.text();
        const t = toText(o.fuente === "BOE" ? (raw.match(/<texto[^>]*>([\s\S]*?)<\/texto>/i)?.[1] ?? raw) : raw);
        const i = t.indexOf(o.titulo.slice(0, 40));
        cuerpo = (i >= 0 ? t.slice(i) : t).slice(0, 9000);
      }
    } catch (_) { /* nos quedamos con los datos guardados */ }
  }
  return `${datos}\n\n${cuerpo}`.trim();
}

async function preguntar(env: Env, sistema: string, usuario: string, max = 500): Promise<string> {
  const r = (await env.AI!.run(MODELO(env), {
    messages: [{ role: "system", content: sistema }, { role: "user", content: usuario }],
    max_tokens: max, temperature: 0.2,
  })) as { response?: string };
  return (r.response || "").trim();
}

const REGLAS = `Eres el asistente de Radar de Plazas, una web que reúne convocatorias de empleo público en España.
Responde siempre en español, claro y breve, usando SOLO la información de la convocatoria que se te da.
Si un dato no aparece, di que no consta y recomienda consultar las bases oficiales. No inventes fechas, requisitos ni cifras.`;

export async function resumenIA(env: Env, o: Oferta): Promise<string> {
  const texto = await textoConvocatoria(o);
  return preguntar(env, REGLAS, `Resume esta convocatoria en un máximo de 5 viñetas cortas que empiecen por «• »: qué puesto es y cuántas plazas, requisitos principales (titulación, edad, carné, idioma), cómo es la selección (pruebas), plazo y cómo presentar la solicitud.\n\n---\n${texto}`, 450);
}

export async function preguntaIA(env: Env, o: Oferta, pregunta: string): Promise<string> {
  const texto = await textoConvocatoria(o);
  return preguntar(env, REGLAS + "\nSi te piden un plan de estudio, propón uno semanal y realista basado en el tipo de pruebas y el plazo, avisando de que es orientativo.",
    `Convocatoria:\n${texto}\n\n---\nPregunta de la persona usuaria: ${pregunta.slice(0, 500)}`, 600);
}

// ---------- Tutor de orientación ----------
export interface Prefs { intereses?: string[]; estilo?: string[]; prisa?: string; horas?: string; movilidad?: string; cp?: string; lugar?: string; lat?: number; lon?: number }
export interface Perfil { nivel?: number; edad?: number; carne?: string[]; catalan?: string; idiomas?: Record<string, string>; intereses?: string[]; nacionalidad?: string; prefs?: Prefs }
export interface MensajeTutor { rol: "user" | "assistant"; texto: string }

const NIVEL_TXT = ["sin titulación", "ESO", "bachillerato o FP de grado medio", "FP de grado superior", "grado universitario"];
const PRISA: Record<string, string> = { ya: "quiere trabajar cuanto antes (bolsas, interinidades, concursos de méritos)", estabilidad: "quiere una plaza fija aunque tenga que preparar una oposición", ambas: "quiere trabajar pronto y, a la vez, preparar una plaza fija" };
const HORAS: Record<string, string> = { "0": "no puede dedicar tiempo a estudiar", "5": "puede estudiar menos de 5 horas a la semana", "15": "puede estudiar entre 5 y 15 horas a la semana", "30": "puede estudiar más de 15 horas a la semana" };

export function contextoTutor(perfil: Perfil, ofertas: Array<Oferta & { ruta: string; dist?: number | null }>, nombresSector: Record<string, string>, nombresSub: Record<string, { nombre: string }>): string {
  const p = perfil.prefs || {};
  const yo = [
    perfil.nivel != null ? `Estudios: ${NIVEL_TXT[perfil.nivel]}` : "Estudios: no los ha indicado",
    perfil.edad ? `Edad: ${perfil.edad}` : null,
    perfil.carne?.length ? `Carnés: ${perfil.carne.join(", ")}` : null,
    perfil.idiomas && Object.keys(perfil.idiomas).length ? `Idiomas: ${Object.entries(perfil.idiomas).map(([k, v]) => `${k} ${v}`).join(", ")}` : perfil.catalan ? `Catalán: ${perfil.catalan}` : null,
    perfil.nacionalidad && perfil.nacionalidad !== "es" ? `Nacionalidad: ${perfil.nacionalidad === "ue" ? "otro país de la UE" : "fuera de la UE"}` : null,
    (perfil.intereses || p.intereses)?.length ? `Le atraen: ${(perfil.intereses || p.intereses)!.map((k) => nombresSector[k] || k).join(", ")}` : null,
    p.estilo?.length ? `Le gusta trabajar: ${p.estilo.join(", ")}` : null,
    p.prisa ? `Objetivo: ${PRISA[p.prisa] || p.prisa}` : null,
    p.horas ? `Tiempo: ${HORAS[p.horas] || p.horas}` : null,
    p.movilidad ? `Movilidad: ${p.movilidad === "toda" ? "toda España" : p.movilidad === "comunidad" ? "su comunidad" : `hasta ${p.movilidad} km`}${p.lugar || p.cp ? ` desde ${p.lugar || ""} ${p.cp ? "(CP " + p.cp + ")" : ""}` : ""}` : null,
  ].filter(Boolean).join("\n");
  const porSub = new Map<string, number>();
  for (const o of ofertas) { const k = o.subtipo ? nombresSub[o.subtipo]?.nombre || o.subtipo : nombresSector[o.tipo || "otros"]; porSub.set(k, (porSub.get(k) || 0) + 1); }
  const resumen = [...porSub].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${k}: ${n}`).join(" · ");
  const lineas = ofertas.slice(0, 18).map((o) => `- [${o.titulo.slice(0, 110)}](${o.ruta}) · ${o.organismo || ""} · ${o.municipio || o.provincia || o.comunidad || ""}${o.dist != null ? ` (a ${Math.round(o.dist)} km)` : ""} · ${o.grupo ? "grupo " + o.grupo + " · " : ""}${["", "fácil", "media", "difícil"][o.dificultad || 2]}${Number(o.interino) ? " · interino/bolsa" : ""}${o.plazo_fin ? " · hasta " + o.plazo_fin.split("-").reverse().join("/") : ""}`).join("\n");
  return `PERFIL DE LA PERSONA\n${yo}\n\nPLAZAS ABIERTAS QUE ENCAJAN CON SU PERFIL (${ofertas.length} en total por subcategoría): ${resumen || "ninguna"}\n\nLAS MÁS ADECUADAS AHORA (usa solo estos enlaces):\n${lineas || "(ninguna)"}`;
}

const REGLAS_TUTOR = `Eres el tutor de orientación de Radar de Plazas, una web que reúne plazas de empleo público en España (oposiciones, bolsas, interinos y empresas públicas).
Tu trabajo: ayudar a la persona a decidir hacia dónde encaminarse según su perfil, sus gustos, su prisa por trabajar y el tiempo que puede estudiar.
Cómo respondes:
- En el idioma de la persona (castellano o catalán), cercano y directo, como un buen orientador. Máximo unas 220 palabras.
- Propón 2 o 3 caminos concretos (por ejemplo: «ahora», «en 6-12 meses», «a largo plazo») explicando por qué encajan con ella.
- Cuando cites plazas, usa SOLO las de la lista con su enlace exacto en formato [título](enlace). No inventes plazas, fechas, sueldos ni requisitos.
- Da 2 o 3 próximos pasos prácticos (apuntarse a una bolsa, crear una alerta, sacar un certificado, empezar el temario…).
- Si falta un dato importante (estudios, dónde vive, qué le gusta), pregúntalo al final en una sola frase.
- Lo general sobre oposiciones (grupos, tipos de pruebas, qué es una bolsa) puedes explicarlo; lo específico de una convocatoria, remite a sus bases oficiales.
- Si encaja con policía o Mossos en Cataluña, puedes mencionar que en OPOS 365 hay temario y tests; no lo menciones en otros casos.`;

export async function tutorIA(env: Env, contexto: string, mensajes: MensajeTutor[]): Promise<string> {
  const historia = mensajes.slice(-8).map((m) => ({ role: m.rol === "assistant" ? "assistant" : "user", content: String(m.texto || "").slice(0, 1200) }));
  if (!historia.length || historia[historia.length - 1].role !== "user") historia.push({ role: "user", content: "¿Por dónde empiezo?" });
  const r = (await env.AI!.run(MODELO(env), {
    messages: [{ role: "system", content: `${REGLAS_TUTOR}\n\n${contexto}` }, ...historia],
    max_tokens: 700, temperature: 0.4,
  })) as { response?: string };
  return (r.response || "").trim();
}
