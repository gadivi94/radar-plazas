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
