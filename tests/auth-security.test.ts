import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import { checkPassword } from "../lib/passwords";
import { looksLikePdf, sniffImage } from "../lib/uploads";

test("checkPassword: correct, wrong and missing hash", async () => {
  const hash = await bcrypt.hash("Correct1Horse", 4);
  assert.equal(await checkPassword("Correct1Horse", hash), true);
  assert.equal(await checkPassword("wrong", hash), false);
  assert.equal(await checkPassword("Correct1Horse", null), false);
  assert.equal(await checkPassword("Correct1Horse", undefined), false);
});

test("sniffImage recognises real JPEG/PNG/WebP and rejects disguised files", () => {
  assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))?.ext, "jpg");
  assert.equal(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.ext, "png");
  assert.equal(sniffImage(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1"))?.ext, "webp");
  assert.equal(sniffImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>")), null);
  assert.equal(sniffImage(Buffer.from("<html><script>alert(1)</script></html>")), null);
  assert.equal(sniffImage(Buffer.from("GIF89a")), null);
  assert.equal(sniffImage(Buffer.alloc(0)), null);
});

test("looksLikePdf requires the %PDF- header", () => {
  assert.equal(looksLikePdf(Buffer.from("%PDF-1.7\n...")), true);
  assert.equal(looksLikePdf(Buffer.from("MZ\x90\x00 not a pdf")), false);
  assert.equal(looksLikePdf(Buffer.from("<html>%PDF-</html>".padStart(2000, " "))), false);
});

import { isBreachedPassword, passwordPolicyProblem } from "../lib/passwords";

test("passwordPolicyProblem enforces length, composition, common passwords and own identifiers", () => {
  assert.match(passwordPolicyProblem("short1A") ?? "", /at least 8 characters/);
  assert.match(passwordPolicyProblem("alllowercase1") ?? "", /uppercase/);
  assert.match(passwordPolicyProblem("NoDigitsHere") ?? "", /number/);
  assert.match(passwordPolicyProblem("Password1") ?? "", /too common/);
  assert.match(passwordPolicyProblem("Welcome123") ?? "", /too common/);
  assert.match(passwordPolicyProblem("Sunil2024xyz", { email: "sunil@example.com" }) ?? "", /must not contain your email or username/);
  assert.equal(passwordPolicyProblem("Xk9mQ2vLp8Rt", { username: "sunil", email: "sunil@example.com" }), null);
});

test("isBreachedPassword sends only a 5-character hash prefix and recognises a listed suffix", async () => {
  const { createHash } = await import("node:crypto");
  const sha1 = createHash("sha1").update("Xk9mQ2vLp8Rt").digest("hex").toUpperCase();
  const realFetch = globalThis.fetch;
  const seen: string[] = [];
  const saved = process.env.BREACH_CHECK;
  delete process.env.BREACH_CHECK;
  try {
    globalThis.fetch = (async (url: string | URL | Request) => {
      seen.push(String(url));
      return new Response(`0018A45C4D1DEF81644B54AB7F969B88D65:0\r\n${sha1.slice(5)}:42\r\nFFFF0000FFFF0000FFFF0000FFFF0000FFF:3`, { status: 200 });
    }) as typeof fetch;
    assert.equal(await isBreachedPassword("Xk9mQ2vLp8Rt"), true);
    assert.equal(seen.length, 1);
    assert.equal(seen[0], `https://api.pwnedpasswords.com/range/${sha1.slice(0, 5)}`); // nothing beyond the prefix leaves the server
    // padding rows (count 0) are not matches
    globalThis.fetch = (async () => new Response(`${sha1.slice(5)}:0`, { status: 200 })) as typeof fetch;
    assert.equal(await isBreachedPassword("Xk9mQ2vLp8Rt"), false);
    // an unreachable service must not block sign-ups
    globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
    assert.equal(await isBreachedPassword("Xk9mQ2vLp8Rt"), false);
    // and the switch turns the lookup off entirely
    process.env.BREACH_CHECK = "off";
    seen.length = 0;
    globalThis.fetch = (async (url: string | URL | Request) => { seen.push(String(url)); return new Response(""); }) as typeof fetch;
    assert.equal(await isBreachedPassword("Xk9mQ2vLp8Rt"), false);
    assert.equal(seen.length, 0);
  } finally {
    globalThis.fetch = realFetch;
    if (saved === undefined) delete process.env.BREACH_CHECK; else process.env.BREACH_CHECK = saved;
  }
});
