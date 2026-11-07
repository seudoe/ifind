// scripts/app-build.mjs
//
// One-command build pipeline for the iFind mobile APK (Android).
// Builds an OFFLINE static web bundle for Capacitor:
//
// Steps:
//   1. Run app-separation-checker.mjs     → abort if portal boundaries are violated
//   2. Scaffold isolated .mobile-build/   → copy student + employer + phone UI
//   3. Build offline static site          → Next.js export into .mobile-build/out
//   4. Verify no moderator code leaked    → scan .mobile-build/out for leaks
//   5. npx cap sync android               → copy .mobile-build/out into native Android assets
//   6. Gradle assembleRelease             → compile the release APK
//   7. Copy APK to repo root as ifind.apk
//
// Prerequisites:
//   - Run `npx cap add android` once to create the android/ native project
//   - Java 17+ on PATH (or JAVA_HOME set)
//   - Android SDK installed and ANDROID_HOME / local.properties configured
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
// Step 2: Scaffold isolated mobile build directory
// ---------------------------------------------------------------------------

console.log('\n===> Step 2: Scaffolding .mobile-build/ ...')

rmSync(work, { recursive: true, force: true })
mkdirSync(join(work, 'app'), { recursive: true })
mkdirSync(join(work, 'public'), { recursive: true })

const copy = (from, to = from) =>
  cpSync(join(root, from), join(work, to), { recursive: true })

// Core app pages for offline APK bundle:
// /phone (swipe-up landing page designed for mobile), login/register pages
copy('app/phone')
copy('app/user/login', 'app/user/login')
copy('app/user/register', 'app/user/register')
copy('app/user/page.tsx', 'app/user/page.tsx')
copy('app/employer/login', 'app/employer/login')
copy('app/employer/register', 'app/employer/register')
copy('app/employer/page.tsx', 'app/employer/page.tsx')

// Styles and root layout
copy('app/globals.css')
copy('app/theme.css')
copy('app/theme-palette.css')
copy('app/layout.tsx')

// Injected mobile entry-point page (root /):
// - if logged in: restore last student/employer tab from localStorage
// - if logged out: /phone (the offline mobile landing screen)
writeFileSync(
  join(work, 'app', 'page.tsx'),
  `'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { getMobileSession } from '@/lib/mobileAuth'

export default function MobileEntryPage() {
  const router = useRouter()

  useEffect(() => {
    try {
      const session = getMobileSession()
      const studentTab = localStorage.getItem('ifind_student_last_tab')
      const employerTab = localStorage.getItem('ifind_employer_last_tab')
      const lastPortal = localStorage.getItem('ifind_last_active_portal')

      // If active session token exists, immediately resume the corresponding portal
      if (session?.token) {
        if (session.role === 'employer' || lastPortal === 'employer') {
          router.replace(employerTab && employerTab.startsWith('/employer/') ? employerTab : '/employer/institutes')
          return
        }
        if (session.username) {
          router.replace(studentTab && studentTab.startsWith('/user/' + session.username) ? studentTab : '/user/' + session.username + '/overview')
          return
        }
      }

      if (lastPortal === 'employer' && employerTab) {
        router.replace(employerTab)
        return
      }
      if (studentTab) {
        router.replace(studentTab)
        return
      }
      if (employerTab) {
        router.replace(employerTab)
        return
      }
    } catch {
      /* ignore */
    }

    // Default to /phone on mobile APK
    router.replace('/phone')
  }, [router])

  return null
}
`,
)

// Lib — copy everything except lib/moderator
const libDirs = readdirSync(join(root, 'lib'))
for (const entry of libDirs) {
  const p = join(root, 'lib', entry)
  if (statSync(p).isDirectory()) {
    if (entry === 'moderator') continue
    copy(`lib/${entry}`)
  } else {
    copy(`lib/${entry}`)
  }
}

// Components — copy everything EXCEPT moderator-only files (AnalyzePanel.tsx)
const compDirs = readdirSync(join(root, 'components'))
for (const entry of compDirs) {
  const srcDir = join(root, 'components', entry)
  const destDir = join(work, 'components', entry)
  if (entry === 'moderator') {
    const MODERATOR_ONLY = new Set(['AnalyzePanel.tsx'])
    mkdirSync(destDir, { recursive: true })
    for (const f of readdirSync(srcDir)) {
      if (MODERATOR_ONLY.has(f)) continue
      cpSync(join(srcDir, f), join(destDir, f))
    }
  } else {
    cpSync(srcDir, destDir, { recursive: true })
  }
}

copy('hooks')
copy('types')
copy('models')

// Config files for static export
for (const f of ['package.json', 'tsconfig.json', 'postcss.config.mjs']) {
  copy(f)
}

// Custom next.config.ts for static export
writeFileSync(
  join(work, 'next.config.ts'),
  `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
`,
)

// Env files
for (const f of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  if (existsSync(join(root, f))) copy(f)
}
// Mobile bundle must always point to the production backend, never localhost
writeFileSync(
  join(work, '.env.production.local'),
  'NEXT_PUBLIC_APP_URL=https://ifind-ifind.vercel.app\nNEXT_PUBLIC_API_URL=https://ifind-ifind.vercel.app\n',
)

// Public assets
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

// Symlink node_modules
const nmLink = join(work, 'node_modules')
if (!existsSync(nmLink)) {
  symlinkSync(join(root, 'node_modules'), nmLink, 'junction')
}

// ---------------------------------------------------------------------------
// Step 3: Build static Next.js export into .mobile-build/out
// ---------------------------------------------------------------------------

console.log('\n===> Step 3: Building mobile static bundle (Next.js export)...')
const nextBin = join(root, 'node_modules', 'next', 'dist', 'bin', 'next')
run('node', [nextBin, 'build', '--webpack'], work, {
  MOBILE_BUILD: '1',
  NEXT_PUBLIC_APP_URL: 'https://ifind-ifind.vercel.app',
  NEXT_PUBLIC_API_URL: 'https://ifind-ifind.vercel.app',
})

// ---------------------------------------------------------------------------
// Step 4: Verify no moderator portal routes or code in output
// ---------------------------------------------------------------------------

console.log('\n===> Step 4: Verifying bundle for moderator leaks...')
const out = join(work, 'out')
if (existsSync(out)) {
  // 1. Ensure no moderator pages exist in the output directory
  if (existsSync(join(out, 'moderator'))) {
    console.error('\nLEAK: out/moderator/ directory found in mobile bundle. Aborting.')
    process.exit(1)
  }

  // 2. Ensure no JS chunk contains moderator server-side logic
  const forbiddenJs = /lib\/moderator|AnalyzePanel|api\/moderator|api\/admin/
  const leaks = []
  const scanJs = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) scanJs(p)
      else if (/\.js$/.test(name) && forbiddenJs.test(readFileSync(p, 'utf8'))) {
        leaks.push(p)
      }
    }
  }
  const nextStatic = join(out, '_next')
  if (existsSync(nextStatic)) scanJs(nextStatic)

  if (leaks.length) {
    console.error(
      '\nLEAK: Moderator portal logic found in the mobile bundle:\n' +
        leaks.join('\n') +
        '\nAborting APK build.',
    )
    process.exit(1)
  }
  console.log('✅  No moderator code in the bundle.')
}

// ---------------------------------------------------------------------------
// Step 5: Capacitor sync (copy .mobile-build/out into android/ assets)
// ---------------------------------------------------------------------------

console.log('\n===> Step 5: Syncing Capacitor Android assets & plugins...')

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

// Generate launcher icons from public/logo-badge.svg
if (existsSync(join(root, 'scripts', 'generate-app-icons.mjs'))) {
  run('node', [join(root, 'scripts', 'generate-app-icons.mjs')], root)
}

const capBin = join(root, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor')
run('node', [capBin, 'sync', 'android'], root)

// ---------------------------------------------------------------------------
// Step 6: Gradle release APK
// ---------------------------------------------------------------------------

console.log('\n===> Step 6: Compiling Android release APK with Gradle...')
const gradlew = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew'
const javaHome =
  process.env.JAVA_HOME || 'C:\\Program Files\\Microsoft\\jdk-17.0.20.101-hotspot'
run(gradlew, ['assembleRelease'], androidDir, { JAVA_HOME: javaHome })

// ---------------------------------------------------------------------------
// Step 7: Copy APK to repo root
// ---------------------------------------------------------------------------

console.log('\n===> Step 7: Copying release APK to project root...')
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
  const out2 = copyApk(srcApk, destApk)
  console.log(`\n✅  SUCCESS: Release APK → ${out2}`)
} else {
  console.error(`\nERROR: Generated APK not found at:\n  ${srcApk}`)
  process.exit(1)
}
