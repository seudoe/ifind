import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Static guard for the campus API surface: every route has an authentication guard, runs on Node, never takes the campus
 * from client input on staff routes, rate-limits writes, and logs no personal data. A new route that forgets one of these
 * fails this test instead of shipping.
 */
const ROOT = join(process.cwd(), "app", "api");

function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (name === "route.ts") out.push(p);
    }
    return out;
}

const norm = (p: string) => relative(ROOT, p).replace(/\\/g, "/");
const all = walk(ROOT).map((p) => ({ path: norm(p), src: readFileSync(p, "utf8").replace(/\r\n/g, "\n") }));
const campus = all.filter((r) => /(^|\/)campus|^employer\/(institutes|colleges)|^cron\/campus|^moderator\/campuses/.test(r.path));
const exportsMethod = (src: string, m: string) => new RegExp(`export (async function ${m}\\b|const ${m}\\b)`).test(src);
const mutates = (src: string) => ["POST", "PATCH", "PUT", "DELETE"].some((m) => exportsMethod(src, m));

test("the audit sees the campus routes", () => {
    assert.ok(campus.length >= 40, `only ${campus.length} routes found`);
});

test("every campus route authenticates and runs on Node", () => {
    const guard = /requireCampusRole|requireStudent|requireEmployer|getModSession|CRON_SECRET|withBilling/;
    for (const r of campus) {
        assert.match(r.src, guard, `${r.path}: no authentication guard`);
        assert.match(r.src, /export const runtime = "nodejs"/, `${r.path}: missing runtime = "nodejs"`);
    }
});

test("staff routes: the campus comes from the verified membership, never from the request", () => {
    for (const r of campus.filter((x) => x.path.startsWith("employer/campus/[entityId]/"))) {
        assert.match(r.src, /requireCampusRole\(/, `${r.path}: staff route without requireCampusRole`);
        assert.doesNotMatch(r.src, /body\??\.entityId|searchParams\.get\("entityId"\)|json\(\)\)?\.entityId/, `${r.path}: reads entityId from client input`);
    }
});

test("staff routes that change things need coordinator or higher (leaving the team is the one viewer action)", () => {
    for (const r of campus.filter((x) => x.path.startsWith("employer/campus/[entityId]/") && mutates(x.src))) {
        const hasHigher = /requireCampusRole\(.*"(coordinator|admin|owner)"/.test(r.src);
        assert.ok(hasHigher, `${r.path}: mutating route with no coordinator/admin/owner guard`);
    }
    // members: DELETE is open to viewers only so anyone can leave; the handler checks teamChangeError for everything else
    const members = all.find((r) => r.path === "employer/campus/[entityId]/members/route.ts")!;
    assert.match(members.src, /teamChangeError/);
});

test("every write handler is rate limited (checked per handler, not per file)", () => {
    const limiter = /limitCampusWrite|limitStudentWrite|hit\(|withBilling|CRON_SECRET|getModSession/;
    const offenders: string[] = [];
    let examined = 0;
    for (const r of campus) {
        const chunks = r.src.split(/\nexport (?=async function|const)/).slice(1);
        for (const c of chunks) {
            const m = /^(?:async function (POST|PATCH|PUT|DELETE)\b|const (POST|PATCH|PUT|DELETE)\b)/.exec(c);
            if (m) examined++;
            if (m && !limiter.test(c)) offenders.push(`${r.path} ${m[1] ?? m[2]}`);
        }
    }
    assert.ok(examined >= 25, `only ${examined} write handlers examined`);
    assert.deepEqual(offenders, []);
});

test("join codes are brute-force limited on both routes that accept them", () => {
    for (const p of ["user/campus/entities/join/route.ts", "user/campus/entities/lookup/route.ts"]) {
        const src = all.find((r) => r.path === p)!.src;
        assert.match(src, /campusJoinCodeUser/, p);
        assert.match(src, /campusJoinCodeIp/, p);
    }
});

test("student routes never take the campus from the request except join and lookup (which resolve it server-side)", () => {
    for (const r of campus.filter((x) => x.path.startsWith("user/campus/"))) {
        if (/entities\/(join|lookup)\//.test(r.path)) continue;
        assert.doesNotMatch(r.src, /body\??\.entityId|searchParams\.get\("entityId"\)/, `${r.path}: takes entityId from the client`);
    }
});

test("no console.log, and no personal data in log calls", () => {
    for (const r of campus) {
        assert.doesNotMatch(r.src, /console\.log\(/, `${r.path}: console.log`);
        for (const line of r.src.split("\n").filter((l) => /log\.(info|warn|error)\(|console\.(error|warn)\(/.test(l))) {
            assert.doesNotMatch(line, /\b(email|phone|password|token|joinCode|collegeUid|\.name)\b/, `${r.path}: possible PII in log: ${line.trim()}`);
        }
    }
});

test("the join code is never returned by student-facing routes", () => {
    for (const r of campus.filter((x) => x.path.startsWith("user/campus/"))) {
        assert.doesNotMatch(r.src, /joinCode/, `${r.path}: mentions joinCode`);
    }
});

test("moderator routes require a verified moderator", () => {
    for (const r of campus.filter((x) => x.path.startsWith("moderator/campuses"))) {
        assert.match(r.src, /getModSession/);
        assert.match(r.src, /isVerified/);
    }
});
