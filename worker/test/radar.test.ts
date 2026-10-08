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
    expect(deAna.subject).toBe("2 plazas nuevas: Policía");
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

describe("sectores y requisitos", () => {
  test("sector y subcategoría", async () => {
    const { clasificar } = await import("../src/sectores");
    const c = (t: string) => { const r = clasificar(t); return `${r.tipo}/${r.subtipo}`; };
    expect(c("3 places d'Agent de Policia Local")).toBe("seguridad/policia-local");
    expect(c("Borsa de treball de places d'Agent cívic")).toBe("seguridad/agente-civico");
    expect(c("1 plaça d'Auxiliar de policia - vigilant")).toBe("seguridad/vigilante");
    expect(c("Resolución por la que se convocan pruebas selectivas para ingreso en el Cuerpo de Tramitación Procesal y Administrativa")).toBe("justicia/tramitacion");
    expect(c("Borsa de treball de TCAE")).toBe("sanidad/tcae");
    expect(c("2 places d'Educador/a infantil per a l'escola bressol")).toBe("educacion/educador-infantil");
    expect(c("2 places d'Auxiliar administratiu")).toBe("administrativo/aux-administrativo");
    expect(c("2 places de Peó de brigada")).toBe("oficios/brigada");
    expect(c("1 plaça de Tècnic/a informàtic")).toBe("tecnico/informatica");
    expect(c("Convocatoria de Bombero/a")).toBe("seguridad/bomberos");
    expect(c("Algo raro")).toBe("otros/null");
  });
  test("requisitos en catalán", async () => {
    const { requisitosDe, nivelDeTitulacion } = await import("../src/sectores");
    const r = requisitosDe(`Requisits: Tenir complerts setze anys. Estar en possessió del permís de conducció de classe B i A2.
      Acreditar el certificat de nivell C1 de català. Alçada mínima d'1,65. La nacionalitat espanyola.
      Proves: qüestionari tipus test, proves físiques i psicotècniques, entrevista i revisió mèdica. Drets d'examen: 25,50 euros.`, "Batxillerat o tècnic");
    expect(r).toMatchObject({ titulacion: "Batxillerat o tècnic", edadMin: 16, carne: ["B", "A2"], catalan: "C1", altura: true, nacionalidad: "es", tasa: 25.5 });
    expect(r.pruebas).toEqual(["test", "fisica", "psicotecnico", "entrevista", "medico"]);
    expect(nivelDeTitulacion("Batxillerat o tècnic")).toBe(2);
    expect(nivelDeTitulacion("Graduat en educació secundària obligatòria (ESO)")).toBe(1);
    expect(nivelDeTitulacion("Grau universitari en dret")).toBe(4);
  });
  test("filtro por subcategoría y nivel", () => {
    const o = { id: "x", fuente: "CIDO", titulo: "Policia", tipo: "seguridad", subtipo: "policia-local", nivel: 2 } as never;
    expect(coincide(o, { tipos: ["seguridad"], subtipos: ["policia-local"] }, "2026-10-08")).toBe(true);
    expect(coincide(o, { tipos: ["seguridad"], subtipos: ["bomberos"] }, "2026-10-08")).toBe(false);
    expect(coincide(o, { tipos: ["seguridad", "sanidad"], subtipos: ["tcae"] }, "2026-10-08")).toBe(true);
    expect(coincide(o, { nivelMax: 1 }, "2026-10-08")).toBe(false);
    expect(coincide(o, { nivelMax: 2 }, "2026-10-08")).toBe(true);
  });
});

describe("fichas, sectores, calendario, IA, Telegram y avisos nuevos", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });
  test("todo junto", async () => {
    const { describirCambio } = await import("../src/run");
    const DB = fakeD1();
    const correos: Array<{ to: string[]; subject: string; text: string }> = [];
    const tg: Array<{ chat_id: string; text: string }> = [];
    globalThis.fetch = (async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const ok = (b: string) => new Response(b);
      if (url.includes("api.resend.com")) { correos.push(JSON.parse(String(init?.body))); return ok("{}"); }
      if (url.includes("api.telegram.org")) { tg.push(JSON.parse(String(init?.body))); return ok("{}"); }
      if (url.includes("sumario")) return new Response("", { status: 404 });
      if (url.includes("cido.diba.cat/rss")) return ok(F.CIDO_RSS);
      if (url.includes("/oposicions/22173139")) return ok(F.CIDO_FICHA_CIVIC);
      if (url.includes("/oposicions/22300001")) return ok(F.CIDO_FICHA_POLICIA);
      if (url.includes("cido.diba.cat/oposicions/")) return ok("<html><h2>x</h2>Termini obert</html>");
      if (url.includes("tmb.cat")) return ok("<html></html>");
      throw new Error("fetch no esperado " + url);
    }) as typeof fetch;
    const ia: unknown[] = [];
    const env = { DB, ASSETS: { fetch: async () => new Response("web") }, RESEND_API_KEY: "re", TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_BOT: "RadarPlazasBot",
      AI: { run: async (_m: string, input: unknown) => { ia.push(input); return { response: "• Puesto: agente cívico\n• Plazo: consta en la ficha" }; } } } as never;
    const call = async (path: string, init: RequestInit & { token?: string } = {}) => {
      const r = await worker.fetch(new Request("https://x" + path, { ...init, headers: { "Content-Type": "application/json", ...(init.token ? { Authorization: "Bearer " + init.token } : {}), ...((init.headers as Record<string, string>) || {}) } }), env);
      return r;
    };
    await ciclo(env, { forzarRecogida: true });
    const civic = DB.raw.query("SELECT * FROM ofertas WHERE id = 'cido:22173139'").get() as Record<string, unknown>;
    expect(civic.tipo).toBe("seguridad");
    expect(civic.subtipo).toBe("agente-civico");
    expect(typeof civic.requisitos).toBe("string");

    // Ficha pública con datos estructurados para Google
    const ficha = await call("/plaza/cido/22173139/agent-civic");
    expect(ficha.status).toBe(200);
    const html = await ficha.text();
    expect(html).toContain('"@type":"JobPosting"');
    expect(html).toContain("Seguir esta plaza");
    expect((await call("/plaza/cido/999/nada")).status).toBe(404);
    // Sectores y lugares
    const sec = await (await call("/oposiciones/seguridad")).text();
    expect(sec).toContain("Seguridad y emergencias");
    expect(sec).toContain("/plaza/cido/22173139/");
    expect((await call("/oposiciones/agente-civico/cataluna")).status).toBe(200);
    expect((await call("/oposiciones/inventado")).status).toBe(404);
    expect(await (await call("/oposiciones")).text()).toContain("Policía local");
    const sm = await (await call("/sitemap.xml")).text();
    expect(sm).toContain("/plaza/cido/22173139/");
    expect(sm).toContain("/oposiciones/seguridad/cataluna");
    // Calendario
    const ics = await (await call("/api/ics/cido/22173139")).text();
    expect(ics).toContain("BEGIN:VEVENT");
    // Estadísticas
    const st = await (await call("/api/estadisticas")).json() as { abiertas: number; sectores: Array<{ k: string }> };
    expect(st.abiertas).toBeGreaterThan(0);
    expect(st.sectores[0].k).toBe("seguridad");
    // IA: resumen público que se guarda
    const r1 = await (await call("/api/ia/resumen/cido/22173139")).json() as { resumen: string };
    expect(r1.resumen).toContain("agente cívico");
    expect(((await (await call("/api/ia/resumen/cido/22173139")).json()) as { guardado: boolean }).guardado).toBe(true);
    expect(ia).toHaveLength(1);

    // Cuenta: perfil, frecuencia, boletín, calendario, notas y Telegram
    await call("/api/auth/start", { method: "POST", body: JSON.stringify({ email: "eva@ejemplo.com" }) });
    const code = correos.at(-1)!.text.match(/\d{6}/)![0];
    const tok = ((await (await call("/api/auth/verify", { method: "POST", body: JSON.stringify({ email: "eva@ejemplo.com", code, acepta: true }) })).json()) as { token: string }).token;
    expect((await call("/api/cuenta", { method: "PATCH", token: tok, body: JSON.stringify({ perfil: { nivel: 2, edad: 30, carne: ["B"], catalan: "C1" }, frecuencia: "semanal", boletin: true }) })).status).toBe(200);
    const cuenta = await (await call("/api/cuenta", { token: tok })).json() as Record<string, any>;
    expect(cuenta).toMatchObject({ frecuencia: "semanal", boletin: true, perfil: { nivel: 2 }, ia: true });
    expect(cuenta.telegram_url).toMatch(/^https:\/\/t\.me\/RadarPlazasBot\?start=[a-f0-9]+_[a-f0-9]{12}$/);
    const cal = await (await call("/api/cuenta/calendario", { method: "POST", token: tok })).json() as { url: string };
    // Seguir una plaza con notas y documentos; aparece en el calendario suscrito
    DB.raw.run("UPDATE ofertas SET plazo_fin = date('now', '+2 days') WHERE id = 'cido:22173139'");
    expect((await call("/api/ofertas/cido%3A22173139", { method: "PATCH", token: tok, body: JSON.stringify({ marca: "interesa", notas: "Llevar DNI", docs: { dni: true } }) })).status).toBe(200);
    const mia = (await (await call("/api/ofertas", { token: tok })).json() as { items: Array<Record<string, any>> }).items.find((o) => o.id === "cido:22173139")!;
    expect(mia).toMatchObject({ marca: "interesa", notas: "Llevar DNI", docs: { dni: true } });
    expect(mia.ruta).toBe("/plaza/cido/22173139/" + mia.ruta.split("/").pop());
    const feed = await (await call(new URL(cal.url).pathname)).text();
    expect(feed).toContain("SUMMARY:Cierra plazo");
    // IA: preguntas con cuenta
    const pr = await (await call("/api/ia/pregunta", { method: "POST", token: tok, body: JSON.stringify({ id: "cido:22173139", pregunta: "¿Puedo con la ESO?" }) })).json() as { respuesta: string };
    expect(pr.respuesta.length).toBeGreaterThan(5);
    expect((await call("/api/ia/pregunta", { method: "POST", body: JSON.stringify({ id: "cido:22173139", pregunta: "x" }) })).status).toBe(401);
    // Telegram: vincular con el enlace de Mi cuenta
    const start = new URL(cuenta.telegram_url).searchParams.get("start")!;
    const { sha256 } = await import("../src/cuentas");
    const secret = (await sha256("tg:123:abc")).slice(0, 32);
    expect((await call("/api/telegram/webhook", { method: "POST", body: JSON.stringify({ message: { chat: { id: 555 }, text: "/start " + start } }) })).status).toBe(403);
    await call("/api/telegram/webhook", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": secret }, body: JSON.stringify({ message: { chat: { id: 555 }, text: "/start " + start } }) });
    expect((DB.raw.query("SELECT telegram FROM users WHERE email = 'eva@ejemplo.com'").get() as { telegram: string }).telegram).toBe("555");
    expect(tg.at(-1)!.text).toContain("Listo");

    // Recordatorio de plazo (correo + Telegram) una sola vez
    const antes = correos.length;
    await ciclo(env, { forzarRecogida: true });
    const rec = correos.slice(antes).filter((c) => c.subject.startsWith("⏰"));
    expect(rec).toHaveLength(1);
    expect(tg.some((m) => m.text.includes("Cierran pronto"))).toBe(true);
    const n = correos.length;
    await ciclo(env, { forzarRecogida: true });
    expect(correos.slice(n).filter((c) => c.subject.startsWith("⏰"))).toHaveLength(0);

    // Resumen semanal y boletín
    DB.raw.run(`INSERT INTO alertas (id, nombre, filtros, activa, creada, uid) SELECT 'ae', 'Seguridad', '${JSON.stringify({ tipos: ["seguridad"] })}', 1, 'x', id FROM users WHERE email = 'eva@ejemplo.com'`);
    const m = correos.length;
    await ciclo(env, { forzarSemanal: true });
    const subj = correos.slice(m).map((c) => c.subject);
    expect(subj.some((s) => s.startsWith("Resumen semanal"))).toBe(true);
    expect(subj.some((s) => s.startsWith("Boletín semanal"))).toBe(true);

    // Cambios en una ficha
    expect(describirCambio({ plazo_fin: "2026-10-20", estado: "abierta" } as never, { plazo_fin: "2026-10-30", estado: "abierta" })).toBe("nuevo plazo: hasta el 30/10/2026 (antes 20/10/2026)");
    expect(describirCambio({ plazo_fin: null, estado: "pendiente" } as never, { plazo_fin: null, estado: "abierta" })).toBe("estado: plazo de solicitudes abierto");
  });
});

test("web/sectores.js está al día con src/sectores.ts", async () => {
  const { generar } = await import("../../scripts/gen-sectores");
  const { readFileSync } = await import("node:fs");
  expect(readFileSync(new URL("../../web/sectores.js", import.meta.url), "utf8")).toBe(generar());
});

describe("empresas de transporte", () => {
  test("lectores por empresa", async () => {
    const { EMPRESAS, ofertasEmpresa } = await import("../src/sources/transporte");
    const E = (id: string) => EMPRESAS.find((e) => e.id === id)!;
    const hoy = "2026-10-08", ahora = "2026-10-08T08:00:00Z";
    // EMT Madrid: la fecha del título decide si es reciente
    const emt = ofertasEmpresa(E("emtmadrid"), `<ul><li><a href="/Elementos-Cabecera/Enlaces-Pie-vertical/EMPRESA/Empleo/Convocatoria-3-plazas-Jefe-a-de-Operaciones-Servic.aspx">Convocatoria 3 plazas Jefe/a de Operaciones Servicio de Teleférico 28-09-2026</a></li>
      <li><a href="/Elementos-Cabecera/Enlaces-Pie-vertical/EMPRESA/Empleo/Convocatoria-plazas-Personal-de-Conduccion.aspx">Convocatoria plazas Personal de Conducción de autobús en línea 21-04-2026</a></li></ul>`, hoy, ahora);
    expect(emt).toHaveLength(1);
    expect(emt[0]).toMatchObject({ organismo: "EMT Madrid", comunidad: "Madrid", provincia: "Madrid", tipo: "transporte", plazas: 3, fuente: "EMPRESA" });
    expect(emt[0].url).toBe("https://www.emtmadrid.es/Elementos-Cabecera/Enlaces-Pie-vertical/EMPRESA/Empleo/Convocatoria-3-plazas-Jefe-a-de-Operaciones-Servic.aspx");
    // FGC: plazo junto a la oferta
    const fgc = ofertasEmpresa(E("fgc"), `<tr><td><a href="/job/Barcelona%C2%A0-Maquinistes-d&apos;FGC-Mobilitat/1374338657/">Maquinistes d'FGC Mobilitat</a></td><td>Barcelona</td><td>18/10/2026</td></tr>`, hoy, ahora);
    expect(fgc[0]).toMatchObject({ titulo: "Maquinistes d'FGC Mobilitat", plazo_fin: "2026-10-18", subtipo: "metro-tren", comunidad: "Cataluña" });
    // Dbus: solo [ABIERTA]
    const dbus = ofertasEmpresa(E("dbus"), `<h2><a href="https://dbus.eus/es/seleccion-de-personal/abierta-bolsa-mecanico/">[ABIERTA] Bolsa de Trabajo: Mecánico/a-electricista polivalente</a></h2><h2><a href="https://dbus.eus/es/seleccion-de-personal/abierta-bolsa-limpieza/">[CERRADA] Bolsa de Trabajo: Limpieza-Repostaje</a></h2>`, hoy, ahora);
    expect(dbus.map((o) => o.titulo)).toEqual(["Bolsa de Trabajo: Mecánico/a-electricista polivalente"]);
    expect(dbus[0]).toMatchObject({ sistema: "bolsa", subtipo: "otros-transporte" });
    // Guaguas: título del encabezado, plazo «del … al …», concluidas fuera
    const gu = ofertasEmpresa(E("guaguas"), `<h2>CONVOCATORIA SELECCION TÉCNICO/A DE COMPRAS</h2><p>Convocatoria: del 01/10/2026 al 20/10/2026</p><a href="/ofertas_trabajo/bases_37.pdf">Bases</a>
      <h2>CONVOCATORIA BOLSA CONDUCTORES (CONCLUIDA)</h2><p>Convocatoria: del 01/01/2026 al 20/01/2026</p><a href="/ofertas_trabajo/bases_30.pdf">Bases</a>`, hoy, ahora);
    expect(gu).toHaveLength(1);
    expect(gu[0]).toMatchObject({ titulo: "CONVOCATORIA SELECCION TÉCNICO/A DE COMPRAS", plazo_fin: "2026-10-20" });
    // Metro Bilbao (JSON:API de Drupal)
    const mb = ofertasEmpresa(E("metrobilbao"), JSON.stringify({ data: [{ attributes: { title: "Proceso externo de selección de personal", created: "2026-09-18T10:00:00+00:00", drupal_internal__nid: 20493, body: { summary: "Ingeniería de datos", value: "<p>Plazo hasta el 30/10/2026</p>" } } },
      { attributes: { title: "Proceso externo de selección de personal", created: "2025-01-18T10:00:00+00:00", drupal_internal__nid: 100, body: { value: "<p>viejo</p>" } } }] }), hoy, ahora);
    expect(mb).toHaveLength(1);
    expect(mb[0]).toMatchObject({ titulo: "Proceso externo de selección de personal: Ingeniería de datos", url: "https://cms.metrobilbao.eus/es/node/20493", plazo_fin: "2026-10-30" });
    // ATM: solo la sección «en curso»
    const atm = ofertasEmpresa(E("atm"), `<h2>Ofertes d'ocupació en curs</h2><h3>Tècnic/a Superior en Contractació Pública (TSCON)</h3><a href="/documents/d/portal-atm/08-20261005_anuncidogc_tscon">Anunci DOGC</a><h2>Ofertes d'ocupació resoltes</h2><h3>Antiga</h3><a href="/documents/d/portal-atm/01-2020_x">Anunci</a>`, hoy, ahora);
    expect(atm.map((o) => o.titulo)).toEqual(["Anunci DOGC"].length ? ["Tècnic/a Superior en Contractació Pública (TSCON)"] : []);
    // AUVASA: PDFs recientes por la fecha de subida
    const au = ofertasEmpresa(E("auvasa"), `<h3>CONVOCATORIA PARA LA CONTRATACIÓN DE 3 AGENTES DE APARCAMIENTO</h3><a href="https://www.auvasa.es/wp-content/uploads/2026/08/convocatoria_oe01_2026_01.pdf">BASES DE LA CONVOCATORIA.</a>
      <a href="https://www.auvasa.es/wp-content/uploads/2026/09/convocatoria_oe01_2026_03.pdf">ACTA FASE PRIMERA – LISTADO PROVISIONAL</a>
      <h3>VIEJA CONVOCATORIA DE CONDUCTORES</h3><a href="https://www.auvasa.es/wp-content/uploads/2025/04/Convocatoria_oe02_2025.pdf">BASES DE LA CONVOCATORIA.</a>`, hoy, ahora);
    expect(au.map((o) => [o.titulo, o.publicado])).toEqual([["CONVOCATORIA PARA LA CONTRATACIÓN DE 3 AGENTES DE APARCAMIENTO", "2026-08-01"]]);
    // Entidades HTML con acento y títulos repetidos
    const tg = ofertasEmpresa(E("tusgsal"), `<h3>MEC&Agrave;NIC/A (TORN DE DIA)</h3><a href="https://direxis.es/ofertes/mecanic/">Veure oferta</a><h3>MEC&Agrave;NIC/A (TORN DE DIA)</h3><a href="https://direxis.es/ofertes/mecanic-2/">Veure oferta</a>`, hoy, ahora);
    expect(tg.map((o) => o.titulo)).toEqual(["MECÀNIC/A (TORN DE DIA)"]);
  });
});

describe("ubicación y tutor", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });
  test("código postal, radio en km y tutor con plazas cercanas", async () => {
    const DB = fakeD1();
    const correos: Array<{ text: string }> = [], ia: Array<{ messages: Array<{ role: string; content: string }> }> = [];
    let nominatim = 0;
    globalThis.fetch = (async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("api.resend.com")) { correos.push(JSON.parse(String(init?.body))); return new Response("{}"); }
      if (url.includes("nominatim")) { nominatim++; return new Response(JSON.stringify([{ lat: "41.5381", lon: "2.4447", address: { city: "Mataró" } }])); }
      throw new Error("fetch no esperado " + url);
    }) as typeof fetch;
    const env = { DB, ASSETS: { fetch: async () => new Response("web") }, RESEND_API_KEY: "re",
      AI: { run: async (_m: string, input: never) => { ia.push(input); return { response: "Te propongo empezar por [Agente cívico en Mataró](/plaza/cido/1/agent-civic)." }; } } } as never;
    const ins = (id: string, titulo: string, muni: string, lat: number, lon: number, tipo = "seguridad", nivel = 1) =>
      DB.raw.run(`INSERT INTO ofertas (id, fuente, titulo, organismo, municipio, comunidad, tipo, nivel, lat, lon, encontrada, detalle_ok, notificada, dificultad) VALUES ('${id}', 'CIDO', '${titulo}', 'Ajuntament', '${muni}', 'Cataluña', '${tipo}', ${nivel}, ${lat}, ${lon}, '2026-10-08', 1, 1, 1)`);
    ins("cido:1", "Borsa d agents cívics", "Mataró", 41.54, 2.44);
    ins("cido:2", "Agent de policia local", "Lleida", 41.61, 0.62, "seguridad", 2);
    ins("cido:3", "Tècnic superior", "Mataró", 41.54, 2.44, "tecnico", 4);
    const call = async (path: string, init: RequestInit & { token?: string } = {}) => {
      const r = await worker.fetch(new Request("https://x/api" + path, { ...init, headers: { "Content-Type": "application/json", ...(init.token ? { Authorization: "Bearer " + init.token } : {}) } }), env);
      return { status: r.status, body: await r.json() as Record<string, any> };
    };
    // Código postal → punto (con caché)
    const cp = await call("/cp/08301");
    expect(cp.body).toMatchObject({ cp: "08301", provincia: "Barcelona", lugar: "Mataró", lat: 41.5381, aprox: false });
    await call("/cp/08301");
    expect(nominatim).toBe(1);
    expect((await call("/cp/99999")).status).toBe(404);
    // Radio en km en la API
    const cerca = await call("/ofertas?lat=41.5381&lon=2.4447&km=30");
    expect(cerca.body.items.map((o: { id: string }) => o.id).sort()).toEqual(["cido:1", "cido:3"]);
    // Tutor: necesita cuenta; usa perfil, gustos y plazas cercanas a su nivel
    expect((await call("/ia/tutor", { method: "POST", body: "{}" })).status).toBe(401);
    await call("/auth/start", { method: "POST", body: JSON.stringify({ email: "leo@ejemplo.com" }) });
    const code = correos.at(-1)!.text.match(/\d{6}/)![0];
    const tok = (await call("/auth/verify", { method: "POST", body: JSON.stringify({ email: "leo@ejemplo.com", code, acepta: true }) })).body.token;
    const perfil = { nivel: 1, prefs: { intereses: ["seguridad"], prisa: "ya", horas: "5", movilidad: "30", cp: "08301", lugar: "Mataró", lat: 41.5381, lon: 2.4447 } };
    expect((await call("/cuenta", { method: "PATCH", token: tok, body: JSON.stringify({ perfil }) })).status).toBe(200);
    const t = await call("/ia/tutor", { method: "POST", token: tok, body: JSON.stringify({ mensajes: [{ rol: "user", texto: "¿Por dónde empiezo?" }] }) });
    expect(t.status).toBe(200);
    expect(t.body.respuesta).toContain("/plaza/cido/1/");
    expect(t.body.plazas).toBe(1); // Lleida queda lejos y el técnico superior pide carrera
    const sistema = ia[0].messages[0].content;
    expect(sistema).toContain("Le atraen: Seguridad y emergencias");
    expect(sistema).toContain("(a 0 km)");
    expect(sistema).not.toContain("Tècnic superior");
  });
});

describe("entrar con Google, nombre y ajustes sincronizados", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });
  test("token firmado de Google, enlace por correo, nombre y ajustes con hora", async () => {
    const DB = fakeD1();
    const par = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const jwk = (await crypto.subtle.exportKey("jwk", par.publicKey)) as JsonWebKey;
    globalThis.fetch = (async (input: RequestInfo) => {
      if (String(input).includes("googleapis.com/oauth2/v3/certs")) return new Response(JSON.stringify({ keys: [{ kid: "k1", kty: "RSA", n: jwk.n, e: jwk.e }] }));
      throw new Error("fetch no esperado " + input);
    }) as typeof fetch;
    const b64 = (x: string | Uint8Array) => Buffer.from(x).toString("base64url");
    const firmar = async (pl: Record<string, unknown>) => {
      const cab = b64(JSON.stringify({ alg: "RS256", kid: "k1" })), cue = b64(JSON.stringify(pl));
      const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", par.privateKey, new TextEncoder().encode(cab + "." + cue)));
      return `${cab}.${cue}.${b64(sig)}`;
    };
    const CID = "123-abc.apps.googleusercontent.com";
    const env = { DB, ASSETS: { fetch: async () => new Response("web") }, GOOGLE_CLIENT_IDS: CID } as never;
    const call = async (path: string, init: RequestInit & { token?: string } = {}) => {
      const r = await worker.fetch(new Request("https://x/api" + path, { ...init, headers: { "Content-Type": "application/json", ...(init.token ? { Authorization: "Bearer " + init.token } : {}) } }), env);
      return { status: r.status, body: (await r.json().catch(() => null)) as Record<string, any> };
    };
    expect((await call("/auth/config")).body.google).toBe(CID);
    const exp = Math.floor(Date.now() / 1000) + 600;
    const bueno = await firmar({ iss: "https://accounts.google.com", aud: CID, sub: "g-1", email: "Gabi@Gmail.com", email_verified: true, given_name: "Gabriel", exp });
    // Otro cliente o token manipulado: rechazado
    expect((await call("/auth/social", { method: "POST", body: JSON.stringify({ proveedor: "google", token: await firmar({ iss: "https://accounts.google.com", aud: "otro", sub: "g-1", email: "a@b.c", exp }), acepta: true }) })).status).toBe(401);
    expect((await call("/auth/social", { method: "POST", body: JSON.stringify({ proveedor: "google", token: bueno.slice(0, -4) + "AAAA", acepta: true }) })).status).toBe(401);
    // Nuevo: hay que aceptar las condiciones
    expect((await call("/auth/social", { method: "POST", body: JSON.stringify({ proveedor: "google", token: bueno }) })).body.acepta).toBe(false);
    const ok = await call("/auth/social", { method: "POST", body: JSON.stringify({ proveedor: "google", token: bueno, acepta: true }) });
    expect(ok.status).toBe(200);
    expect(ok.body.nuevo).toBe(true);
    const yo = await call("/cuenta", { token: ok.body.token });
    expect(yo.body).toMatchObject({ email: "gabi@gmail.com", nombre: "Gabriel", google: true });
    // Segundo dispositivo: misma cuenta
    const otra = await call("/auth/social", { method: "POST", body: JSON.stringify({ proveedor: "google", token: bueno }) });
    expect(otra.body.nuevo).toBe(false);
    // Nombre y ajustes: gana el cambio más reciente
    await call("/cuenta", { method: "PATCH", token: ok.body.token, body: JSON.stringify({ nombre: "Gabi <b>", ajustes: { t: 200, km: 25 } }) });
    const viejo = await call("/cuenta", { method: "PATCH", token: otra.body.token, body: JSON.stringify({ ajustes: { t: 100, km: 5 } }) });
    expect(viejo.body.ajustes.km).toBe(25);
    const y2 = await call("/cuenta", { token: otra.body.token });
    expect(y2.body.nombre).toBe("Gabi b");
    expect(y2.body.ajustes).toEqual({ t: 200, km: 25 });
  });
});
