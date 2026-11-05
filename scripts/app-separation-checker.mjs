// app-separation-checker.mjs
//
// Verifies that the student/employer app code is fully isolated from the
// moderator portal. The mobile APK ships student + employer only; moderator
// is a web-only tool. Cross-portal imports would leak server-only logic into
// the client bundle and break the security boundary.
//
// Portals and their rules:
//   MOBILE  = student (app/user, app/internships, lib/ shared student helpers)
//           + employer (app/employer, lib/employer, app/api/employer)
//   MODERATOR = app/moderator, app/api/moderator, lib/moderator
//   SHARED  = lib/* (everything that is NOT inside lib/moderator) — MOBILE may import these
//   API     = app/api/user, app/api/auth, app/api/internships, etc.
//
// Rules enforced:
//   1. MOBILE shipped code must NOT import MODERATOR code.
//   2. MODERATOR code must NOT import MOBILE-only shipped code.
//      (It may use shared lib/* helpers — the same ones mobile uses.)
//   3. The SHARED lib helpers must not import portal-specific code.
//
// Usage:
//   node scripts/app-separation-checker.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const rel = (p) => relative(root, p).split(sep).join('/')

// --- Portal boundary definitions -------------------------------------------

/** Routes and libs that go into the mobile APK */
const MOBILE_DIRS = [
  'app/user',
  'app/internships',
  'app/phone',
  'app/api/user',
  'app/api/auth',
  'app/api/internships',
  'app/api/internship-match',
  'app/api/job-descriptions',
  'app/api/career-assistant',
  'app/api/chat',
  'app/api/usage',
  'app/api/events',
  'app/api/cron',
  'app/api/version',
  'app/employer',
  'app/api/employer',
  'lib/employer',
  'lib/campus',
  'lib/resume',
  'lib/chat',
  'lib/email',
  'lib/groq',
  'lib/ai',
  'lib/analytics',
  'lib/jobMatch',
  'lib/messaging',
  'lib/usage',
]

/** Shared lib helpers (flat files) that both portals may use */
const SHARED_LIB_DIRS = ['lib']
const SHARED_LIB_FILES_ONLY = true // only the flat .ts files directly in lib/, not subdirs

/** Directories that belong exclusively to the moderator portal */
const MODERATOR_DIRS = [
  'app/moderator',
  'app/api/moderator',
  'lib/moderator',
  'app/api/admin',
]

// ---------------------------------------------------------------------------

/** Walk a directory tree and collect all .ts/.tsx/.js/.jsx/.mjs files */
const walk = (dir) => {
  const out = []
  const inner = (d) => {
    let names = []
    try {
      names = readdirSync(d)
    } catch {
      return
    }
    for (const n of names) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) inner(p)
      else if (/\.(ts|tsx|js|jsx|mjs)$/.test(n)) out.push(p)
    }
  }
  inner(join(root, dir))
  return out
}

/** Extract all static import/require specifiers from source text */
const importsOf = (src) => {
  const specs = []
  const re =
    /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g
  let m
  while ((m = re.exec(src))) specs.push(m[1] ?? m[2] ?? m[3] ?? m[4])
  return specs
}

/** Resolve an import specifier to a repo-relative path, or null for packages */
const resolveSpec = (spec, fromFile) => {
  if (spec.startsWith('@/')) return spec.slice(2) // path alias
  if (spec.startsWith('.')) return rel(resolve(dirname(fromFile), spec))
  return null // npm package — not our concern
}

const inAny = (path, dirs) =>
  dirs.some((d) => path === d || path.startsWith(d + '/'))

const problems = []

// Rule 1: MOBILE shipped dirs must NOT import MODERATOR code
for (const dir of MOBILE_DIRS) {
  for (const f of walk(dir)) {
    for (const spec of importsOf(readFileSync(f, 'utf8'))) {
      const target = resolveSpec(spec, f)
      if (target === null) continue
      if (inAny(target, MODERATOR_DIRS)) {
        problems.push(
          `[MOBILE→MODERATOR] ${rel(f)} imports "${spec}" — mobile code must not use moderator code`,
        )
      }
    }
  }
}

// Rule 2: MODERATOR dirs must NOT import MOBILE shipped-only dirs
//   (they MAY import shared lib/* helpers — the flat lib/ files)
const MOBILE_SHIPPED_ONLY = ['app/user', 'app/internships', 'app/phone', 'app/employer']
for (const dir of MODERATOR_DIRS) {
  for (const f of walk(dir)) {
    for (const spec of importsOf(readFileSync(f, 'utf8'))) {
      const target = resolveSpec(spec, f)
      if (target === null) continue
      if (inAny(target, MOBILE_SHIPPED_ONLY)) {
        problems.push(
          `[MODERATOR→MOBILE] ${rel(f)} imports "${spec}" — moderator code must not use mobile-only portal code`,
        )
      }
    }
  }
}

// Rule 3: shared lib/* flat helpers (lib/auth.ts, lib/db.ts, etc.) must NOT
//          import any portal-specific directory
const ALL_PORTAL_DIRS = [...MOBILE_DIRS, ...MODERATOR_DIRS]
const sharedLibFiles = walk('lib').filter((f) => {
  const r = rel(f)
  // only the flat lib/ files, not inside subdirs like lib/employer, lib/moderator etc.
  return r.split('/').length === 2 // e.g. lib/auth.ts → ['lib', 'auth.ts']
})
for (const f of sharedLibFiles) {
  for (const spec of importsOf(readFileSync(f, 'utf8'))) {
    const target = resolveSpec(spec, f)
    if (target === null) continue
    // flat lib helpers may only import other flat lib helpers or npm packages
    if (target.startsWith('app/') || target.startsWith('components/') || target.startsWith('hooks/')) {
      problems.push(
        `[SHARED-LIB] ${rel(f)} imports "${spec}" — shared lib helpers must not import app/component/hook code`,
      )
    }
  }
}

if (problems.length) {
  console.error(
    '\n❌  App separation check FAILED:\n' +
      problems.map((p) => '  - ' + p).join('\n') +
      '\n\nFix the cross-portal imports above before building the APK.',
  )
  process.exit(1)
}

console.log(
  '✅  App separation check passed: student/employer code is isolated from the moderator portal.',
)
