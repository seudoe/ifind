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
