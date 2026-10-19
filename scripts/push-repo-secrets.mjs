// Push GitHub Actions repo secrets from .env.repo (VERCEL* NAME=value lines only) + .env.local (as ENV_LOCAL).
// Usage: GH_TOKEN=<PAT with "Secrets: write" on the repo> node scripts/push-repo-secrets.mjs [--dry]
// Needs: npm i --no-save libsodium-wrappers
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const REPO = process.env.GH_REPO ?? "seudoe/ifind";
const SPECIAL = process.env.SPECIAL_ENVS ?? resolve(ROOT, ".env.repo");
const ENV_LOCAL = process.env.ENV_LOCAL_FILE ?? resolve(ROOT, ".env.local");
const dry = process.argv.includes("--dry");

let token = process.env.GH_TOKEN;
for (const f of [".env.repo", ".env"]) {
  if (token) break;
  try { token = readFileSync(resolve(ROOT, f), "utf8").match(/^\s*GH_TOKEN\s*=\s*["']?([^"'\r\n]+)/m)?.[1]; } catch {}
}
if (!token && !dry) { console.error("GH_TOKEN is required"); process.exit(1); }

const secrets = {};
for (const line of readFileSync(SPECIAL, "utf8").split(/\r?\n/)) {
  const m = line.match(/^(VERCEL[A-Z0-9_]*)=(.+)$/);
  if (m) secrets[m[1]] = m[2].trim();
}
// Never push the PAT itself.
secrets.ENV_LOCAL = readFileSync(ENV_LOCAL, "utf8")
  .split(/\r?\n/)
  .filter((l) => !/^\s*GH_TOKEN\s*=/.test(l))
  .join("\n");

if (dry) {
  for (const k of Object.keys(secrets)) console.log("would set", k, `(${secrets[k].length} chars)`);
  process.exit(0);
}

const sodium = (await import("libsodium-wrappers")).default;
await sodium.ready;

const api = (path, init = {}) =>
  fetch(`https://api.github.com/repos/${REPO}/actions/secrets${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", ...init.headers },
  });

const pk = await (await api("/public-key")).json();
if (!pk.key) { console.error("public-key failed:", pk); process.exit(1); }

for (const [name, value] of Object.entries(secrets)) {
  const sealed = sodium.crypto_box_seal(sodium.from_string(value), sodium.from_base64(pk.key, sodium.base64_variants.ORIGINAL));
  const res = await api(`/${name}`, {
    method: "PUT",
    body: JSON.stringify({ encrypted_value: sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL), key_id: pk.key_id }),
  });
  console.log(res.ok ? "set" : `FAILED ${res.status}`, name);
}
