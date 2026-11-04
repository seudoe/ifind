import test from "node:test";
import assert from "node:assert/strict";
import { keepMeta } from "../lib/resume/keepMeta";

const meta = (o: Record<string, unknown>) => ({ name: "", phone_no: "", email: "", gender: null, github_profile: null, linkedin: null, address: { city: "", state: null, country: "" }, extra_links: [], ...o });

test("a new resume keeps contact details and links it did not find, and fills what it did", () => {
    const old = { skills: [{ field: "Old" }], metaDetails: meta({ name: "Asif", phone_no: "+91 1", github_profile: "gh/a", linkedin: "li/a", address: { city: "Mumbai", state: "MH", country: "India" }, extra_links: [{ name: "CF", link: "cf.com/a" }] }) };
    const fresh = { skills: [{ field: "New" }], metaDetails: meta({ name: "Asif S", phone_no: "", github_profile: null, address: { city: "", state: null, country: "India" }, extra_links: [{ name: "Site", link: "a.dev" }] }) };
    const out = keepMeta(old as never, fresh as never) as unknown as { skills: { field: string }[]; metaDetails: ReturnType<typeof meta> & { address: { city: string; state: string } } };
    assert.deepEqual(out.skills, [{ field: "New" }]); // sections other than contact details are replaced wholesale
    assert.equal(out.metaDetails.name, "Asif S"); // available: updated
    assert.equal(out.metaDetails.phone_no, "+91 1"); // missing: kept
    assert.equal(out.metaDetails.github_profile, "gh/a");
    assert.equal(out.metaDetails.linkedin, "li/a");
    assert.equal(out.metaDetails.address.city, "Mumbai");
    assert.equal(out.metaDetails.address.state, "MH");
    assert.deepEqual(out.metaDetails.extra_links.map((l) => l.link), ["a.dev", "cf.com/a"]);
});

test("no previous resume, or no new data: returned unchanged", () => {
    const fresh = { skills: [], metaDetails: meta({ name: "X" }) };
    assert.equal(keepMeta(null, fresh as never), fresh);
    assert.equal(keepMeta({ metaDetails: meta({ name: "Y" }) } as never, null), null);
});
