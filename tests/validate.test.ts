import assert from "node:assert/strict";
import test from "node:test";
import { isObjectId, str, strList } from "../lib/validate";
import { requireSecret } from "../lib/secrets";

test("isObjectId accepts only 24-char hex strings", () => {
  assert.equal(isObjectId("507f1f77bcf86cd799439011"), true);
  assert.equal(isObjectId("507f1f77bcf86cd79943901"), false);
  assert.equal(isObjectId("not-an-id"), false);
  assert.equal(isObjectId({ $ne: "" }), false);
  assert.equal(isObjectId(["507f1f77bcf86cd799439011"]), false);
  assert.equal(isObjectId(undefined), false);
});

test("str rejects non-strings and over-long strings", () => {
  assert.equal(str("  hello ", 10), "hello");
  assert.equal(str("x".repeat(11), 10), undefined);
  assert.equal(str({ $gt: "" }, 10), undefined);
  assert.equal(str(42, 10), undefined);
});

test("strList validates shape, count and item length", () => {
  assert.deepEqual(strList([" a ", "", "b"], 5, 5), ["a", "b"]);
  assert.equal(strList("a", 5, 5), undefined);
  assert.equal(strList(["a", 1], 5, 5), undefined);
  assert.equal(strList(["a", "b", "c"], 2, 5), undefined);
  assert.equal(strList(["toolong"], 5, 3), undefined);
});

test("requireSecret fails closed when the variable is missing", () => {
  delete process.env.SOME_MISSING_SECRET_FOR_TEST;
  assert.throws(() => requireSecret("SOME_MISSING_SECRET_FOR_TEST"), /not configured/);
  process.env.SOME_MISSING_SECRET_FOR_TEST = "present";
  assert.equal(requireSecret("SOME_MISSING_SECRET_FOR_TEST"), "present");
  delete process.env.SOME_MISSING_SECRET_FOR_TEST;
});

import { escapeRegex, int } from "../lib/validate";
import { safeHref } from "../lib/safeUrl";
import { isImageKitUrl } from "../lib/uploads";
import { JsonLd } from "../components/seo/JsonLd";

test("int clamps, truncates and falls back for non-numbers", () => {
  assert.equal(int(1_000_000, 1, 20, 10), 20);
  assert.equal(int(-5, 1, 20, 10), 1);
  assert.equal(int("7", 1, 20, 10), 7);
  assert.equal(int(7.9, 1, 20, 10), 7);
  assert.equal(int({ $gt: 1 }, 1, 20, 10), 10);
  assert.equal(int(NaN, 1, 20, 10), 10);
  assert.equal(int("", 1, 20, 10), 10);
});

test("escapeRegex makes a search box literal (no ReDoS pattern, no syntax error)", () => {
  assert.doesNotThrow(() => new RegExp(escapeRegex("[unclosed"), "i"));
  assert.equal(new RegExp(escapeRegex("(a+)+$"), "i").test("aaaaaaaaaaaaaaaaaaaaaaaa!"), false);
  assert.equal(new RegExp(escapeRegex("a.b"), "i").test("axb"), false);
  assert.equal(new RegExp(escapeRegex("a.b"), "i").test("A.B"), true);
});

test("safeHref allows only http(s) (and mailto when asked)", () => {
  assert.equal(safeHref("https://example.com/a?b=1"), "https://example.com/a?b=1");
  assert.equal(safeHref("http://example.com"), "http://example.com/");
  assert.equal(safeHref("javascript:alert(document.cookie)"), undefined);
  assert.equal(safeHref("  JaVaScRiPt:alert(1)"), undefined);
  assert.equal(safeHref("java\tscript:alert(1)"), undefined);
  assert.equal(safeHref("data:text/html,<script>alert(1)</script>"), undefined);
  assert.equal(safeHref("vbscript:msgbox(1)"), undefined);
  assert.equal(safeHref("//evil.example/x"), undefined);
  assert.equal(safeHref("/relative"), undefined);
  assert.equal(safeHref({ href: "https://example.com" }), undefined);
  assert.equal(safeHref("mailto:hr@example.com"), undefined);
  assert.equal(safeHref("mailto:hr@example.com", { mailto: true }), "mailto:hr@example.com");
  assert.equal(safeHref("https://example.com/" + "a".repeat(3000)), undefined);
});

test("isImageKitUrl accepts our endpoint only, not a look-alike prefix or another scheme", () => {
  const saved = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
  process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/abc";
  try {
    assert.equal(isImageKitUrl("https://ik.imagekit.io/abc/resumes/x.pdf"), true);
    assert.equal(isImageKitUrl("https://ik.imagekit.io/abcd/resumes/x.pdf"), false);
    assert.equal(isImageKitUrl("http://ik.imagekit.io/abc/x.pdf"), false);
    assert.equal(isImageKitUrl("http://169.254.169.254/latest/meta-data/"), false);
    assert.equal(isImageKitUrl(undefined), false);
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT; else process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = saved;
  }
});

test("JsonLd escapes < so a string in the data can never close the script tag", () => {
  const el = JsonLd({ data: { name: "</script><script>alert(1)</script>", note: "line\u2028sep" } }) as { props: { dangerouslySetInnerHTML: { __html: string } } };
  const html = el.props.dangerouslySetInnerHTML.__html;
  assert.equal(html.includes("<"), false);
  assert.equal(html.includes("\u2028"), false);
  assert.deepEqual(JSON.parse(html), { name: "</script><script>alert(1)</script>", note: "line\u2028sep" }); // still valid JSON, same data
});
