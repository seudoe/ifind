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
