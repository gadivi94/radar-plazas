# Radar de Plazas · app de iPhone

La app es la misma web metida en una app nativa (Capacitor 8) y se compila en la nube con **Codemagic**, sin Mac. Usa la misma cuenta, los mismos datos y se sincroniza con la web.

**Qué añade la app:** entrar con Apple (y con Google si lo configuras), avisos en el móvil 3 días y 1 día antes de que cierre una plaza que sigues, compartir con la hoja de iOS, enlaces oficiales en el navegador integrado y «Cerca de mí» con la ubicación del iPhone.

Identificador de la app (Bundle ID): **`com.radaropos.app`** — no se puede cambiar una vez publicada.

## 1. Apple Developer (developer.apple.com → Certificates, Identifiers & Profiles)
1. **Identifiers → +** → *App IDs* → *App* → Continue.
   - Description: `Radar de Plazas` · Bundle ID: *Explicit* `com.radaropos.app`.
   - En *Capabilities* marca **Sign in with Apple** → Continue → Register.
2. **Profiles → +** → *App Store Connect* (Distribution) → App ID `com.radaropos.app` → elige el certificado **Apple Distribution** que ya usas con opos365 → nombre `Radar Plazas App Store` → Generate.

## 2. App Store Connect (appstoreconnect.apple.com)
**Apps → + → Nueva app**: plataforma iOS · nombre `Radar de Plazas` (si está cogido: `Radar de Plazas: Oposiciones`) · idioma principal Español · Bundle ID `com.radaropos.app` · SKU `radaropos`.

## 3. Codemagic (codemagic.io)
1. **Add application** → GitHub → `radar-plazas` → tipo *codemagic.yaml*.
2. **Team settings → codemagic.yaml settings → Code signing identities → iOS provisioning profiles → Fetch profiles** → marca `Radar Plazas App Store`.
3. En la app `radar-plazas` → **Start new build** → rama `main` → flujo **iOS (TestFlight)**. Tarda unos 20 minutos.
4. Cuando acabe, la compilación aparece en App Store Connect → TestFlight (tarda unos minutos en procesarse). Instala **TestFlight** en el iPhone y pruébala.

Si falla, copia las líneas que salen entre «MOTIVO DEL ERROR» y pásamelas.

## 4. Entrar con Google (opcional, web y app)
1. console.cloud.google.com → crea el proyecto `Radar de Plazas`.
2. **Google Auth Platform → Branding**: nombre `Radar de Plazas`, correo de asistencia, dominio `radaropos.com`, política de privacidad `https://radaropos.com/legal/privacidad.html`. **Audience**: *External* → *Publish app*.
3. **Clients → Create client**:
   - Tipo *Web application* · orígenes autorizados `https://radaropos.com` y `https://radar-plazas.pages.dev` → copia el **Client ID**.
   - Otro de tipo *iOS* · Bundle ID `com.radaropos.app` → copia el **Client ID**.
4. Pásame los dos IDs (no son secretos). Los pongo en la web (`GOOGLE_CLIENT_IDS`) y en `codemagic.yaml` (`GOOGLE_IOS_CLIENT_ID`).

## 5. Publicar en la App Store
App Store Connect → la app → **Distribución**: capturas de iPhone (6,9" y 6,5"), descripción, palabras clave, URL de soporte `https://radaropos.com/contacto.html`, privacidad `https://radaropos.com/legal/privacidad.html`, categoría *Productividad* (secundaria *Educación*).
- **Privacidad de la app**: correo electrónico y nombre (vinculados, funcionalidad de la app); ubicación aproximada **no** recogida (se usa solo en el móvil).
- **Notas para la revisión**: «La app reúne convocatorias públicas de empleo de fuentes oficiales (BOE, boletines y webs de empresas públicas). Para probar la cuenta: Entrar → correo → código de 6 cifras (o Entrar con Apple). Funciones nativas: avisos locales antes del fin de plazo de las plazas seguidas, compartir, ubicación para “Cerca de mí”, Entrar con Apple.»
- Elige la compilación de TestFlight → **Enviar a revisión**.

## Actualizar la app
Los cambios de la web llegan a la app en la siguiente compilación: Codemagic → **Start new build** → **iOS (TestFlight)**. El número de compilación sube solo; para cambiar la versión que se ve en la tienda (1.0.0 → 1.1.0) cambia `"version"` en `package.json`.
