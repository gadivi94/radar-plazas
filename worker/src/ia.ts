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
