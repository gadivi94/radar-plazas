export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_TOKEN: string;          // secreto: wrangler secret put APP_TOKEN
  ENRICH_BUDGET?: string;     // fichas de detalle por ejecución (plan gratuito: 35)
  EXPO_ACCESS_TOKEN?: string; // opcional, si activas "enhanced push security" en Expo
}

export interface Oferta {
  id: string;
  fuente: "BOE" | "CIDO" | "TMB";
  titulo: string;
  organismo?: string | null;
  municipio?: string | null;
  provincia?: string | null;
  comunidad?: string | null;
  tipo?: string | null;
  grupo?: string | null;
  sistema?: string | null;
  dificultad?: number | null;
  interino?: number | boolean | null;
  estado?: "abierta" | "pendiente" | "cerrada" | null;
  plazo_fin?: string | null;
  plazo_texto?: string | null;
  plazo_aprox?: number | boolean | null;
  plazas?: number | null;
  url?: string | null;
  tramite_url?: string | null;
  detalle_url?: string | null;
  resumen?: string | null;
  publicado?: string | null;
  encontrada?: string;
  detalle_ok?: number;
  notificada?: number;
  marca?: string;
}
