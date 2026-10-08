import { afterEach, describe, expect, test } from "bun:test";
import { dificultadDe, grupoDe, plazoDesde, sistemaDe, tipoDe } from "../src/classify";
import { coincide } from "../src/filters";
import { provinciaDe } from "../src/geo";
import { enriquecerBoe, itemsSeccion2B, ofertaDesdeBoe, parseTituloLocal } from "../src/sources/boe";
import { enriquecerCido, municipioDe, ofertasDesdeFeed } from "../src/sources/cido";
import { ofertasTmb } from "../src/sources/tmb";
import { ciclo } from "../src/run";
import worker from "../src/index";
import { fakeD1 } from "./fake-d1";
import * as F from "./fixtures";

const AHORA = "2026-10-08T06:00:00.000Z";

describe("clasificación", () => {
  test("tipos", () => {
    expect(tipoDe("3 places d'Agent de Policia Local")).toBe("seguridad");
    expect(tipoDe("Borsa de treball de places d'Agent cívic")).toBe("seguridad");
    expect(tipoDe("1 plaça d'Auxiliar de policia - vigilant")).toBe("seguridad");
    expect(tipoDe("2 places d'Auxiliar administratiu")).toBe("administrativo");
    expect(tipoDe("1 plaça de Subaltern a la Residència")).toBe("subalterno");
    expect(tipoDe("Ampliació Borsa Personal Conducció Bus 2027")).toBe("transporte");
    expect(tipoDe("2 places de Peó de brigada")).toBe("oficios");
    expect(tipoDe("1 plaça de Tècnic superior en dret")).toBe("tecnico");
    expect(tipoDe("Cuerpo General Auxiliar de la Administración del Estado")).toBe("administrativo");
  });
  test("grupo, sistema y dificultad", () => {
    expect(grupoDe("C2 - ESO, graduat escolar")).toBe("C2");
    expect(grupoDe("Agrupacions professionals")).toBe("AP");
    expect(grupoDe("Grupo C, Subgrupo C1")).toBe("C1");
    expect(sistemaDe("Concurs o valoració de mèrits")).toBe("concurso");
    expect(sistemaDe("Concurs oposició o valoració de mèrits i prova")).toBe("concurso-oposicion");
    expect(sistemaDe("mediante el sistema de oposición, turno libre")).toBe("oposicion");
    expect(dificultadDe({ grupo: "C2", sistema: "concurso", interino: true, tipo: "seguridad" })).toBe(1);
    expect(dificultadDe({ grupo: "C1", sistema: "concurso-oposicion", tipo: "seguridad" })).toBe(2);
    expect(dificultadDe({ grupo: "A1", sistema: "oposicion" })).toBe(3);
  });
  test("plazo en días hábiles y naturales", () => {
    // Jueves 08/10/2026 + 20 hábiles (sin festivos) = 05/11/2026
    expect(plazoDesde("será de veinte días hábiles a contar desde el día siguiente", "2026-10-08")?.fin).toBe("2026-11-05");
    expect(plazoDesde("de 20 días naturales contados a partir del siguiente", "2026-10-08")?.fin).toBe("2026-10-28");
    expect(plazoDesde("serà de vint dies hàbils", "2026-10-08")?.aprox).toBe(true);
  });
  test("provincias", () => {
    expect(provinciaDe("Valencia/València")?.comunidad).toBe("Comunidad Valenciana");
    expect(provinciaDe("Granada")?.comunidad).toBe("Andalucía");
    expect(provinciaDe("Gerona")?.provincia).toBe("Girona");
  });
});

describe("BOE", () => {
  test("lee la sección 2B", () => {
    const items = itemsSeccion2B(F.BOE_SUMARIO);
    expect(items.map((i) => i.identificador)).toEqual(["BOE-A-2026-20001", "BOE-A-2026-20010", "BOE-A-2026-20011", "BOE-A-2026-20012"]);
    expect(items[0].departamento).toBe("MINISTERIO DEL INTERIOR");
    expect(items[1].departamento).toBe("ADMINISTRACIÓN LOCAL");
    expect(items[0].url_html).toContain("txt.php");
  });
  test("título local → municipio y comunidad", () => {
    const l = parseTituloLocal("Resolución de 31 de agosto de 2026, del Ayuntamiento de Baza (Granada), referente a la convocatoria para proveer una plaza.");
    expect(l).toEqual({ organismo: "Ayuntamiento de Baza", municipio: "Baza", provincia: "Granada", comunidad: "Andalucía" });
    const d = parseTituloLocal("Resolución de 1 de octubre de 2026, de la Diputación Provincial de Sevilla, referente a la convocatoria para proveer varias plazas.");
    expect(d?.comunidad).toBe("Andalucía");
  });
  test("estatales y enriquecido", () => {
    const [policia, baza, alcobendas] = itemsSeccion2B(F.BOE_SUMARIO).map((i) => ofertaDesdeBoe(i, "2026-10-08", AHORA));
    expect(policia.comunidad).toBe("Estatal");
    expect(policia.tipo).toBe("seguridad");
    const e = enriquecerBoe(baza, F.BOE_XML_BAZA);
    expect(e.grupo).toBe("C1");
    expect(e.sistema).toBe("oposicion");
    expect(e.tipo).toBe("administrativo");
    expect(e.plazo_fin).toBe("2026-11-05");
    const a = enriquecerBoe(alcobendas, F.BOE_XML_ALCOBENDAS);
    expect(a.grupo).toBe("C1");
    expect(a.plazas).toBe(6);
    expect(a.plazo_fin).toBe("2026-10-28");
  });
});

describe("CIDO", () => {
  test("feed", () => {
    const os = ofertasDesdeFeed(F.CIDO_RSS, AHORA);
    expect(os).toHaveLength(4);
    expect(os[0].id).toBe("cido:22173139");
    expect(os[0].organismo).toBe("Ajuntament de Barcelona - Barcelona de Serveis Municipals, SA");
    expect(os[0].municipio).toBe("Barcelona");
    expect(os[0].tipo).toBe("seguridad");
    expect(os[0].interino).toBe(1);
    expect(os[1].municipio).toBe("Mataró");
    expect(os[0].url).toStartWith("https://");
  });
  test("municipio", () => {
    expect(municipioDe("Ajuntament de l'Hospitalet de Llobregat", "x")).toBe("Hospitalet de Llobregat");
    expect(municipioDe("Ajuntament d'Arenys de Mar", "x")).toBe("Arenys de Mar");
    expect(municipioDe("Generalitat de Catalunya - Departament de Salut", "1 plaça de Tècnic (Lleida)")).toBe("Lleida");
  });
  test("ficha", () => {
    const [civic, policia] = ofertasDesdeFeed(F.CIDO_RSS, AHORA);
    const e = enriquecerCido(civic, F.CIDO_FICHA_CIVIC);
    expect(e.estado).toBe("abierta");
    expect(e.plazo_fin).toBe("2027-04-10");
    expect(e.grupo).toBe("C2");
    expect(e.sistema).toBe("concurso");
    expect(e.dificultad).toBe(1);
    expect(e.tramite_url).toBe("https://creix.bsmsa.cat/job/Borsa-Agent-Civica/1367851955/?a=1&b=2");
    const p = enriquecerCido(policia, F.CIDO_FICHA_POLICIA);
    expect(p.estado).toBe("pendiente");
    expect(p.plazo_fin).toBeNull();
    expect(p.plazo_texto).toContain("20 dies naturals");
    expect(p.grupo).toBe("C1");
    expect(p.dificultad).toBe(2);
  });
});

test("TMB: solo ofertas abiertas", () => {
  const os = ofertasTmb(F.TMB_HTML, "2026-10-08", AHORA);
  expect(os.map((o) => o.id)).toEqual(["tmb:10210"]);
  expect(os[0].plazo_fin).toBe("2026-10-20");
  expect(os[0].tipo).toBe("transporte");
});

test("filtros de alerta", () => {
  const [civic, policia, tecnico, subaltern] = ofertasDesdeFeed(F.CIDO_RSS, AHORA);
  const f = { zonas: ["Barcelona", "Badalona", "Maresme"], tipos: ["seguridad"] };
  expect(coincide(civic, f, "2026-10-08")).toBe(true);
  expect(coincide(policia, f, "2026-10-08")).toBe(true); // Mataró está en el Maresme
  expect(coincide(tecnico, f, "2026-10-08")).toBe(false);
  expect(coincide(subaltern, { zonas: ["Barcelona"], tipos: ["subalterno"] }, "2026-10-08")).toBe(true);
  expect(coincide(subaltern, { zonas: ["Badalona"] }, "2026-10-08")).toBe(false);
});

describe("ciclo completo con D1 en memoria", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  test("recoge, completa, avisa una vez y responde la API", async () => {
    const DB = fakeD1();
    const pushes: unknown[] = [];
    globalThis.fetch = (async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const ok = (body: string, type = "text/html") => new Response(body, { headers: { "Content-Type": type } });
      if (url.includes("datosabiertos/api/boe/sumario")) return ok(JSON.stringify(F.BOE_SUMARIO), "application/json");
      if (url.includes("xml.php?id=BOE-A-2026-20010")) return ok(F.BOE_XML_BAZA);
      if (url.includes("xml.php?id=BOE-A-2026-20011")) return ok(F.BOE_XML_ALCOBENDAS);
      if (url.includes("xml.php")) return ok("<documento><texto><p>Se convoca proceso selectivo.</p></texto></documento>");
      if (url.includes("cido.diba.cat/rss")) return ok(F.CIDO_RSS, "application/rss+xml");
      if (url.includes("/oposicions/22173139")) return ok(F.CIDO_FICHA_CIVIC);
      if (url.includes("/oposicions/22300001")) return ok(F.CIDO_FICHA_POLICIA);
      if (url.includes("cido.diba.cat/oposicions/")) return ok("<html><h2>x</h2>Termini obert</html>");
      if (url.includes("tmb.cat")) return ok(F.TMB_HTML);
      if (url.includes("exp.host")) { pushes.push(JSON.parse(String(init?.body))); return ok(JSON.stringify({ data: [{ status: "ok" }] }), "application/json"); }
      throw new Error("fetch no esperado: " + url);
    }) as typeof fetch;

    const env = { DB, ASSETS: { fetch: async () => new Response("web") }, APP_TOKEN: "secreto", ENRICH_BUDGET: "35" } as never;
    DB.raw.run("INSERT INTO devices (token, platform, creado) VALUES ('ExponentPushToken[abc]', 'ios', '2026-10-08')");
    DB.raw.run(`INSERT INTO alertas (id, nombre, filtros, activa, creada) VALUES ('a1', 'Policía y agent cívic', '${JSON.stringify({ zonas: ["Barcelona", "Maresme", "Badalona"], tipos: ["seguridad"], soloAbiertas: true })}', 1, '2026-10-08')`);

    const r1 = await ciclo(env, { forzarRecogida: true });
    // BOE: 3 (Badalona se omite porque Cataluña llega por el CIDO) + CIDO: 4 + TMB: 1
    expect(r1.recogidas).toBe(8);
    expect(r1.completadas).toBe(7); // TMB ya viene completo
    expect(r1.errores).toEqual([]);
    expect(pushes).toHaveLength(1);
    const msg = (pushes[0] as Array<{ title: string; body: string; to: string }>)[0];
    expect(msg.to).toBe("ExponentPushToken[abc]");
    expect(msg.title).toBe("2 plazas nuevas · Policía y agent cívic");
    expect(msg.body).toContain("Agent de Policia Local");

    // Segunda ejecución: nada nuevo, ningún aviso repetido
    const r2 = await ciclo(env, { forzarRecogida: true });
    expect(r2.recogidas).toBe(0);
    expect(pushes).toHaveLength(1);

    // API pública: cualquiera ve las plazas; las marcas necesitan cuenta
    const call = (path: string, init?: RequestInit) => worker.fetch(new Request("https://x" + path, init), env);
    const l = await (await call("/api/ofertas?comunidad=Cataluña&tipo=seguridad")).json() as { total: number; items: Array<{ id: string; marca: string; detalle_url?: string }> };
    expect(l.items.map((i) => i.id).sort()).toEqual(["cido:22173139", "cido:22300001"]);
    expect(l.items[0].marca).toBe("nueva");
    expect(l.items[0].detalle_url).toBeUndefined();
    const facil = await (await call("/api/ofertas?dificultad=1")).json() as { items: Array<{ id: string }> };
    expect(facil.items.map((i) => i.id)).toContain("cido:22173139");
    const madrid = await (await call("/api/ofertas?comunidad=Madrid")).json() as { items: Array<{ municipio: string; grupo: string }> };
    expect(madrid.items[0]).toMatchObject({ municipio: "Alcobendas", grupo: "C1" });
    expect((await call("/api/ofertas/cido%3A22173139", { method: "PATCH", body: JSON.stringify({ marca: "interesa" }) })).status).toBe(401);
    expect((await call("/api/alertas")).status).toBe(401);
    expect((await call("/api/estado")).status).toBe(200);
    const web = await worker.fetch(new Request("https://x/"), env);
    expect(await web.text()).toBe("web");
  });
});

describe("modo Pages", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });
  test("clave en D1, vista panel, revisión sin clave con freno y avisos pendientes", async () => {
    const DB = fakeD1();
    DB.raw.run("INSERT INTO meta (k, v) VALUES ('app_token', 'clave-d1')");
    DB.raw.run(`INSERT INTO alertas (id, nombre, filtros, activa, creada) VALUES ('a1', 'Policía Cataluña', '${JSON.stringify({ comunidades: ["Cataluña"], tipos: ["seguridad"], soloAbiertas: true })}', 1, 'x')`);
    globalThis.fetch = (async (input: RequestInfo) => {
      const url = String(input);
      const ok = (b: string) => new Response(b);
      if (url.includes("sumario")) return new Response("", { status: 404 });
      if (url.includes("cido.diba.cat/rss")) return ok(F.CIDO_RSS);
      if (url.includes("/oposicions/22173139")) return ok(F.CIDO_FICHA_CIVIC);
      if (url.includes("/oposicions/22300001")) return ok(F.CIDO_FICHA_POLICIA);
      if (url.includes("cido.diba.cat/oposicions/")) return ok("<html><h2>x</h2>Termini obert</html>");
      if (url.includes("tmb.cat")) return ok("<html></html>");
      throw new Error("fetch no esperado " + url);
    }) as typeof fetch;
    const env = { DB, ASSETS: { fetch: async () => new Response("web") } } as never;
    const r1 = await worker.fetch(new Request("https://x/api/run", { method: "POST" }), env);
    expect(r1.status).toBe(200);
    const r2 = await worker.fetch(new Request("https://x/api/run", { method: "POST" }), env);
    expect(r2.status).toBe(429);
    const pend = JSON.parse((DB.raw.query("SELECT v FROM meta WHERE k='avisos_pendientes'").get() as { v: string }).v);
    expect(pend).toHaveLength(1);
    expect(pend[0].title).toBe("2 plazas nuevas · Policía Cataluña");
    const p = await (await worker.fetch(new Request("https://x/api/ofertas?vista=panel"), env)).json() as { total: number };
    expect(p.total).toBe(4);
  });
});

describe("cuentas por correo", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  test("registro con código, marcas y alertas propias, clave de admin, contacto, avisos por correo, baja y borrado", async () => {
    const DB = fakeD1();
    DB.raw.run("INSERT INTO meta (k, v) VALUES ('app_token', 'clave-vieja')");
    DB.raw.run(`INSERT INTO alertas (id, nombre, filtros, activa, creada) VALUES ('vieja', 'Policía Cataluña', '${JSON.stringify({ comunidades: ["Cataluña"], tipos: ["seguridad"], soloAbiertas: true })}', 1, 'x')`);
    const correos: Array<{ to: string[]; subject: string; text: string; reply_to: string; headers?: Record<string, string> }> = [];
    globalThis.fetch = (async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const ok = (b: string) => new Response(b);
      if (url.includes("api.resend.com")) { correos.push(JSON.parse(String(init?.body))); return ok("{}"); }
      if (url.includes("sumario")) return new Response("", { status: 404 });
      if (url.includes("cido.diba.cat/rss")) return ok(F.CIDO_RSS);
      if (url.includes("/oposicions/22173139")) return ok(F.CIDO_FICHA_CIVIC);
      if (url.includes("/oposicions/22300001")) return ok(F.CIDO_FICHA_POLICIA);
      if (url.includes("cido.diba.cat/oposicions/")) return ok("<html><h2>x</h2>Termini obert</html>");
      if (url.includes("tmb.cat")) return ok("<html></html>");
      throw new Error("fetch no esperado " + url);
    }) as typeof fetch;
    const env = { DB, ASSETS: { fetch: async () => new Response("web") }, RESEND_API_KEY: "re_test", ALERTAS_GRATIS: "2" } as never;
    const call = async (path: string, init: RequestInit & { token?: string } = {}) => {
      const r = await worker.fetch(new Request("https://x/api" + path, { ...init, headers: { "Content-Type": "application/json", ...(init.token ? { Authorization: "Bearer " + init.token } : {}) } }), env);
      return { status: r.status, body: await r.json().catch(() => null) as Record<string, any> };
    };
    const entrar = async (email: string, extra: Record<string, unknown> = {}) => {
      expect((await call("/auth/start", { method: "POST", body: JSON.stringify({ email }) })).status).toBe(200);
      const code = correos.at(-1)!.text.match(/\d{6}/)![0];
      return call("/auth/verify", { method: "POST", body: JSON.stringify({ email, code, ...extra }) });
    };

    // Correo mal escrito y espera entre códigos
    expect((await call("/auth/start", { method: "POST", body: JSON.stringify({ email: "nope" }) })).status).toBe(400);
    // Usuario nuevo: tiene que aceptar las condiciones
    const sinAceptar = await entrar("Ana@Ejemplo.com");
    expect(sinAceptar.status).toBe(400);
    expect((await call("/auth/start", { method: "POST", body: JSON.stringify({ email: "ana@ejemplo.com" }) })).status).toBe(429);
    DB.raw.run("UPDATE otp SET enviado = 0");
    const ana = await entrar("ana@ejemplo.com", { acepta: true });
    expect(ana.status).toBe(200);
    const tAna = ana.body.token as string;
    expect(ana.body.admin).toBe(false);
    // Código incorrecto
    DB.raw.run("UPDATE otp SET enviado = 0");
    await call("/auth/start", { method: "POST", body: JSON.stringify({ email: "ana@ejemplo.com" }) });
    expect((await call("/auth/verify", { method: "POST", body: JSON.stringify({ email: "ana@ejemplo.com", code: "000000" }) })).status).toBe(400);

    // Ana no ve la alerta antigua; crea las suyas hasta el límite gratuito
    expect((await call("/alertas", { token: tAna })).body).toEqual([]);
    const f = { comunidades: ["Cataluña"], tipos: ["seguridad"], soloAbiertas: true };
    expect((await call("/alertas", { method: "POST", token: tAna, body: JSON.stringify({ nombre: "Policía", filtros: f }) })).status).toBe(201);
    expect((await call("/alertas", { method: "POST", token: tAna, body: JSON.stringify({ nombre: "Otra", filtros: { tipos: ["transporte"] } }) })).status).toBe(201);
    expect((await call("/alertas", { method: "POST", token: tAna, body: JSON.stringify({ nombre: "Tercera", filtros: {} }) })).status).toBe(403);
    const cuenta = await call("/cuenta", { token: tAna });
    expect(cuenta.body).toMatchObject({ email: "ana@ejemplo.com", alertas: 2, limite_alertas: 2, avisos_email: true });

    // El administrador entra con la clave antigua y recupera la alerta sin dueño
    DB.raw.run("INSERT INTO ofertas (id, fuente, titulo, encontrada, marca, notificada, detalle_ok) VALUES ('cido:1', 'CIDO', 'Vieja', '2026-01-01', 'presentada', 1, 1)");
    const adm = await entrar("jefe@ejemplo.com", { acepta: true, clave: "clave-vieja" });
    expect(adm.body.admin).toBe(true);
    const tAdm = adm.body.token as string;
    expect((await call("/alertas", { token: tAdm })).body.map((a: { id: string }) => a.id)).toEqual(["vieja"]);
    const panel = await call("/ofertas", { token: tAdm });
    expect(panel.body.items.find((o: { id: string }) => o.id === "cido:1")?.marca).toBe("presentada");
    expect((await call("/admin/resumen", { token: tAna })).status).toBe(403);

    // Ciclo: Ana recibe un correo con sus plazas; el administrador, además, el aviso pendiente para el móvil
    const antes = correos.length;
    const r = await ciclo(env, { forzarRecogida: true });
    expect(r.errores).toEqual([]);
    const nuevos = correos.slice(antes);
    expect(nuevos.map((c) => c.to[0]).sort()).toEqual(["ana@ejemplo.com", "jefe@ejemplo.com"]);
    const deAna = nuevos.find((c) => c.to[0] === "ana@ejemplo.com")!;
    expect(deAna.subject).toBe("2 plazas nuevas para tus alertas · Radar de Plazas");
    expect(deAna.text).toContain("Agent de Policia Local");
    expect(deAna.headers?.["List-Unsubscribe"]).toContain("/api/baja?u=");
    const pend = JSON.parse((DB.raw.query("SELECT v FROM meta WHERE k='avisos_pendientes'").get() as { v: string }).v);
    expect(pend.map((p: { title: string }) => p.title)).toEqual(["2 plazas nuevas · Policía Cataluña"]);

    // Marcas propias
    expect((await call("/ofertas/cido%3A22173139", { method: "PATCH", token: tAna, body: JSON.stringify({ marca: "interesa" }) })).status).toBe(200);
    const deAnaPanel = await call("/ofertas", { token: tAna });
    expect(deAnaPanel.body.items.find((o: { id: string }) => o.id === "cido:22173139").marca).toBe("interesa");
    const anon = await call("/ofertas");
    expect(anon.body.items.find((o: { id: string }) => o.id === "cido:22173139").marca).toBe("nueva");

    // Baja con el enlace del correo
    const baja = new URL(deAna.headers!["List-Unsubscribe"].slice(1, -1));
    expect((await worker.fetch(new Request("https://x" + baja.pathname + baja.search), env)).status).toBe(200);
    expect((await call("/cuenta", { token: tAna })).body.avisos_email).toBe(false);
    expect((await worker.fetch(new Request("https://x/api/baja?u=" + baja.searchParams.get("u") + "&t=mal"), env)).status).toBe(400);

    // Contacto
    expect((await call("/contacto", { method: "POST", body: JSON.stringify({ nombre: "Ana", email: "ana@ejemplo.com", mensaje: "corto" , acepta: true}) })).status).toBe(400);
    expect((await call("/contacto", { method: "POST", body: JSON.stringify({ nombre: "Ana", email: "ana@ejemplo.com", mensaje: "Hola, ¿cubrís también Valencia?", acepta: true }) })).status).toBe(200);
    expect(correos.at(-1)!.to[0]).toBe("hola@radaropos.com");
    expect(correos.at(-1)!.reply_to).toBe("ana@ejemplo.com");
    const res = await call("/admin/resumen", { token: tAdm });
    expect(res.body).toMatchObject({ usuarios: 2, sinLeer: 1 });

    // Exportar y borrar la cuenta
    const datos = await worker.fetch(new Request("https://x/api/cuenta/datos", { headers: { Authorization: "Bearer " + tAna } }), env);
    expect(((await datos.json()) as { alertas: unknown[] }).alertas).toHaveLength(2);
    expect((await call("/cuenta", { method: "DELETE", token: tAna })).status).toBe(200);
    expect((await call("/cuenta", { token: tAna })).status).toBe(401);
    expect(DB.raw.query("SELECT COUNT(*) AS n FROM alertas WHERE uid IS NOT NULL").get()).toEqual({ n: 1 });
    expect(DB.raw.query("SELECT COUNT(*) AS n FROM marcas").get()).toEqual({ n: 1 });
  });
});
