import { NextRequest, NextResponse } from "next/server";
import { escapeRegex } from "@/lib/campus/validation";
import { isResponse, requireEmployer } from "@/lib/employer/access";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";
import College from "@/models/College";

export const runtime = "nodejs";

/** Autocomplete over the read-only `colleges` collection. Escaped, case-insensitive prefix/substring match, capped. */
export async function GET(request: NextRequest) {
    const employer = await requireEmployer();
    if (isResponse(employer)) return employer;
    const limited = await hit("campus:college-search", String(employer._id), RULES.campusRead);
    if (!limited.ok) return tooManyRequests(limited.retryAfter);

    const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
    if (q.length < 2) return NextResponse.json({ success: true, data: [] });
    const rows = await College.find({ name: { $regex: escapeRegex(q), $options: "i" } })
        .select("name state city")
        .sort({ name: 1 })
        .limit(10)
        .lean();
    return NextResponse.json({
        success: true,
        data: rows.map((r) => ({ _id: String(r._id), name: r.name, state: r.state ?? null, city: r.city ?? null })),
    });
}
