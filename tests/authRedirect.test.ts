import test from "node:test";
import assert from "node:assert/strict";
import { applyHref, resolveNext, safeNextPath } from "../lib/authRedirect";
import { idFromSlug, internshipSlug } from "../lib/slug";

const ID = "6a75d79a1898fe4189af57bb";

test("slug round-trips to the internship id", () => {
  const slug = internshipSlug({ name: "Frontend Dev (React)", company: "Acme & Co.", _id: ID });
  assert.equal(slug, `frontend-dev-react-acme-co-${ID}`);
  assert.equal(idFromSlug(slug), ID);
  assert.equal(idFromSlug(ID), ID);
  assert.equal(idFromSlug("not-an-id"), null);
});

test("post-login path: only same-site student paths are accepted", () => {
  assert.equal(safeNextPath("/user/:username/browse/x"), "/user/:username/browse/x");
  for (const bad of ["https://evil.example", "//evil.example", "/\evil", "/employer/companies", "/user/login", "/user/register?next=1", "javascript:alert(1)", "", null, undefined, "/user/" + "a".repeat(400)]) {
    assert.equal(safeNextPath(bad as string | null | undefined), null, String(bad));
  }
});

test("resolveNext fills in the username and falls back to the dashboard", () => {
  assert.equal(resolveNext(applyHref(`x-${ID}`), "rahul"), `/user/rahul/browse/x-${ID}`);
  assert.equal(resolveNext("https://evil.example", "rahul"), "/user/rahul/overview");
  assert.equal(resolveNext(null, "rahul"), "/user/rahul/overview");
});
