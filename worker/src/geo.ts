import { MUNI_COORD, MUNI_PROV, PROV_CAT, PROV_CENTRO } from "./munis-cat";
// Provincias → comunidad autónoma, con las variantes de nombre que aparecen en el BOE.

export const COMUNIDADES = [
  "Andalucía", "Aragón", "Asturias", "Baleares", "Canarias", "Cantabria",
  "Castilla y León", "Castilla-La Mancha", "Cataluña", "Comunidad Valenciana",
  "Extremadura", "Galicia", "La Rioja", "Madrid", "Murcia", "Navarra",
  "País Vasco", "Ceuta", "Melilla", "Estatal",
] as const;

const PROV: Array<[string, string, string[]]> = [
  // [provincia, comunidad, variantes]
  ["Almería", "Andalucía", []], ["Cádiz", "Andalucía", []], ["Córdoba", "Andalucía", []],
  ["Granada", "Andalucía", []], ["Huelva", "Andalucía", []], ["Jaén", "Andalucía", []],
  ["Málaga", "Andalucía", []], ["Sevilla", "Andalucía", []],
  ["Huesca", "Aragón", []], ["Teruel", "Aragón", []], ["Zaragoza", "Aragón", []],
  ["Asturias", "Asturias", ["Oviedo"]],
  ["Illes Balears", "Baleares", ["Baleares", "Islas Baleares", "Balears", "Palma"]],
  ["Las Palmas", "Canarias", ["Gran Canaria"]], ["Santa Cruz de Tenerife", "Canarias", ["Tenerife"]],
  ["Cantabria", "Cantabria", ["Santander"]],
  ["Ávila", "Castilla y León", []], ["Burgos", "Castilla y León", []], ["León", "Castilla y León", []],
  ["Palencia", "Castilla y León", []], ["Salamanca", "Castilla y León", []], ["Segovia", "Castilla y León", []],
  ["Soria", "Castilla y León", []], ["Valladolid", "Castilla y León", []], ["Zamora", "Castilla y León", []],
  ["Albacete", "Castilla-La Mancha", []], ["Ciudad Real", "Castilla-La Mancha", []], ["Cuenca", "Castilla-La Mancha", []],
  ["Guadalajara", "Castilla-La Mancha", []], ["Toledo", "Castilla-La Mancha", []],
  ["Barcelona", "Cataluña", []], ["Girona", "Cataluña", ["Gerona"]], ["Lleida", "Cataluña", ["Lérida"]],
  ["Tarragona", "Cataluña", []],
  ["Alicante", "Comunidad Valenciana", ["Alacant", "Alicante/Alacant"]],
  ["Castellón", "Comunidad Valenciana", ["Castelló", "Castellón/Castelló", "Castellón de la Plana"]],
  ["Valencia", "Comunidad Valenciana", ["València", "Valencia/València"]],
  ["Badajoz", "Extremadura", []], ["Cáceres", "Extremadura", []],
  ["A Coruña", "Galicia", ["La Coruña", "Coruña"]], ["Lugo", "Galicia", []], ["Ourense", "Galicia", ["Orense"]],
  ["Pontevedra", "Galicia", ["Vigo"]],
  ["La Rioja", "La Rioja", ["Logroño"]],
  ["Madrid", "Madrid", []],
  ["Murcia", "Murcia", ["Región de Murcia"]],
  ["Navarra", "Navarra", ["Pamplona", "Nafarroa"]],
  ["Álava", "País Vasco", ["Araba", "Araba/Álava", "Vitoria-Gasteiz", "Vitoria"]],
  ["Gipuzkoa", "País Vasco", ["Guipúzcoa", "Donostia/San Sebastián", "San Sebastián"]],
  ["Bizkaia", "País Vasco", ["Vizcaya", "Bilbao"]],
  ["Ceuta", "Ceuta", []], ["Melilla", "Melilla", []],
];

export const PROVINCIAS = PROV.map(([provincia, comunidad]) => ({ provincia, comunidad }));

/** Provincia de un municipio catalán (el CIDO solo da el ayuntamiento). */
export function provinciaCatalana(municipio: string | null | undefined): string | null {
  if (!municipio) return null;
  const k = norm(municipio).replace(/’/g, "'").replace(/^(el|la|els|les)\s+|^l'/, "").trim();
  const c = MUNI_PROV[k];
  return c ? PROV_CAT[c] : null;
}

/** [lon, lat] de un municipio catalán. */
export function coordCatalana(municipio: string | null | undefined): [number, number] | null {
  if (!municipio) return null;
  const k = norm(municipio).replace(/’/g, "'").replace(/^(el|la|els|les)\s+|^l'/, "").trim();
  return MUNI_COORD[k] || null;
}
export function centroProvincia(p: string | null | undefined): [number, number] | null {
  if (!p) return null;
  const k = Object.keys(PROV_CENTRO).find((x) => norm(x) === norm(p) || norm(x).includes(norm(p)));
  return k ? PROV_CENTRO[k] : null;
}
/** Distancia en km entre dos puntos [lon, lat]. */
export function distanciaKm(a: [number, number], b: [number, number]): number {
  const R = 6371, r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Provincias por los dos primeros dígitos del código postal (códigos INE)
export const PROV_CP: Record<string, string> = {
  "01": "Álava", "02": "Albacete", "03": "Alicante", "04": "Almería", "05": "Ávila", "06": "Badajoz", "07": "Illes Balears", "08": "Barcelona", "09": "Burgos", "10": "Cáceres",
  "11": "Cádiz", "12": "Castellón", "13": "Ciudad Real", "14": "Córdoba", "15": "A Coruña", "16": "Cuenca", "17": "Girona", "18": "Granada", "19": "Guadalajara", "20": "Gipuzkoa",
  "21": "Huelva", "22": "Huesca", "23": "Jaén", "24": "León", "25": "Lleida", "26": "La Rioja", "27": "Lugo", "28": "Madrid", "29": "Málaga", "30": "Murcia",
  "31": "Navarra", "32": "Ourense", "33": "Asturias", "34": "Palencia", "35": "Las Palmas", "36": "Pontevedra", "37": "Salamanca", "38": "Santa Cruz de Tenerife", "39": "Cantabria", "40": "Segovia",
  "41": "Sevilla", "42": "Soria", "43": "Tarragona", "44": "Teruel", "45": "Toledo", "46": "Valencia", "47": "Valladolid", "48": "Bizkaia", "49": "Zamora", "50": "Zaragoza", "51": "Ceuta", "52": "Melilla",
};

export function norm(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const INDEX = new Map<string, { provincia: string; comunidad: string }>();
for (const [p, c, vs] of PROV) {
  for (const n of [p, ...vs]) INDEX.set(norm(n), { provincia: p, comunidad: c });
}

/** Busca una provincia por nombre (o capital/variante). */
export function provinciaDe(nombre: string | undefined | null): { provincia: string; comunidad: string } | null {
  if (!nombre) return null;
  const n = norm(nombre);
  if (INDEX.has(n)) return INDEX.get(n)!;
  // "Valencia/València", "Alicante/Alacant"
  for (const part of n.split("/")) { const p = INDEX.get(part.trim()); if (p) return p; }
  return null;
}

/** Comunidad autónoma por el nombre de un departamento del BOE ("COMUNIDAD AUTÓNOMA DE GALICIA"). */
export function comunidadPorTexto(texto: string): string | null {
  const t = norm(texto);
  const pares: Array<[RegExp, string]> = [
    [/andaluc/, "Andalucía"], [/aragon/, "Aragón"], [/asturias/, "Asturias"], [/balears|baleares/, "Baleares"],
    [/canarias/, "Canarias"], [/cantabria/, "Cantabria"], [/castilla y leon/, "Castilla y León"],
    [/castilla-la mancha|castilla la mancha/, "Castilla-La Mancha"], [/cataluna|catalunya/, "Cataluña"],
    [/valenciana/, "Comunidad Valenciana"], [/extremadura/, "Extremadura"], [/galicia/, "Galicia"],
    [/la rioja/, "La Rioja"], [/comunidad de madrid/, "Madrid"], [/murcia/, "Murcia"], [/navarra/, "Navarra"],
    [/pais vasco|euskadi/, "País Vasco"], [/ceuta/, "Ceuta"], [/melilla/, "Melilla"],
  ];
  for (const [re, c] of pares) if (re.test(t)) return c;
  return null;
}

// Municipios del Maresme (para que "Maresme" funcione como zona en las alertas).
export const MARESME = [
  "Alella", "Arenys de Mar", "Arenys de Munt", "Argentona", "Cabrera de Mar", "Cabrils", "Caldes d'Estrac",
  "Calella", "Canet de Mar", "Dosrius", "Malgrat de Mar", "el Masnou", "Masnou", "Mataró", "Montgat", "Òrrius",
  "Palafolls", "Pineda de Mar", "Premià de Dalt", "Premià de Mar", "Sant Andreu de Llavaneres",
  "Sant Cebrià de Vallalta", "Sant Iscle de Vallalta", "Sant Pol de Mar", "Sant Vicenç de Montalt",
  "Santa Susanna", "Teià", "Tiana", "Tordera", "Vilassar de Dalt", "Vilassar de Mar",
];

/** Expande zonas especiales (comarcas) a municipios. */
export function expandirZonas(zonas: string[]): string[] {
  const out: string[] = [];
  for (const z of zonas) {
    if (norm(z) === "maresme") out.push(...MARESME, "Maresme");
    else if (norm(z) === "l'hospitalet" || norm(z) === "hospitalet") out.push("L'Hospitalet de Llobregat", "Hospitalet");
    else out.push(z);
  }
  return out;
}
