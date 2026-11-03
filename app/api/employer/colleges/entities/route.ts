import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { otherCampusesOfCollege } from "@/lib/campus/entities";
import { isResponse, requireEmployer } from "@/lib/employer/access";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";

export const runtime = "nodejs";

/** Existing listed campuses of a college, shown as a warning (not a block) when someone creates another. No join codes. */
export async function GET(request: NextRequest) {
    const employer = await requireEmployer();
    if (isResponse(employer)) return employer;
    const limited = await hit("campus:college-entities", String(employer._id), RULES.campusRead);
    if (!limited.ok) return tooManyRequests(limited.retryAfter);

    const collegeId = request.nextUrl.searchParams.get("collegeId") ?? "";
    if (!mongoose.isValidObjectId(collegeId)) return NextResponse.json({ success: false, error: "Invalid college" }, { status: 400 });
    return NextResponse.json({ success: true, data: await otherCampusesOfCollege(collegeId) });
}
