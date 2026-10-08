export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_TOKEN?: string;         // clave de administración (si no, meta.app_token en D1)
  ENRICH_BUDGET?: string;     // fichas de detalle por ejecución (plan gratuito: 35)
  EXPO_ACCESS_TOKEN?: string; // opcional, push de la app antigua
  RESEND_API_KEY?: string;    // secreto: envío de códigos y avisos por correo
  MAIL_FROM?: string;         // remitente, p. ej. "Radar de Plazas <avisos@radaropos.com>"
  CONTACT_TO?: string;        // a dónde llegan los mensajes del formulario de contacto
  SITE_URL?: string;          // https://radaropos.com
  ALERTAS_GRATIS?: string;    // alertas permitidas con la cuenta gratuita
  OTP_PEPPER?: string;        // secreto opcional para los códigos
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
