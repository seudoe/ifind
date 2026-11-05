import type { CapacitorConfig } from '@capacitor/cli'

// The iFind mobile app bundles ONLY the student and employer portals.
// The moderator portal is a web-only tool and is never included in the APK.
// webDir points to the static-export output produced by scripts/app-build.mjs.
const config: CapacitorConfig = {
  appId: 'com.ifind.app',
  appName: 'iFind',
  webDir: '.mobile-build/out',
  server: {
    androidScheme: 'https', // the app page itself is served over https://localhost; no plain-HTTP allowed
    allowNavigation: [
      'ifind-ifind.vercel.app',
      '*.ifind-ifind.vercel.app',
      'linkedin.com',
      '*.linkedin.com',
      '*.licdn.com',
    ],
  },
  android: {
    backgroundColor: '#0f172a',
  },
}

export default config
