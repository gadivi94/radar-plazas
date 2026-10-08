// BOE · Sección II.B "Oposiciones y concursos" (API de datos abiertos del sumario).
import { comunidadPorTexto, norm, provinciaDe } from "../geo";
import { dificultadDe, grupoDe, interinoDe, plazasDe, plazoDesde, sistemaDe, tipoDe } from "../classify";
import { toText } from "../text";
import type { Oferta } from "../types";

const UA = { "User-Agent": "RadarPlazas/1.0 (uso personal)" };

export async function fetchSumario(fechaYYYYMMDD: string): Promise<unknown | null> {
  const r = await fetch(`https://www.boe.es/datosabiertos/api/boe/sumario/${fechaYYYYMMDD}`, {
    headers: { Accept: "application/json", ...UA },
  });
  if (r.status === 404) return null; // domingos y festivos no hay BOE
  if (!r.ok) throw new Error(`BOE sumario ${r.status}`);
  return r.json();
}

interface BoeItem { identificador: string; titulo: string; departamento: string; url_html?: string; url_xml?: string; url_pdf?: string }

const arr = <T>(x: T | T[] | undefined | null): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);
const txt = (x: unknown): string => (typeof x === "string" ? x : x && typeof x === "object" && "texto" in (x as object) ? String((x as { texto: unknown }).texto) : "");

/** Recorre la sección 2B tolerando objetos sueltos o arrays en cualquier nivel. */
export function itemsSeccion2B(json: unknown): BoeItem[] {
  const out: BoeItem[] = [];
  const data = (json as { data?: { sumario?: { diario?: unknown } } })?.data?.sumario;
  for (const diario of arr((data as { diario?: unknown })?.diario as object[])) {
    for (const sec of arr((diario as { seccion?: unknown }).seccion as object[])) {
      const s = sec as { codigo?: string; nombre?: string };
      if (s.codigo !== "2B" && !/oposiciones y concursos/i.test(s.nombre || "")) continue;
      walk(sec, "");
    }
  }
  function walk(node: unknown, depto: string) {
    if (Array.isArray(node)) { node.forEach((n) => walk(n, depto)); return; }
    if (!node || typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    if (typeof o.identificador === "string" && typeof o.titulo === "string" && /^BOE-A-/.test(o.identificador)) {
      out.push({ identificador: o.identificador, titulo: o.titulo, departamento: depto, url_html: txt(o.url_html), url_xml: txt(o.url_xml), url_pdf: txt(o.url_pdf) });
      return;
    }
    let d = depto;
    if (Array.isArray(o.departamento) || (o.departamento && typeof o.departamento === "object")) {
      for (const dep of arr(o.departamento as object[])) walk(dep, String((dep as { nombre?: string }).nombre || depto));
      return;
    }
    if (typeof o.nombre === "string" && ("epigrafe" in o || "item" in o) && depto === "") d = o.nombre;
    for (const k of ["epigrafe", "item"]) if (k in o) walk(o[k], d);
  }
  return out;
}

const RE_LOCAL = /\b(?:del?|de la)\s+(Ayuntamiento|Diputaci[oó]n Provincial|Diputaci[oó]n Foral|Diputaci[oó]n|Cabildo Insular|Consell Insular|Consejo Insular|Consell Comarcal|Comarca|Mancomunidad|Consorcio|Organismo Aut[oó]nomo|Patronato|Instituto Municipal|Junta Vecinal|Entidad Local Menor|Ajuntament|Concello|Udala)\s+(?:de\s+|d'|del\s+|de la\s+|de los\s+|de las\s+)?([^,(]+?)\s*(?:\(([^)]+)\))?\s*,/i;

export function parseTituloLocal(titulo: string): { organismo: string; municipio: string; provincia: string | null; comunidad: string | null } | null {
  const m = titulo.match(RE_LOCAL);
  if (!m) return null;
  const tipoEnt = m[1];
  const nombre = m[2].trim();
  const paren = m[3]?.trim();
  const p = provinciaDe(paren) || provinciaDe(nombre);
  return {
    organismo: `${tipoEnt} de ${nombre}`,
    municipio: /ayuntamiento|ajuntament|concello|udala/i.test(tipoEnt) ? nombre : (paren || nombre),
    provincia: p?.provincia ?? (paren || null),
    comunidad: p?.comunidad ?? null,
  };
}

export function ofertaDesdeBoe(it: BoeItem, publicado: string, ahora: string): Oferta {
  const depto = it.departamento || "";
  const nd = norm(depto);
  let organismo: string | null = depto || null;
  let municipio: string | null = null, provincia: string | null = null, comunidad: string | null = null;
  if (/administracion local/.test(nd)) {
    const loc = parseTituloLocal(it.titulo);
    if (loc) ({ organismo, municipio, provincia, comunidad } = loc);
  } else if (/comunidad autonoma|comunitat|generalitat|xunta|junta de|gobierno de|principado/.test(nd)) {
    comunidad = comunidadPorTexto(depto);
  } else if (/universidad/.test(nd)) {
    const u = it.titulo.match(/Universidad (?:de |del |de la |Polit[eé]cnica de |Rey Juan Carlos|Carlos III)?([A-ZÁÉÍÓÚ][\wáéíóúñ]+(?: [A-ZÁÉÍÓÚ][\wáéíóúñ]+)?)/);
    const p = provinciaDe(u?.[1]);
    if (p) ({ provincia, comunidad } = p);
    organismo = u ? `Universidad ${u[0].replace(/^Universidad /, "")}` : depto;
  } else {
    comunidad = "Estatal";
  }
  const tipo = tipoDe(it.titulo);
  const interino = interinoDe(it.titulo);
  const sistema = sistemaDe(it.titulo);
  const grupo = grupoDe(it.titulo);
  return {
    id: `boe:${it.identificador}`,
    fuente: "BOE",
    titulo: it.titulo,
    organismo, municipio, provincia, comunidad,
    tipo, grupo, sistema, interino: interino ? 1 : 0,
    dificultad: dificultadDe({ grupo, sistema, interino, tipo }),
    estado: "abierta",
    plazas: plazasDe(it.titulo),
    url: it.url_html || `https://www.boe.es/diario_boe/txt.php?id=${it.identificador}`,
    detalle_url: it.url_xml || `https://www.boe.es/diario_boe/xml.php?id=${it.identificador}`,
    publicado,
    encontrada: ahora,
    detalle_ok: 0,
  };
}

const SUBESCALA: Array<[RegExp, string]> = [
  [/subescala (?:de )?subalterna|subescala subaltern/, "AP"],
  [/subescala auxiliar/, "C2"],
  [/subescala administrativa/, "C1"],
  [/subescala (?:de )?gestion/, "A2"],
  [/subescala tecnica(?! auxiliar)|subescala de tecnicos superiores/, "A1"],
];

/** Completa una oferta del BOE con el texto del anuncio (XML). */
export function enriquecerBoe(o: Oferta, xml: string): Partial<Oferta> {
  const cuerpo = (xml.match(/<texto[^>]*>([\s\S]*?)<\/texto>/i)?.[1]) ?? xml;
  const text = toText(cuerpo);
  const n = norm(text);
  let grupo = grupoDe(text);
  if (!grupo) for (const [re, g] of SUBESCALA) if (re.test(n)) { grupo = g; break; }
  const sistema = sistemaDe(text) || (o.sistema as string | null) || null;
  const interino = interinoDe(o.titulo + " " + text.slice(0, 600));
  const tipo = o.tipo && o.tipo !== "otros" ? o.tipo : tipoDe(o.titulo, text);
  const plazo = o.publicado ? plazoDesde(text, o.publicado) : null;
  const resumen = text.split("\n").find((l) => /convoca|plaza|puesto|proceso selectivo/i.test(l)) || text.split("\n")[0] || "";
  const plazasTxt = n.match(/(\d+|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+plazas?\s+de\s+([^,.;]+)/);
  const nums: Record<string, number> = { una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
  return {
    grupo, sistema, tipo, interino: interino ? 1 : 0,
    dificultad: dificultadDe({ grupo, sistema, interino, tipo }),
    plazo_fin: plazo?.fin ?? null,
    plazo_texto: plazo?.texto ?? null,
    plazo_aprox: plazo?.aprox ? 1 : 0,
    plazas: o.plazas ?? (plazasTxt ? (nums[plazasTxt[1]] ?? (parseInt(plazasTxt[1], 10) || null)) : null),
    resumen: resumen.slice(0, 500),
    detalle_ok: 1,
  };
}
