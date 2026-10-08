// Ajusta el proyecto iOS que genera `npx cap add ios`: versión, permisos, Entrar con Apple y con Google.
import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const VERSION = process.env.APP_VERSION || pkg.version;
const BUILD = String(parseInt(process.env.BUILD_NUMBER || "1", 10));
const GOOGLE_IOS = (process.env.GOOGLE_IOS_CLIENT_ID || "").trim();
const fallo = (m) => { console.error("✖ " + m); process.exit(1); };

const plist = "ios/App/App/Info.plist";
if (!fs.existsSync(plist)) fallo("No existe " + plist + " (¿falló npx cap add ios?)");
let p = fs.readFileSync(plist, "utf8");
const poner = (clave, xml) => {
  const re = new RegExp(`(<key>${clave}</key>\\s*)(<string>[^<]*</string>|<true/>|<false/>)`);
  p = re.test(p) ? p.replace(re, `$1${xml}`) : p.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${clave}</key>\n\t${xml}\n</dict>\n</plist>\n`);
  if (!p.includes(`<key>${clave}</key>`)) fallo("No he podido escribir " + clave);
};
poner("CFBundleDisplayName", "<string>Radar Opos</string>");
poner("CFBundleShortVersionString", `<string>${VERSION}</string>`);
poner("CFBundleVersion", `<string>${BUILD}</string>`);
poner("ITSAppUsesNonExemptEncryption", "<false/>");
poner("NSLocationWhenInUseUsageDescription", "<string>Tu ubicación sirve para enseñarte las plazas que tienes cerca. Se usa solo en tu iPhone y no se guarda.</string>");
poner("UIViewControllerBasedStatusBarAppearance", "<true/>");
if (GOOGLE_IOS) {
  const inverso = GOOGLE_IOS.split(".").reverse().join(".");
  poner("GIDClientID", `<string>${GOOGLE_IOS}</string>`);
  if (!p.includes(inverso)) p = p.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>${inverso}</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n</dict>\n</plist>\n`);
  const del = "ios/App/App/AppDelegate.swift";
  if (fs.existsSync(del)) {
    let a = fs.readFileSync(del, "utf8");
    if (!a.includes("GoogleSignIn")) {
      a = a.replace("import Capacitor", "import Capacitor\nimport GoogleSignIn");
      a = a.replace(/func application\(_ app: UIApplication, open url: URL, options: \[UIApplication\.OpenURLOptionsKey: Any\] = \[:\]\) -> Bool \{/, "func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {\n        if GIDSignIn.sharedInstance.handle(url) { return true }");
      fs.writeFileSync(del, a);
    }
  }
}
fs.writeFileSync(plist, p);

// Entrar con Apple: fichero de entitlements enlazado al proyecto (la capacidad debe estar activada en el App ID)
fs.writeFileSync("ios/App/App/App.entitlements", '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n\t<key>com.apple.developer.applesignin</key>\n\t<array>\n\t\t<string>Default</string>\n\t</array>\n</dict>\n</plist>\n');
const pbx = "ios/App/App.xcodeproj/project.pbxproj";
let x = fs.readFileSync(pbx, "utf8");
if (!x.includes("CODE_SIGN_ENTITLEMENTS")) x = x.replace(/(\n\s*)INFOPLIST_FILE = App\/Info\.plist;/g, "$1CODE_SIGN_ENTITLEMENTS = App/App.entitlements;$1INFOPLIST_FILE = App/Info.plist;");
if (!x.includes("App.entitlements")) fallo("No he podido enlazar App.entitlements al proyecto");
fs.writeFileSync(pbx, x);
console.log(`✔ iOS: versión ${VERSION} (${BUILD}), Entrar con Apple${GOOGLE_IOS ? " y con Google" : ""}, ubicación`);
