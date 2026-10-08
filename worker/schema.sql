-- Radar de Plazas · esquema D1
CREATE TABLE IF NOT EXISTS ofertas (
  id            TEXT PRIMARY KEY,          -- boe:BOE-A-2026-1234 | cido:22173139 | tmb:10210
  fuente        TEXT NOT NULL,             -- BOE | CIDO | TMB
  titulo        TEXT NOT NULL,
  organismo     TEXT,
  municipio     TEXT,
  provincia     TEXT,
  comunidad     TEXT,                      -- "Cataluña", "Madrid"… o "Estatal"
  tipo          TEXT,                      -- seguridad, administrativo, subalterno, oficios, transporte, sanidad, educacion, social, tecnico, otros
  grupo         TEXT,                      -- A1 A2 B C1 C2 AP
  sistema       TEXT,                      -- concurso | concurso-oposicion | oposicion | bolsa
  dificultad    INTEGER,                   -- 1 fácil · 2 media · 3 difícil
  interino      INTEGER DEFAULT 0,
  estado        TEXT,                      -- abierta | pendiente | cerrada
  plazo_fin     TEXT,                      -- YYYY-MM-DD
  plazo_texto   TEXT,
  plazo_aprox   INTEGER DEFAULT 0,
  plazas        INTEGER,
  url           TEXT,
  tramite_url   TEXT,
  detalle_url   TEXT,                      -- de dónde sacar el detalle (XML BOE / ficha CIDO)
  resumen       TEXT,
  publicado     TEXT,                      -- YYYY-MM-DD
  encontrada    TEXT NOT NULL,             -- ISO
  detalle_ok    INTEGER DEFAULT 0,
  notificada    INTEGER DEFAULT 0,
  marca         TEXT DEFAULT 'nueva',      -- (antiguo) las marcas ahora son por usuario: tabla marcas
  subtipo       TEXT,                      -- subcategoría: policia-local, tcae, tramitacion… (src/sectores.ts)
  nivel         INTEGER,                   -- estudios mínimos 0-4
  requisitos    TEXT,                      -- JSON
  historia      TEXT,                      -- JSON [{fecha, texto}]
  revisada      TEXT,
  ia_resumen    TEXT
);
CREATE INDEX IF NOT EXISTS idx_ofertas_tipo ON ofertas(tipo, subtipo);
CREATE INDEX IF NOT EXISTS idx_ofertas_comunidad ON ofertas(comunidad);
CREATE INDEX IF NOT EXISTS idx_ofertas_plazo ON ofertas(plazo_fin);
CREATE INDEX IF NOT EXISTS idx_ofertas_pend ON ofertas(detalle_ok, notificada);

CREATE TABLE IF NOT EXISTS alertas (
  id       TEXT PRIMARY KEY,
  nombre   TEXT NOT NULL,
  filtros  TEXT NOT NULL,                  -- JSON (ver src/filters.ts)
  activa   INTEGER DEFAULT 1,
  creada   TEXT NOT NULL,
  uid      TEXT                            -- dueño (users.id); NULL = alertas antiguas sin cuenta
);
CREATE INDEX IF NOT EXISTS idx_alertas_uid ON alertas(uid);

CREATE TABLE IF NOT EXISTS devices (
  token    TEXT PRIMARY KEY,
  platform TEXT,
  creado   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v TEXT
);

-- Cuentas (entrada sin contraseña: código de 6 cifras por correo)
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  creado       TEXT NOT NULL,
  ultimo       TEXT,
  admin        INTEGER DEFAULT 0,
  plan         TEXT DEFAULT 'gratis',      -- gratis | pro
  avisos_email INTEGER DEFAULT 1,
  acepta       TEXT,                       -- fecha en que aceptó condiciones y privacidad
  perfil       TEXT,                       -- JSON {nivel, edad, carne[], catalan, nacionalidad}
  frecuencia   TEXT DEFAULT 'diaria',      -- diaria | semanal
  boletin      INTEGER DEFAULT 0,          -- boletín semanal de plazas destacadas
  telegram     TEXT,                       -- chat_id
  cal_token    TEXT                        -- calendario suscrito
);
CREATE TABLE IF NOT EXISTS otp (email TEXT PRIMARY KEY, hash TEXT, exp INTEGER, intentos INTEGER, enviado INTEGER);
CREATE TABLE IF NOT EXISTS sesiones (th TEXT PRIMARY KEY, uid TEXT NOT NULL, creada INTEGER, ultima INTEGER);
CREATE INDEX IF NOT EXISTS idx_sesiones_uid ON sesiones(uid);
CREATE TABLE IF NOT EXISTS marcas (uid TEXT NOT NULL, oferta_id TEXT NOT NULL, marca TEXT NOT NULL, ts TEXT, notas TEXT, docs TEXT, recordado INTEGER DEFAULT 0, PRIMARY KEY (uid, oferta_id));
CREATE TABLE IF NOT EXISTS ia_uso (k TEXT PRIMARY KEY, n INTEGER, dia TEXT);
CREATE TABLE IF NOT EXISTS mensajes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, email TEXT, mensaje TEXT, fecha TEXT, ip TEXT, leido INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS limites (k TEXT PRIMARY KEY, n INTEGER, dia TEXT);
