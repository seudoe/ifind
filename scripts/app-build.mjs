// scripts/app-build.mjs
//
// One-command build pipeline for the iFind mobile APK (Android).
//
// iFind uses server-side Next.js API routes (MongoDB, JWT cookies, LinkedIn OAuth,
// resume parsing, etc.) so a fully static export is NOT possible.  Instead the APK
// is a thin Capacitor shell that points its WebView at the live production URL.
//
// Steps:
//   1. Run app-separation-checker.mjs     → abort if portal boundaries are violated
//   2. npx cap sync android               → push capacitor.config + native plugin configs
//   3. Gradle assembleRelease             → compile the release APK
//   4. Copy APK to repo root as ifind.apk
//
// Prerequisites:
//   - Run `npx cap add android` once to create the android/ native project
//   - Java 17+ on PATH (or JAVA_HOME set)
//   - Android SDK installed and ANDROID_HOME / local.properties configured
//   - Set CAPACITOR_SERVER_URL or NEXT_PUBLIC_APP_URL to your deployed URL,
//     or edit the default in capacitor.config.ts directly
//
// Usage:
//   node scripts/app-build.mjs
//   CAPACITOR_SERVER_URL=https://staging.ifind.app node scripts/app-build.mjs

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const androidDir = join(root, 'android')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const run = (cmd, args, cwd, env = {}) => {
  console.log(`\n> [${cwd}] ${cmd} ${args.join(' ')}`)
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  })
  if (r.status !== 0) {
    console.error(`\nCommand failed with exit code ${r.status}`)
    process.exit(r.status ?? 1)
  }
}

/** Retry cpSync on Windows file-lock errors (antivirus, Explorer preview, etc.) */
function copyApk(src, dest) {
  const wait = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      cpSync(src, dest)
      return dest
    } catch (e) {
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) throw e
      if (attempt < 5) wait(1000)
    }
  }
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
  const alt = dest.replace(/\.apk$/, `-${stamp}.apk`)
  cpSync(src, alt)
  console.warn(
    `\nWARNING: ${dest} is locked by another process. Saved as ${alt} instead.`,
  )
  return alt
}

// ---------------------------------------------------------------------------
// Step 1: Separation check
// ---------------------------------------------------------------------------

console.log('===> Step 1: Checking portal separation...')
run('node', [join(root, 'scripts', 'app-separation-checker.mjs')], root)

// ---------------------------------------------------------------------------
// Step 2: Capacitor sync (push native config into android/)
// ---------------------------------------------------------------------------

console.log('\n===> Step 2: Syncing Capacitor Android assets & plugins...')

if (!existsSync(androidDir)) {
  console.error(
    '\nERROR: android/ directory not found.\n' +
      'Run the following command once to initialise the native Android project:\n\n' +
      '  node node_modules/@capacitor/cli/bin/capacitor add android\n\n' +
      'Then re-run this script.',
  )
  process.exit(1)
}

// Ensure local.properties exists for Gradle SDK path
const localProps = join(androidDir, 'local.properties')
if (!existsSync(localProps)) {
  const sdkDir = process.env.ANDROID_HOME || 'C:\\Users\\4dmin\\AppData\\Local\\Android\\Sdk'
  writeFileSync(localProps, `sdk.dir=${sdkDir.replace(/\\/g, '\\\\')}\n`)
}

const capBin = join(root, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor')
run('node', [capBin, 'sync', 'android'], root)

// ---------------------------------------------------------------------------
// Step 3: Gradle release APK
// ---------------------------------------------------------------------------

console.log('\n===> Step 3: Compiling Android release APK with Gradle...')
const gradlew = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew'
const javaHome =
  process.env.JAVA_HOME || 'C:\\Program Files\\Microsoft\\jdk-17.0.20.101-hotspot'
run(gradlew, ['assembleRelease'], androidDir, { JAVA_HOME: javaHome })

// ---------------------------------------------------------------------------
// Step 4: Copy APK to repo root
// ---------------------------------------------------------------------------

console.log('\n===> Step 4: Copying release APK to project root...')
const releaseApk = join(
  androidDir,
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release.apk',
)
const unsignedApk = join(
  androidDir,
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release-unsigned.apk',
)
const srcApk = existsSync(releaseApk) ? releaseApk : unsignedApk
const destApk = join(root, 'ifind.apk')

if (existsSync(srcApk)) {
  const out = copyApk(srcApk, destApk)
  console.log(`\n✅  SUCCESS: Release APK → ${out}`)
} else {
  console.error(`\nERROR: Generated APK not found at:\n  ${srcApk}`)
  process.exit(1)
}
