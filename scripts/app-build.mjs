// scripts/app-build.mjs
//
// One-command build pipeline for the iFind mobile APK (Android).
// Bundles ONLY the student + employer portals — the moderator portal is
// web-only and is never included in the APK.
//
// Steps:
//   1. Run app-separation-checker.mjs  → abort if portal boundaries are violated
//   2. Scaffold .mobile-build/          → copy only student/employer code
//   3. Inject a smart entry-point page  → /phone for logged-out, last-tab for logged-in
//   4. Build a static Next.js export    → .mobile-build/out/
//   5. npx cap sync android             → push web assets into the native project
//   6. Gradle assembleRelease           → compile the APK
//   7. Copy APK to repo root as ifind.apk
//
// Prerequisites:
//   - Java 17+ on PATH (or JAVA_HOME set)
//   - Android SDK installed and ANDROID_HOME / local.properties set
//   - Run `npx cap add android` once to create the android/ native project
//
// Usage:
//   node scripts/app-build.mjs

import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const work = join(root, '.mobile-build')
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

/** Retry copyFileSync on Windows file-lock errors (antivirus, Explorer preview, etc.) */
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
// Step 2: Scaffold isolated mobile build directory
// ---------------------------------------------------------------------------

console.log('\n===> Step 2: Scaffolding .mobile-build/ ...')

rmSync(work, { recursive: true, force: true })
mkdirSync(join(work, 'app'), { recursive: true })
mkdirSync(join(work, 'public'), { recursive: true })

const copy = (from, to = from) =>
  cpSync(join(root, from), join(work, to), { recursive: true })

// App routes — student, employer, shared phone/landing
copy('app/user')
copy('app/internships')
copy('app/phone')
copy('app/employer')
copy('app/globals.css')
copy('app/theme.css')
copy('app/theme-palette.css')
copy('app/layout.tsx')

// API routes needed by the mobile app
const apiRoutes = [
  'app/api/auth',
  'app/api/user',
  'app/api/internships',
  'app/api/employer',
  'app/api/internship-match',
  'app/api/job-descriptions',
  'app/api/career-assistant',
  'app/api/chat',
  'app/api/usage',
  'app/api/events',
  'app/api/cron',
  'app/api/version',
]
for (const route of apiRoutes) {
  if (existsSync(join(root, route))) copy(route)
}

// Lib — everything except lib/moderator
const libDirs = readdirSync(join(root, 'lib'))
for (const entry of libDirs) {
  const p = join(root, 'lib', entry)
  if (statSync(p).isDirectory()) {
    if (entry === 'moderator') continue // moderator is web-only
    copy(`lib/${entry}`)
  } else {
    copy(`lib/${entry}`)
  }
}

// Components, hooks, types (shared UI; moderator pages are never imported by student/employer)
copy('components')
copy('hooks')
copy('types')
copy('models')

// Config files
for (const f of [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'postcss.config.mjs',
  'next.config.ts',
]) {
  copy(f)
}

// Copy env files if present
for (const f of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  if (existsSync(join(root, f))) copy(f)
}

// Public assets used by the mobile app
const PUBLIC_FILES = [
  'favicon.svg',
  'hero-student.png',
  'hero-graduate.png',
  'logo.svg',
  'logo-dark.svg',
  'logo-clean.svg',
  'logo-clean-dark.svg',
  'logo-mark.svg',
  'logo-mark-dark.svg',
  'logo-badge.svg',
]
for (const name of PUBLIC_FILES) {
  const from = join(root, 'public', name)
  if (existsSync(from)) cpSync(from, join(work, 'public', name))
}

// ---------------------------------------------------------------------------
// Step 3: Inject mobile entry-point (root page)
//
// Web:    /  → /user  (server redirect, great for SEO)
// Mobile: /  → check localStorage; if logged-in go to last tab, else go to /phone
// ---------------------------------------------------------------------------

console.log('\n===> Step 3: Writing mobile entry-point page...')

writeFileSync(
  join(work, 'app', 'page.tsx'),
  `'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Mobile APK entry point.
 * - Logged in as student  → restore last student tab (ifind_student_last_tab) or /user overview
 * - Logged in as employer → restore last employer tab (ifind_employer_last_tab) or /employer/institutes
 * - Logged out            → /phone (the swipe-up landing page)
 *
 * Auth state is detected via the JWT cookies set by the Next.js API routes.
 * We cannot read HTTP-only cookies from JS, so we do a lightweight /api/auth/me
 * ping instead, which is fast and fails gracefully when offline.
 */
export default function MobileEntryPage() {
  const router = useRouter()

  useEffect(() => {
    async function redirect() {
      try {
        // Try student session first
        const studentRes = await fetch('/api/auth/me', { credentials: 'include' })
        if (studentRes.ok) {
          const { data } = await studentRes.json()
          if (data?.username) {
            const stored = localStorage.getItem('ifind_student_last_tab')
            const target =
              stored && stored.startsWith(\`/user/\${data.username}\`)
                ? stored
                : \`/user/\${data.username}/overview\`
            router.replace(target)
            return
          }
        }
      } catch {
        /* network error — fall through */
      }

      try {
        // Try employer session
        const empRes = await fetch('/api/employer/auth/me', { credentials: 'include' })
        if (empRes.ok) {
          const { data } = await empRes.json()
          if (data?.id || data?.email) {
            const stored = localStorage.getItem('ifind_employer_last_tab')
            const target =
              stored && stored.startsWith('/employer/') ? stored : '/employer/institutes'
            router.replace(target)
            return
          }
        }
      } catch {
        /* network error — fall through */
      }

      // Not logged in → landing page
      router.replace('/phone')
    }

    redirect()
  }, [router])

  // Blank screen while checking auth — the redirect is fast
  return null
}
`,
)

// ---------------------------------------------------------------------------
// Step 4: Symlink node_modules to avoid re-installing
// ---------------------------------------------------------------------------

const nmLink = join(work, 'node_modules')
if (!existsSync(nmLink)) {
  symlinkSync(join(root, 'node_modules'), nmLink, 'junction')
}

// ---------------------------------------------------------------------------
// Step 5: Build static Next.js export
// ---------------------------------------------------------------------------

console.log('\n===> Step 4: Building mobile static bundle (Next.js export)...')
const nextBin = join(root, 'node_modules', 'next', 'dist', 'bin', 'next')
run('node', [nextBin, 'build'], work, { MOBILE_BUILD: '1' })

// ---------------------------------------------------------------------------
// Step 6: Verify no moderator code leaked into the bundle
// ---------------------------------------------------------------------------

console.log('\n===> Step 5: Verifying bundle for moderator leaks...')
const out = join(work, 'out')
if (existsSync(out)) {
  const forbidden = /\/moderator\/|api\/moderator|api\/admin/
  const leaks = []
  const scan = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) scan(p)
      else if (
        /\.(js|html|css|json|txt|map)$/.test(name) &&
        forbidden.test(readFileSync(p, 'utf8'))
      ) {
        leaks.push(p)
      }
    }
  }
  scan(out)
  if (leaks.length) {
    console.error(
      '\nLEAK: Moderator portal code found in the mobile bundle:\n' +
        leaks.join('\n') +
        '\nAborting APK build.',
    )
    process.exit(1)
  }
  console.log('✅  No moderator code in the bundle.')
} else {
  console.warn(
    '\nWARNING: .mobile-build/out/ not found — skipping leak scan (expected for server-side builds).',
  )
}

// ---------------------------------------------------------------------------
// Step 7: Capacitor sync
// ---------------------------------------------------------------------------

console.log('\n===> Step 6: Syncing Capacitor Android assets...')
const capBin = join(root, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor')
run('node', [capBin, 'sync', 'android'], root)

// ---------------------------------------------------------------------------
// Step 8: Gradle release APK
// ---------------------------------------------------------------------------

console.log('\n===> Step 7: Compiling Android release APK with Gradle...')

if (!existsSync(androidDir)) {
  console.error(
    '\nERROR: android/ directory not found.\n' +
      'Run `npx cap add android` once to initialise the native Android project, then re-run this script.',
  )
  process.exit(1)
}

const gradlew = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew'
const javaHome =
  process.env.JAVA_HOME || 'C:\\Program Files\\Microsoft\\jdk-17.0.20.101-hotspot'
run(gradlew, ['assembleRelease'], androidDir, { JAVA_HOME: javaHome })

// ---------------------------------------------------------------------------
// Step 9: Copy APK to repo root
// ---------------------------------------------------------------------------

console.log('\n===> Step 8: Copying release APK to project root...')
const srcApk = join(
  androidDir,
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release.apk',
)
const destApk = join(root, 'ifind.apk')

if (existsSync(srcApk)) {
  const out2 = copyApk(srcApk, destApk)
  console.log(`\n✅  SUCCESS: Release APK → ${out2}`)
} else {
  console.error(`\nERROR: Generated APK not found at:\n  ${srcApk}`)
  process.exit(1)
}
