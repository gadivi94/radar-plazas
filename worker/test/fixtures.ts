// Muestras con la misma estructura que las fuentes reales (contenido abreviado).

export const BOE_SUMARIO = {
  status: { code: "200", text: "ok" },
  data: {
    sumario: {
      metadatos: { publicacion: "BOE", fecha_publicacion: "20261008" },
      diario: [{
        numero: "245",
        seccion: [
          { codigo: "1", nombre: "I. Disposiciones generales", departamento: [] },
          {
            codigo: "2B", nombre: "II. Autoridades y personal. - B. Oposiciones y concursos",
            departamento: [
              {
                codigo: "1", nombre: "MINISTERIO DEL INTERIOR",
                epigrafe: [{ nombre: "Cuerpo de la Policía Nacional", item: {
                  identificador: "BOE-A-2026-20001",
                  titulo: "Resolución de 1 de octubre de 2026, de la Dirección General de la Policía, por la que se convoca oposición para el ingreso en la Escala Básica del Cuerpo de la Policía Nacional.",
                  url_pdf: { szBytes: "1", texto: "https://www.boe.es/boe/dias/2026/10/08/pdfs/BOE-A-2026-20001.pdf" },
                  url_html: "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-20001",
                  url_xml: "https://www.boe.es/diario_boe/xml.php?id=BOE-A-2026-20001",
                } }],
              },
              {
                codigo: "9", nombre: "ADMINISTRACIÓN LOCAL",
                epigrafe: [{ nombre: "Personal funcionario y laboral", item: [
                  {
                    identificador: "BOE-A-2026-20010",
                    titulo: "Resolución de 31 de agosto de 2026, del Ayuntamiento de Baza (Granada), referente a la convocatoria para proveer una plaza.",
                    url_html: "https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-20010",
                    url_xml: "https://www.boe.es/diario_boe/xml.php?id=BOE-A-2026-20010",
                  },
                  {
                    identificador: "BOE-A-2026-20011",
                    titulo: "Resolución de 2 de septiembre de 2026, del Ayuntamiento de Alcobendas (Madrid), referente a la convocatoria para proveer varias plazas de Agente de la Policía Local.",
                    url_xml: "https://www.boe.es/diario_boe/xml.php?id=BOE-A-2026-20011",
                  },
                  {
                    identificador: "BOE-A-2026-20012",
                    titulo: "Resolución de 3 de septiembre de 2026, del Ayuntamiento de Badalona (Barcelona), referente a la convocatoria para proveer varias plazas.",
                    url_xml: "https://www.boe.es/diario_boe/xml.php?id=BOE-A-2026-20012",
                  },
                ] }],
              },
            ],
          },
        ],
      }],
    },
  },
};

export const BOE_XML_BAZA = `<?xml version="1.0" encoding="UTF-8"?><documento><metadatos><identificador>BOE-A-2026-20010</identificador></metadatos>
<texto><p class="parrafo">En el «Boletín Oficial de la Provincia de Granada» número 167, de 31 de agosto de 2026, se han publicado íntegramente las bases que han de regir la convocatoria para proveer una plaza de Administrativo/a, perteneciente a la escala de Administración General, subescala Administrativa, mediante el sistema de oposición, turno libre.</p>
<p class="parrafo_2">El plazo de presentación de solicitudes será de veinte días hábiles a contar desde el día siguiente al de la publicación de este extracto en el «Boletín Oficial del Estado».</p></texto></documento>`;

export const BOE_XML_ALCOBENDAS = `<documento><texto><p>Se convocan 6 plazas de Agente de la Policía Local, Escala de Administración Especial, subescala Servicios Especiales, clase Policía Local, Grupo C, Subgrupo C1, mediante concurso-oposición libre.</p>
<p>El plazo de presentación de solicitudes será de 20 días naturales contados a partir del siguiente al de la publicación de este anuncio.</p></texto></documento>`;

export const CIDO_RSS = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>Processos selectius</title>
<item><title><![CDATA[Borsa de treball de places d'Agent cívic]]></title>
<description><![CDATA[<p><strong>Número de referència:</strong> 20260910O1</p><p><strong>Data de publicació:</strong> 08/10/2026</p><p><strong>Ens:</strong> Ajuntament de Barcelona - Barcelona de Serveis Municipals, SA</p>]]></description>
<link>http://cido.diba.cat/oposicions/22173139/borsa-de-treball-de-places-dagent-civic-ajuntament-de-barcelona-barcelona-de-serveis-municipals-sa</link><pubDate>Thu, 08 Oct 2026 08:33:19 +0200</pubDate></item>
<item><title><![CDATA[3 places d'Agent de Policia Local]]></title>
<description><![CDATA[<p><strong>Ens:</strong> Ajuntament de Mataró</p>]]></description>
<link>http://cido.diba.cat/oposicions/22300001/3-places-dagent-de-policia-local-ajuntament-de-mataro</link><pubDate>Thu, 08 Oct 2026 08:33:19 +0200</pubDate></item>
<item><title><![CDATA[1 plaça de Tècnic superior a la Direcció de Serveis (Barcelona)]]></title>
<description><![CDATA[<p><strong>Ens:</strong> Generalitat de Catalunya - Departament de Cultura</p>]]></description>
<link>http://cido.diba.cat/oposicions/22300002/1-placa-tecnic-superior</link><pubDate>Thu, 08 Oct 2026 08:33:19 +0200</pubDate></item>
<item><title><![CDATA[1 plaça de Subaltern a la Residència de Gent Gran del Mil·lenari (Barcelona)]]></title>
<description><![CDATA[<p><strong>Ens:</strong> Generalitat de Catalunya - Departament de Drets Socials i Inclusió</p>]]></description>
<link>http://cido.diba.cat/oposicions/22289444/1-placa-de-subaltern</link><pubDate>Tue, 06 Oct 2026 08:33:19 +0200</pubDate></item>
</channel></rss>`;

export const CIDO_FICHA_CIVIC = `<html><body><nav><a>Termini tancat</a><a>Termini obert</a></nav>
<div class="ens">Ajuntament de Barcelona - Barcelona de Serveis Municipals, SA</div>
<h2>Borsa de treball de places d'Agent cívic</h2>
<dl><dt>Identificador</dt><dd>20260910O1</dd>
<dt>Finalització de presentació de sol·licituds</dt><dd>10/04/2027</dd>
<dt>Sistema de selecció</dt><dd>Concurs o valoració de mèrits</dd>
<dt>Tipus de personal</dt><dd>Laboral temporal</dd>
<dt>Grup de titulació o assimilat</dt><dd>C2 - ESO, graduat escolar, FP 1r grau, cicles formatius grau mitjà</dd>
<dt>Titulació requerida</dt><dd>Educació Secundària Obligatòria</dd>
<dt>Accés al tràmit</dt><dd><a href="https://creix.bsmsa.cat/job/Borsa-Agent-Civica/1367851955/?a=1&amp;b=2">https://creix.bsmsa.cat/job/…</a></dd></dl>
<span class="estat">Termini obert</span></body></html>`;

export const CIDO_FICHA_POLICIA = `<html><body><h2>3 places d'Agent de Policia Local</h2>
<dl><dt>Termini</dt><dd>El termini s'obrirà... l'endemà de la publicació de la convocatòria al DOGC i serà de 20 dies naturals</dd>
<dt>Sistema de selecció</dt><dd>Concurs oposició o valoració de mèrits i prova</dd>
<dt>Tipus de personal</dt><dd>Funcionari</dd>
<dt>Grup de titulació o assimilat</dt><dd>C1 - Batxillerat, FP 2n grau, cicles formatius grau superior</dd></dl>
<span>Pendent de termini</span></body></html>`;

export const TMB_HTML = `<html><body><ul>
<li><a href="/ca/w/oferta-10210-borsa-personal-conduccio-bus-2027">10210 - Ampliació Borsa Personal Conducció Bus 2027</a><span>Inscripció: 01/10/2026 – 20/10/2026</span></li>
<li><a href="/ca/w/oferta-10194-agents-atencio-client-metro-2027">10194 - Ampliació Borsa d'Agents d'Atenció al Client Metro 2027</a><span>25/06/2026 – 08/07/2026</span></li>
</ul></body></html>`;
