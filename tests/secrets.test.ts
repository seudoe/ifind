import assert from "node:assert/strict";
import test from "node:test";
import { isPublishedSecret, requireSecret } from "../lib/secrets";

const PUBLISHED = "your-super-secret-jwt-key-change-in-production";

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) { saved[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else (process.env as Record<string, string>)[k] = env[k]!; }
  try { fn(); } finally { for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else (process.env as Record<string, string>)[k] = saved[k]!; } }
}

test("the placeholder that was committed to git is recognised as published", () => {
  assert.equal(isPublishedSecret(PUBLISHED), true);
  assert.equal(isPublishedSecret(`  ${PUBLISHED}\n`), true);
  assert.equal(isPublishedSecret("0123456789abcdef0123456789abcdef0123"), false);
});

test("requireSecret refuses a published value in production and a missing value everywhere", () => {
  withEnv({ NODE_ENV: "production", T_SECRET: PUBLISHED }, () => assert.throws(() => requireSecret("T_SECRET"), /public in the git history/));
  withEnv({ NODE_ENV: "production", T_SECRET: undefined }, () => assert.throws(() => requireSecret("T_SECRET"), /not configured/));
  withEnv({ NODE_ENV: "production", T_SECRET: "0123456789abcdef0123456789abcdef0123" }, () => assert.equal(requireSecret("T_SECRET").length, 36));
});
