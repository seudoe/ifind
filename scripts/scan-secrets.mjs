// Fails if a tracked file contains something shaped like a credential, or if a tracked file is a likely secret/data dump.
// Usage: node scripts/scan-secrets.mjs            (tracked files in the working tree)
//        node scripts/scan-secrets.mjs --history  (also every line ever added on any ref; slower)
// Matches are printed redacted. Add a reviewed false positive to ALLOW below, never a real secret.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const FORMATS = [
  ["MongoDB/SQL/Redis URI with password", /(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|amqp):\/\/[^\s"'`<>/:@]+:[^\s"'`<>@]+@[^\s"'`<>]+/],
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["AWS access key id", /AKIA[0-9A-Z]{16}/],
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/],
  ["OpenAI/Anthropic-style key", /sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/],
  ["GitHub token", /(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/],
  ["Slack token", /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ["Hugging Face token", /hf_[A-Za-z0-9]{25,}/],
  ["Groq key", /gsk_[A-Za-z0-9]{20,}/],
  ["ImageKit key", /(?:private|public)_[A-Za-z0-9+/=]{20,}/],
  ["JWT", /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
  ["literal secret assignment", /(?:api[_-]?key|secret|token|passw(?:or)?d|private[_-]?key|client[_-]?secret)\w*["']?\s*[:=]\s*["'](?!your|example|change|test|dummy|<)[^"'\s${}()]{16,}["']/i],
];
// Published values that must never reappear (kept in sync with lib/secrets.ts).
const BANNED_LITERALS = ["your-super-secret-jwt-key-change-in-production"];
const FILE_NAMES = /(^|\/)(\.env(?!\.example$)[^/]*|[^/]*\.pem|[^/]*\.p12|[^/]*\.pfx|id_rsa|[^/]*service[-_]?account[^/]*\.json|[^/]*credentials[^/]*\.json|[^/]*backup[^/]*\.(json|csv|sql|bson)|[^/]*dump[^/]*\.(json|csv|sql|bson))$/i;
const SKIP = /(package-lock\.json|\.lock$|\.(png|jpe?g|ico|woff2?|pdf|svg)$)/i;
const ALLOW = [
  "lib/secrets.ts", // holds the banned literal on purpose
  "scripts/scan-secrets.mjs",
  "tests/", // fixtures use obviously fake values
];

const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 1 << 28 });
const redact = (s) => s.trim().replace(/(["'=:/])([^"'\s/:@]{3})[^"'\s]{6,}/g, "$1$2…[REDACTED]").slice(0, 140);
const allowed = (f) => ALLOW.some((a) => f.startsWith(a) || f === a);

const problems = [];
const check = (where, file, line) => {
  if (line.length < 600) for (const [name, rx] of FORMATS) if (rx.test(line)) problems.push(`${where} ${file}: ${name}: ${redact(line)}`);
  for (const b of BANNED_LITERALS) if (line.includes(b)) problems.push(`${where} ${file}: published secret literal`);
};

for (const f of git("ls-files").split("\n").filter(Boolean)) {
  if (FILE_NAMES.test(f)) problems.push(`tree ${f}: tracked file looks like a secret or data dump`);
  if (SKIP.test(f) || allowed(f)) continue;
  let text;
  try { text = readFileSync(f, "utf8"); } catch { continue; }
  text.split("\n").forEach((l, i) => check("tree", `${f}:${i + 1}`, l));
}

if (process.argv.includes("--history")) {
  let file = "", commit = "";
  for (const l of git("log", "--all", "-p", "-U0", "--no-color", "--pretty=format:@@C %h").split("\n")) {
    if (l.startsWith("@@C ")) commit = l.slice(4);
    else if (l.startsWith("+++ ")) file = l.replace(/^\+\+\+ (b\/)?/, "");
    else if (l.startsWith("+") && !l.startsWith("+++") && !SKIP.test(file) && !allowed(file)) check(`history ${commit}`, file, l.slice(1));
  }
}

if (problems.length) {
  console.error(`secret scan: ${problems.length} finding(s)\n` + [...new Set(problems)].map((p) => "  " + p).join("\n"));
  process.exit(1);
}
console.log("secret scan: clean");
