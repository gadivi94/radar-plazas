# Radar de Plazas

Plazas públicas de toda España (BOE, CIDO y TMB) con mapa de Cataluña, filtros por dificultad, grupo y lugar, y alertas.

- **Web:** https://radaropos.com (también https://radar-plazas.pages.dev). Pide la clave de acceso la primera vez.
- **App de iPhone:** la misma web dentro de una app (Capacitor), compilada con Codemagic.

## Cómo funciona

| Pieza | Qué hace | Dónde |
|---|---|---|
| `web/index.html` | La página: lista, mapa, filtros, marcas y alertas | Cloudflare Pages |
| `worker/` | La API y la revisión de fuentes (se empaqueta en `web/_worker.js`) | Cloudflare Pages |
| Base de datos | Plazas, marcas, alertas y clave (`radar-plazas-db`) | Cloudflare D1 |
| `.github/workflows/web.yml` | Publica la web solo cada vez que cambia algo | GitHub Actions |
| `.github/workflows/revisa.yml` | Revisa las fuentes cada 15 min de 8:00 a 12:45 | GitHub Actions |
| Tarea diaria de Claude | Te manda al móvil los avisos de tus alertas | Claude |
| `codemagic.yaml` | Compila la app de iPhone y la sube a TestFlight | Codemagic |

## Puesta en marcha (una sola vez, desde el iPad)

1. **Repositorio:** crear `radar-plazas` (privado) en GitHub. ✔
2. **Llave de Cloudflare:** My Profile → API Tokens → Create Custom Token, con *Cloudflare Pages · Edit* y *D1 · Edit*. Guárdala en GitHub → Settings → Secrets and variables → Actions → `CLOUDFLARE_API_TOKEN`.
3. **Publicar:** se hace solo al subir el código. Para relanzarlo: GitHub → Actions → *Publica la web* → *Run workflow*.
4. **Dominio propio (opcional):** cómpralo en Cloudflare → Domain Registration. Después, en GitHub → Settings → Secrets and variables → Actions → pestaña *Variables* → `DOMINIO` = `tudominio.com` y relanza *Publica la web*. Si el dominio no se activa solo, en Cloudflare → Workers & Pages → radar-plazas → Custom domains → *Set up a custom domain*.

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
