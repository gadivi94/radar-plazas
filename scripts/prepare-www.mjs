// Copia la web a www/ para la app de iPhone: le indica la dirección del servidor y le añade la capa nativa.
import { cpSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const API = (process.env.RADAR_API || "https://radaropos.com").replace(/\/$/, "");
rmSync("www", { recursive: true, force: true });
cpSync("web", "www", { recursive: true, filter: (src) => !/_worker\.js$|sw\.js$|_headers$|_redirects$/.test(src) });
cpSync("native", "www/native", { recursive: true });

let n = 0;
(function recorrer(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (f !== "native" && f !== "vendor") recorrer(p); continue; }
    if (!f.endsWith(".html")) continue;
    const raiz = "../".repeat(relative("www", p).split(sep).length - 1);
    let html = readFileSync(p, "utf8");
    // Rutas absolutas → relativas (en la app no hay servidor en «/»)
    html = html.replace(/(href|src)="\/(?!\/)/g, `$1="${raiz}`);
    // Lo que genera el servidor (fichas y sectores) se abre en la web
    html = html.replace(/href="(?:\.\.\/)*(oposiciones[^"]*|plaza\/[^"]*|sitemap\.xml)"/g, `href="${API}/$1"`);
    html = html.replace(/fetch\((["'`])\/api\//g, `fetch($1${API}/api/`);
    const etiqueta = `<script>window.RADAR_API=${JSON.stringify(API)};</script>\n<script src="${raiz}native/native.js"></script>\n`;
    if (!/<head[^>]*>/i.test(html)) { console.error("✖ Sin <head> en " + p); process.exit(1); }
    html = html.replace(/<head[^>]*>/i, (m) => m + "\n" + etiqueta);
    writeFileSync(p, html); n++;
  }
})("www");
// Las páginas que piden datos a «/api/…» con ruta relativa usan el servidor
for (const f of readdirSync("www").filter((x) => x.endsWith(".js"))) {
  const p = join("www", f); let js = readFileSync(p, "utf8");
  const antes = js;
  js = js.replace(/fetch\((["'`])\/api\//g, `fetch($1${API}/api/`);
  if (js !== antes) writeFileSync(p, js);
}
console.log(`✔ www/ listo · ${n} páginas con la capa nativa · API: ${API}`);
