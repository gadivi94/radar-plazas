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
  marca         TEXT DEFAULT 'nueva'       -- nueva | visto | interesa | presentada | descartada
);
CREATE INDEX IF NOT EXISTS idx_ofertas_comunidad ON ofertas(comunidad);
CREATE INDEX IF NOT EXISTS idx_ofertas_plazo ON ofertas(plazo_fin);
CREATE INDEX IF NOT EXISTS idx_ofertas_pend ON ofertas(detalle_ok, notificada);

CREATE TABLE IF NOT EXISTS alertas (
  id       TEXT PRIMARY KEY,
  nombre   TEXT NOT NULL,
  filtros  TEXT NOT NULL,                  -- JSON (ver src/filters.ts)
  activa   INTEGER DEFAULT 1,
  creada   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  token    TEXT PRIMARY KEY,
  platform TEXT,
  creado   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v TEXT
);
