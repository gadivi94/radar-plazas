# Radar de Plazas

Plazas públicas de toda España (BOE, CIDO y TMB) con mapa de Cataluña, filtros por dificultad, grupo y lugar, y alertas.

- **Web:** https://radaropos.com (también https://radar-plazas.pages.dev). Las plazas son públicas; con una cuenta gratuita (código por correo, sin contraseña) se guardan plazas y se reciben alertas por email.
- **App de iPhone:** la misma web dentro de una app (Capacitor), compilada con Codemagic.

## Cómo funciona

| Pieza | Qué hace | Dónde |
|---|---|---|
| `web/index.html` | La página: lista, mapa, filtros, marcas y alertas | Cloudflare Pages |
| `worker/` | La API y la revisión de fuentes (se empaqueta en `web/_worker.js`) | Cloudflare Pages |
| Base de datos | Plazas, marcas, alertas y clave (`radar-plazas-db`) | Cloudflare D1 |
| `.github/workflows/web.yml` | Publica la web solo cada vez que cambia algo | GitHub Actions |
| `.github/workflows/revisa.yml` | Revisa las fuentes cada 15 min de 8:00 a 12:45 | GitHub Actions |
| `worker/src/cuentas.ts` | Cuentas con código por correo, contacto, baja de avisos, administración | Cloudflare Pages |
| `web/legal/`, `web/contacto.html` | Aviso legal, privacidad, cookies, condiciones de uso y contacto | Cloudflare Pages |
| Resend | Envía los códigos de acceso y los avisos por correo | resend.com |
| Tarea diaria de Claude | Te manda al móvil los avisos de tus alertas y los mensajes de contacto | Claude |
| `codemagic.yaml` | Compila la app de iPhone y la sube a TestFlight | Codemagic |

## Puesta en marcha (una sola vez, desde el iPad)

1. **Repositorio:** crear `radar-plazas` (privado) en GitHub. ✔
2. **Llave de Cloudflare:** My Profile → API Tokens → Create Custom Token, con *Cloudflare Pages · Edit* y *D1 · Edit*. Guárdala en GitHub → Settings → Secrets and variables → Actions → `CLOUDFLARE_API_TOKEN`.
3. **Publicar:** se hace solo al subir el código. Para relanzarlo: GitHub → Actions → *Publica la web* → *Run workflow*.
4. **Dominio propio (opcional):** cómpralo en Cloudflare → Domain Registration. Después, en GitHub → Settings → Secrets and variables → Actions → pestaña *Variables* → `DOMINIO` = `tudominio.com` y relanza *Publica la web*. Si el dominio no se activa solo, en Cloudflare → Workers & Pages → radar-plazas → Custom domains → *Set up a custom domain*.

## Correo: códigos, avisos y contacto (una sola vez)

1. **Resend** (resend.com, la misma cuenta de opos365) → *Domains* → **Add domain** → `radaropos.com` → *Auto configure* con Cloudflare → espera a que salga **Verified**.
2. Resend → *API Keys* → **Create API key** (Sending access, dominio radaropos.com) → cópiala.
3. GitHub → Settings → Secrets and variables → Actions → **New repository secret** → `RESEND_API_KEY` → pega la clave → relanza *Publica la web*.
4. **Buzón hola@radaropos.com:** Cloudflare → radaropos.com → *Email* → *Email Routing* → activar → regla `hola@radaropos.com` → tu Gmail. Ahí llegan los mensajes del formulario de contacto (también se guardan en Mi cuenta → Administración).
5. En la web, **Entrar** con tu correo desde el navegador donde ya tenías la clave antigua: quedas como administrador y recuperas tus alertas y marcas. Desde otro dispositivo: Mi cuenta → *Tengo una clave de administración*.

Textos legales: rellenar el domicilio marcado en amarillo en `web/legal/aviso-legal.html` y `web/legal/privacidad.html` y pedir una revisión rápida a un gestor o abogado antes de cobrar nada.

## App de iPhone (cuando quieras)

1. developer.apple.com → Identifiers → **+** → App ID `cat.gadivi.radarplazas`.
2. App Store Connect → Apps → **+** → Nueva app «Radar Plazas» con ese Bundle ID.
3. Codemagic → **Add application** → GitHub → `radar-plazas` → *codemagic.yaml*.
4. Codemagic → Code signing identities → iOS provisioning profiles → crea/descarga el perfil *App Store* de `cat.gadivi.radarplazas` (igual que hiciste con opos365).
5. Lanza el flujo **iOS (TestFlight)** e instálala desde TestFlight.

Si tienes dominio propio, cambia `RADAR_API` en `codemagic.yaml`.

## Pruebas

```
cd worker && bun test
```
