// Genera web/sectores.js a partir de worker/src/sectores.ts (lo comprueba un test). Uso: bun scripts/gen-sectores.ts
import { writeFileSync } from "node:fs";
import { NIVELES, ORDEN_SECTORES, PRUEBAS_NOMBRE, SECTORES } from "../worker/src/sectores";

export function generar(): string {
  const sect = [...ORDEN_SECTORES.map((k) => ({ k, n: SECTORES[k].nombre, subs: SECTORES[k].subs.map(([s, n]) => [s, n]) })), { k: "otros", n: "Otros", subs: [] }];
  return `// Generado por scripts/gen-sectores.ts desde worker/src/sectores.ts: no editar a mano.\nconst SECTORES=${JSON.stringify(sect)};\nconst NIVELES=${JSON.stringify(NIVELES)};\nconst PRUEBAS=${JSON.stringify(PRUEBAS_NOMBRE)};\n`;
}
if (import.meta.main) { writeFileSync(new URL("../web/sectores.js", import.meta.url), generar()); console.log("web/sectores.js listo"); }
