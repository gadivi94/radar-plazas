// Copia la web a www/ para la app y le indica la dirección del servidor (la app no tiene servidor propio).
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const API = (process.env.RADAR_API || "https://radar-plazas.pages.dev").replace(/\/$/, "");
rmSync("www", { recursive: true, force: true });
mkdirSync("www");
cpSync("web", "www", { recursive: true, filter: (src) => !src.endsWith("_worker.js") });
const f = "www/index.html";
let html = readFileSync(f, "utf8");
html = html.replace("<script>", `<script>window.RADAR_API=${JSON.stringify(API)};</script>\n<script>`);
// En la app, el manifiesto y los iconos van por ruta relativa.
html = html.replaceAll('href="/manifest.webmanifest"', 'href="manifest.webmanifest"').replaceAll('href="/icon-512.png"', 'href="icon-512.png"');
writeFileSync(f, html);
console.log(`www/ listo · API: ${API}`);
