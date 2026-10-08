// Utilidades de texto/HTML sin dependencias (Workers no tiene DOMParser).

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·" };

export function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}

/** HTML/XML → texto con saltos de línea en los bloques. */
export function toText(html: string): string {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/dt|\/dd|\/td|\/th)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Valor que sigue a una etiqueta en un texto con una línea por campo. */
export function campo(text: string, etiqueta: string): string | null {
  const lines = text.split("\n");
  const e = etiqueta.toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase();
    if (l.startsWith(e)) {
      const rest = lines[i].slice(etiqueta.length).replace(/^[\s:]+/, "").trim();
      if (rest) return rest;
      return lines[i + 1]?.trim() || null;
    }
  }
  return null;
}

export function cdata(s: string): string {
  return s.replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "").trim();
}

export interface RssItem { title: string; link: string; description: string; pubDate: string }

export function parseRss(xml: string): RssItem[] {
  const out: RssItem[] = [];
  for (const m of xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)) {
    const it = m[0];
    const get = (tag: string) => {
      const r = it.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return r ? decode(cdata(r[1])) : "";
    };
    out.push({ title: get("title").trim(), link: get("link").trim(), description: get("description"), pubDate: get("pubDate").trim() });
  }
  return out;
}
