import type { CapacitorConfig } from '@capacitor/cli'

// ---------------------------------------------------------------------------
// iFind Capacitor Configuration
// ---------------------------------------------------------------------------
//
// iFind uses server-side Next.js API routes (MongoDB, JWT cookies, LinkedIn OAuth,
// resume uploads, etc.) — a fully static export (Capacitor's default "bundle the
// web assets" mode) is therefore NOT possible.
//
// Instead the WebView points directly at the live production URL.
// The APK is essentially a thin native shell that:
//   - opens the production web app inside a WebView
//   - gives the app access to native Android APIs via Capacitor plugins (if added)
//   - provides a proper home-screen icon, splash screen, and app-store listing
//
// When CAPACITOR_SERVER_URL is set (dev/staging), the WebView loads that URL
// instead — useful for testing against a staging deployment without publishing.
//
// scripts/app-build.mjs handles:
//   1. app-separation-checker: verifies student/employer code never imports moderator portal
//   2. cap sync android: copies any native plugin configs & capacitor.config into android/
//   3. Gradle assembleRelease: compiles the APK
//   4. Copies ifind.apk to the repo root
//
const serverUrl =
  process.env.CAPACITOR_SERVER_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://ifind.app' // ← set your production domain here

const config: CapacitorConfig = {
  appId: 'com.ifind.app',
  appName: 'iFind',
  // webDir is unused in live-URL mode but Capacitor CLI requires it to be a valid path
  webDir: 'public',
  server: {
    url: serverUrl,
    cleartext: false, // never allow plain-HTTP (all traffic must be HTTPS)
    androidScheme: 'https',
  },
  android: {
    // Allow Capacitor to manage the status bar colour via themes
    backgroundColor: '#0f172a',
  },
}

export default config
