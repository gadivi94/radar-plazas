// Sectores y subcategorías de las plazas, nivel de estudios y requisitos extraídos del texto de la convocatoria.
// Todas las expresiones trabajan sobre texto normalizado (sin acentos y en minúsculas), en castellano y catalán.
import { norm } from "./geo";

type Sub = [clave: string, nombre: string, re: RegExp];
interface Sector { nombre: string; subs: Sub[]; general?: RegExp }

// El orden importa: lo más específico primero ("técnico sanitario" antes que "técnico", "auxiliar de policía" antes que "auxiliar").
export const SECTORES: Record<string, Sector> = {
  seguridad: {
    nombre: "Seguridad y emergencias",
    subs: [
      ["mossos", "Mossos d'Esquadra", /mossos? d'esquadra|policia de la generalitat|\bpg-me\b/],
      ["policia-nacional", "Policía Nacional", /policia nacional|escala basica de policia|cuerpo nacional de policia/],
      ["guardia-civil", "Guardia Civil", /guardia civil|guardias civiles/],
      ["policia-autonomica", "Otras policías autonómicas", /ertzaintza|policia foral|policia canaria|policia autonomica/],
      ["policia-local", "Policía local", /policia local|policia municipal|guardia urbana|guardia municipal|policia de barri|agents? de (la )?policia|agentes? de (la )?policia|caporal|sergent|cabo de (la )?policia|inspector de (la )?policia|intendent/],
      ["bomberos", "Bomberos", /bomber|extincion de incendios|prevencion y extincion|extincio d'incendis/],
      ["prisiones", "Prisiones", /penitenciari|instituciones penitenciarias|execucio penal|serveis penitenciaris/],
      ["agente-civico", "Agente cívico", /agents? civics?|agentes? civicos?|educadors? de carrer|agent de convivencia|agente de convivencia/],
      ["vigilante", "Vigilante y agente de movilidad", /auxiliar de policia|vigilant|vigilante|agents? de mobilitat|agentes? de movilidad|guarda municipal|guarda urba|zelador de via publica|controlador de zona blava/],
      ["forestal", "Agentes rurales y forestales", /agents? rurals?|agentes? forestal|agentes? medioambiental|agentes? de medio ambiente|guarda forestal|guarderia forestal|agents? forestals?/],
      ["proteccion-civil", "Protección civil y emergencias", /proteccion civil|proteccio civil|emergenci|\b112\b|socorrista|salvament|salvamento/],
    ],
    general: /polic|guardia|seguretat ciutadana|seguridad ciudadana/,
  },
  justicia: {
    nombre: "Justicia",
    subs: [
      ["tramitacion", "Tramitación procesal", /tramitacion procesal|tramitacio processal/],
      ["gestion-procesal", "Gestión procesal", /gestion procesal|gestio processal/],
      ["auxilio-judicial", "Auxilio judicial", /auxilio judicial|auxili judicial/],
      ["laj", "Letrados de la Administración de Justicia", /letrad[oa]s? de la administracion de justicia|lletrats? de l'administracio de justicia/],
      ["forense", "Médicos forenses y toxicología", /forense|instituto nacional de toxicologia/],
      ["carrera-judicial", "Jueces y fiscales", /carrera judicial|carreras judicial y fiscal|\bjueces\b|\bfiscales\b/],
    ],
    general: /justicia|juzgado|jutjat|judicial|tribunal superior/,
  },
  sanidad: {
    nombre: "Sanidad",
    subs: [
      ["tcae", "TCAE / auxiliar de enfermería", /\btcae\b|cures auxiliars d'infermeria|auxiliar de enfermeria|auxiliar d'infermeria|cuidados auxiliares de enfermeria/],
      ["celador", "Celador", /celador|zelador(?! de via)/],
      ["enfermeria", "Enfermería", /enfermer|infermer|matron|llevador/],
      ["tecnico-sanitario", "Técnicos sanitarios", /tecnico (superior )?(sanitario|en (laboratorio|radiodiagnostico|imagen|anatomia)|de laboratorio)|tecnic (superior )?(sanitari|de laboratori|en imatge|de radiodiagnostic)|higienista|radiolog|tecnic en emergencies sanitaries|tecnico en emergencias sanitarias/],
      ["fisioterapia", "Fisioterapia y rehabilitación", /fisioterap|terapeuta ocupacional|logoped/],
      ["farmacia", "Farmacia", /farmac/],
      ["medicina", "Medicina", /\bmedic[oa]s?\b|\bmetges?\b|facultatiu especialista|facultativo especialista|pediatr|odontolog|psiquiatr/],
    ],
    general: /sanitari|hospital|salud publica|salut publica|institut catala de la salut/,
  },
  educacion: {
    nombre: "Educación",
    subs: [
      ["educador-infantil", "Educación infantil (0-3)", /educador(a|es)? infantil|escola bressol|escuela infantil|tecnic d'educacio infantil|tecnico (superior )?(en|de) educacion infantil|llar d'infants/],
      ["maestro", "Maestros", /maestr[oa]s?\b|\bmestres?\b|cuerpo de maestros/],
      ["profesor", "Profesorado", /profesor|professor|profesorado|catedratic|ensenyament secundari|educacion secundaria (obligatoria )?y bachillerato|personal docente e investigador|\bpdi\b/],
      ["monitor", "Monitores y apoyo educativo", /monitor|vetllador|auxiliar d'educacio especial|educador d'educacio especial|tecnic d'educacio especial|lleure|comedor escolar|menjador/],
    ],
    general: /docent|ensenyament|educacio|educacion/,
  },
  social: {
    nombre: "Servicios sociales",
    subs: [
      ["trabajador-social", "Trabajo social", /treballador(a|es)? social|trabajador(a|es)? social/],
      ["educador-social", "Educación e integración social", /educador(a|es)? social|integracio social|integracion social|tecnic d'integracio/],
      ["auxiliar-hogar", "Atención a domicilio y geriatría", /auxiliar de la llar|auxiliar de hogar|ayuda a domicilio|treballador(a)? familiar|\bsad\b|gerocultor|auxiliar de geriatria|cuidador|atencio domiciliaria/],
      ["psicologia", "Psicología", /psicolog/],
    ],
    general: /serveis socials|servicios sociales/,
  },
  transporte: {
    nombre: "Transporte",
    subs: [
      ["metro-tren", "Metro, tren y ferrocarril", /maquinista|\bmetro\b|renfe|\badif\b|ferrocarril|\bfgc\b|\btren\b/],
      ["conductor", "Conductores de autobús y vehículos", /conductor|conduccio|conduccion|xofer|chofer|autobus|\bbus\b/],
      ["atencion-viajeros", "Atención al cliente", /atencio al client|atencion al cliente|\btmb\b|transports metropolitans/],
      ["otros-transporte", "Otros puestos en empresas de transporte", /(?!)/],
    ],
  },
  empresas: {
    nombre: "Correos y empresas públicas",
    subs: [
      ["correos", "Correos", /\bcorreos\b|repartidor|reparto postal|clasificacion postal/],
      ["aeropuertos-puertos", "Aeropuertos y puertos", /\baena\b|puertos del estado|autoridad portuaria|port de barcelona/],
      ["otras-empresas", "Otras empresas públicas", /loterias|paradores|tragsa|navantia|\brtve\b|casa de la moneda|\bfnmt\b|\bsepi\b/],
    ],
  },
  militar: {
    nombre: "Fuerzas Armadas",
    subs: [
      ["tropa", "Tropa y marinería", /tropa y marineria|militar(es)? de tropa|soldados?\b|marineros?\b/],
      ["oficiales", "Oficiales y suboficiales", /academia general militar|escala de oficiales|suboficial|cuerpos? (generales|comunes) de las fuerzas armadas|ensenanza militar|guardia real/],
    ],
    general: /fuerzas armadas|\bejercito\b|\barmada\b|ministerio de defensa/,
  },
  subalterno: {
    nombre: "Subalternos y servicios",
    subs: [
      ["conserje", "Conserjes y ordenanzas", /conserj|conserge|subaltern|ordenanza|ujier|uixer|\bporter|bidel/],
      ["limpieza", "Limpieza", /netej|limpieza|limpiador/],
      ["cocina", "Cocina y comedor", /cuiner|cocinero|ajudant de cuina|ayudante de cocina|cambrer|camarero/],
    ],
  },
  administrativo: {
    nombre: "Administración",
    subs: [
      ["aux-administrativo", "Auxiliar administrativo", /auxiliar administratiu|auxiliar administrativ|auxiliar d'administracio|auxiliar de administracion|cuerpo general auxiliar|subescala auxiliar/],
      ["atencion-ciudadana", "Atención ciudadana", /informador|atencion ciudadana|atencio ciutadana|oficina d'atencio|\boac\b|\bsac\b|notificador|telefonista|recepcionista/],
      ["tecnico-admin", "Técnico de administración general", /tecnic d'administracio general|tecnico de administracion general|\btag\b|cuerpo superior de administradores|administradores civiles del estado/],
      ["gestion", "Gestión", /gestion de la administracion|cuerpo de gestion|tecnic de gestio|tecnico de gestion|subescala de gestion|\bgestio\b/],
      ["administrativo", "Administrativo", /administratiu|administrativ|cuerpo general administrativo|subescala administrativa/],
    ],
  },
  oficios: {
    nombre: "Oficios y mantenimiento",
    subs: [
      ["jardineria", "Jardinería", /jardiner/],
      ["electricidad", "Electricidad y fontanería", /electricist|lampist|fontaner|calefaccio|calefaccion/],
      ["mecanica", "Mecánica y taller", /mecanic|taller/],
      ["construccion", "Construcción y carpintería", /paleta|albanil|pintor|fuster|carpinter|obres/],
      ["cementerio", "Cementerios", /sepulturer|enterrador|cementiri|cementerio/],
      ["brigada", "Brigada y peones", /brigada|\bpeon|\bpeo\b|operari|operario|oficial (de )?(primera|segona|segunda|1a|2a)|oficial d'oficis|oficial de oficios|manteniment|mantenimiento/],
    ],
    general: /\boficial\b/,
  },
  tecnico: {
    nombre: "Técnicos e informática",
    subs: [
      ["informatica", "Informática y tecnología", /informatic|\btic\b|sistemes d'informacio|sistemas de informacion|programador|analista|ciberseguretat|ciberseguridad|tecnologies de la informacio|tecnologias de la informacion/],
      ["ingenieria", "Ingeniería y arquitectura", /enginyer|ingenier|arquitect|aparellador/],
      ["juridico", "Derecho", /juridic|letrad|lletrat|advocat|abogad/],
      ["economia", "Economía e intervención", /economista|interventor|tresorer|tesorer|habilitacion nacional|habilitacio nacional|secretari[ao]?[- ]interventor/],
      ["otros-tecnicos", "Otros técnicos", /tecnic|tecnico|titulat superior|titulado superior|facultatiu|investigador|postdoc|veterinari|biolog|quimic|arqueolog|bibliotec|arxiver|archivero|periodista|traductor|secretari/],
    ],
  },
};
export const ORDEN_SECTORES = Object.keys(SECTORES);
export const SECTOR_NOMBRE: Record<string, string> = { ...Object.fromEntries(ORDEN_SECTORES.map((k) => [k, SECTORES[k].nombre])), otros: "Otros" };
export const SUBTIPOS: Record<string, { sector: string; nombre: string }> = Object.fromEntries(
  ORDEN_SECTORES.flatMap((s) => SECTORES[s].subs.map(([k, n]) => [k, { sector: s, nombre: n }])),
);

function buscar(t: string): { tipo: string; subtipo: string | null } | null {
  for (const s of ORDEN_SECTORES) for (const [k, , re] of SECTORES[s].subs) if (re.test(t)) return { tipo: s, subtipo: k };
  for (const s of ORDEN_SECTORES) if (SECTORES[s].general?.test(t)) return { tipo: s, subtipo: null };
  return null;
}

/** Sector y subcategoría: primero por el título y, si no hay suerte, por el texto. */
export function clasificar(titulo: string, texto = ""): { tipo: string; subtipo: string | null } {
  return buscar(norm(titulo)) || (texto ? buscar(norm(texto).slice(0, 2500)) : null) || { tipo: "otros", subtipo: null };
}

// ---------- nivel de estudios ----------
// 0 sin titulación · 1 ESO · 2 Bachillerato / FP grado medio · 3 FP grado superior · 4 universitario
export const NIVELES = ["Sin titulación", "ESO / Graduado escolar", "Bachillerato o FP de grado medio", "FP de grado superior", "Grado universitario"];
const NIVEL_GRUPO: Record<string, number> = { AP: 0, C2: 1, C1: 2, B: 3, A2: 4, A1: 4 };

export function nivelDeTitulacion(texto: string | null | undefined): number | null {
  const t = norm(texto || "");
  if (!t) return null;
  if (/grado universitario|grau universitari|licenciad|llicenciat|diplomad|diplomat|ingeniero|enginyer|arquitecto|titulacio universitaria|titulo universitario|titol universitari|doctor|master/.test(t)) return 4;
  if (/tecnico superior|tecnic superior|grau superior|grado superior|cicle formatiu de grau superior/.test(t)) return 3;
  if (/bachiller|batxillerat|grau mitja|grado medio|\btecnico\b|\btecnic\b|tecnic especialista|fp ?2|bup/.test(t)) return 2;
  if (/graduado en educacion secundaria|graduat en educacio secundaria|\beso\b|graduado escolar|graduat escolar|fp ?1|tecnic auxiliar|tecnico auxiliar|\begb\b/.test(t)) return 1;
  if (/certificado de escolaridad|certificat d'escolaritat|sin titulacion|sense titulacio|no es necessaria cap titulacio|no se exige titulacion|agrupacions? professionals|educacion primaria/.test(t)) return 0;
  return null;
}
export function nivelDe(grupo: string | null | undefined, titulacion?: string | null): number | null {
  const n = nivelDeTitulacion(titulacion);
  if (n !== null) return n;
  return grupo && grupo in NIVEL_GRUPO ? NIVEL_GRUPO[grupo] : null;
}

// ---------- requisitos ----------
export interface Requisitos {
  titulacion?: string;
  edadMin?: number;
  edadMax?: number;
  carne?: string[];
  catalan?: string;         // A2 B1 B2 C1 C2
  otroIdioma?: string;      // euskera, valenciano, gallego…
  altura?: boolean;
  nacionalidad?: "es" | "ue";
  tasa?: number;
  pruebas?: string[];       // test, practico, fisica, psicotecnico, entrevista, medico, idioma, meritos
}
const NUM_PAL: Record<string, number> = { dieciseis: 16, dieciocho: 18, setze: 16, divuit: 18 };
const num = (s?: string) => (s ? (/^\d+$/.test(s) ? parseInt(s, 10) : NUM_PAL[s]) : undefined);
const NIVELES_CAT = ["a2", "b1", "b2", "c1", "c2"];

export function requisitosDe(textoBruto: string, titulacionCampo?: string | null): Requisitos {
  const t = norm(textoBruto).replace(/\n/g, " ");
  const r: Requisitos = {};
  if (titulacionCampo) r.titulacion = titulacionCampo.slice(0, 160);
  else {
    const m = textoBruto.match(/(?:estar en posesi[oó]n del? (?:t[ií]tulo de |titulaci[oó]n de )?|tenir (?:el t[ií]tol de |la titulaci[oó] de )|titulaci[oó]n exigida:?\s*|titulaci[oó] requerida:?\s*)([^.;\n]{4,140})/i);
    if (m) r.titulacion = m[1].trim();
  }
  const mn = t.match(/(?:tener|haber) cumplidos? (?:los )?(\d{2}|dieciseis|dieciocho) anos|(?:tenir|haver) complerts? (?:els )?(\d{2}|setze|divuit) anys|mayor(?:es)? de (\d{2}) anos|majors? de (\d{2}) anys/);
  if (mn) r.edadMin = num(mn[1] || mn[2] || mn[3] || mn[4]);
  const mx = t.match(/(?:no (?:exceder|haber cumplido|superar|tener mas) (?:de )?(?:la edad (?:maxima )?de )?|edad maxima (?:de )?|no (?:superar|haver complert|tenir mes) (?:de )?(?:els )?|edat maxima (?:de )?)(\d{2}) (?:anos|anys)/);
  if (mx && !/jubila/.test(t.slice(Math.max(0, (mx.index || 0) - 40), (mx.index || 0) + 60))) r.edadMax = parseInt(mx[1], 10);
  const ic = t.search(/permiso de conduc|permis de conduc|carnet de conduc|carne de conduc|permiso de circulacion|permis de circulacio|carnet de conduir/);
  if (ic >= 0) {
    const ventana = t.slice(ic, ic + 90).split(/[.;]/)[0];
    const cl = [...new Set([...ventana.matchAll(/\b(a1|a2|b|c1|c|d|e|btp)\b/g)].map((m) => m[1].toUpperCase()))];
    r.carne = cl.length ? cl : ["B"];
  }
  if (/catala|catalan/.test(t)) {
    const m = t.match(/(?:nivell|nivel|certificat|certificado)[^.]{0,50}?\b(a2|b1|b2|c1|c2)\b[^.]{0,60}?catala|catala[^.]{0,60}?\b(a2|b1|b2|c1|c2)\b|catalan[^.]{0,60}?\b(a2|b1|b2|c1|c2)\b/);
    if (m) r.catalan = (m[1] || m[2] || m[3]).toUpperCase();
    else if (/nivell de suficiencia|nivel de suficiencia/.test(t)) r.catalan = "C1";
    else if (/nivell intermedi/.test(t)) r.catalan = "B2";
    else if (/nivell elemental|nivell basic/.test(t)) r.catalan = "A2";
  }
  if (/euskera|perfil linguistico/.test(t)) r.otroIdioma = "Euskera";
  else if (/valenciano|valencia\b.*nivel|coneixements de valencia/.test(t)) r.otroIdioma = "Valenciano";
  else if (/lingua galega|idioma gallego|celga/.test(t)) r.otroIdioma = "Gallego";
  if (/estatura|alcada minima|altura minima|talla minima/.test(t)) r.altura = true;
  if (/nacionalidad espanola|nacionalitat espanyola/.test(t)) r.nacionalidad = /estado miembro|estats membres|union europea|unio europea/.test(t) ? "ue" : "es";
  const mt = t.match(/(?:tasa|taxa|derechos de examen|drets d'examen|drets de participacio)[^.]{0,90}?(\d{1,3}(?:[.,]\d{1,2})?) ?(?:euros|€|eur\b)/);
  if (mt) { const v = parseFloat(mt[1].replace(",", ".")); if (v > 0 && v < 500) r.tasa = v; }
  const p: string[] = [];
  if (/tipo test|tipus test|questionari|cuestionario|respuestas alternativas|respostes alternatives/.test(t)) p.push("test");
  if (/supuesto practico|supuestos practicos|cas practic|casos practics|prueba practica|prova practica|exercici practic|ejercicio practico/.test(t)) p.push("practico");
  if (/prueba(?:s)? fisica|proves? fisiques|aptitud fisica|capacitat fisica|prova d'aptitud fisica|pruebas de aptitud fisica/.test(t)) p.push("fisica");
  if (/psicotecni[cq]/.test(t)) p.push("psicotecnico");
  if (/entrevista/.test(t)) p.push("entrevista");
  if (/reconocimiento medico|revisio medica|reconeixement medic|prova medica|prueba medica/.test(t)) p.push("medico");
  if (/concurso de meritos|concurs de merits|valoracio de merits|valoracion de meritos/.test(t)) p.push("meritos");
  if (p.length) r.pruebas = p;
  return r;
}

export const PRUEBAS_NOMBRE: Record<string, string> = {
  test: "Examen tipo test", practico: "Supuesto práctico", fisica: "Pruebas físicas", psicotecnico: "Psicotécnico",
  entrevista: "Entrevista", medico: "Reconocimiento médico", meritos: "Valoración de méritos",
};
