import test from "node:test";
import assert from "node:assert/strict";
import { hasBothMethods, linkedinReauthDue, linkedinReauthDueAt, linkedinState } from "../lib/linkedinState";

const DAY = 86_400_000;
const now = Date.now();
const ago = (days: number) => new Date(now - days * DAY);

test("three states: normal, connected, verified", () => {
    assert.equal(linkedinState({}), "normal");
    assert.equal(linkedinState({ linkedinId: "x", linkedinDetails: { email_verified: false } }), "connected");
    assert.equal(linkedinState({ linkedinId: "x", linkedinDetails: {} }), "connected");
    assert.equal(linkedinState({ linkedinId: "x", linkedinDetails: { email_verified: true } }), "verified");
});

test("the monthly LinkedIn sign-in applies only to accounts with both a password and LinkedIn", () => {
    assert.equal(hasBothMethods({ linkedinId: "x", hasPassword: true }), true);
    for (const only of [{ linkedinId: "x", hasPassword: false }, { hasPassword: true }, {}]) {
        assert.equal(linkedinReauthDueAt({ ...only, linkedinLastAuthAt: ago(400) }), null);
        assert.equal(linkedinReauthDue({ ...only, linkedinLastAuthAt: ago(400) }, now), false);
    }
});

test("due 30 days after the last LinkedIn sign-in; the password works until then", () => {
    const base = { linkedinId: "x", hasPassword: true };
    assert.equal(linkedinReauthDue({ ...base, linkedinLastAuthAt: ago(29) }, now), false);
    assert.equal(linkedinReauthDue({ ...base, linkedinLastAuthAt: ago(31) }, now), true);
    assert.equal(linkedinReauthDueAt({ ...base, linkedinLastAuthAt: ago(10) })!.getTime(), ago(10).getTime() + 30 * DAY);
    // falls back to the link time, and to "not due" when nothing was ever recorded
    assert.equal(linkedinReauthDue({ ...base, linkedinLastAuthAt: null, linkedinLinkedAt: ago(45) }, now), true);
    assert.equal(linkedinReauthDue({ ...base }, now), false);
});
