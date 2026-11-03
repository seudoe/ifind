import { NextResponse } from "next/server";
import { listInstitutes } from "@/lib/campus/entities";
import { isResponse, requireEmployer } from "@/lib/employer/access";

export const runtime = "nodejs";

/** Companies and college campuses the employer belongs to, newest first. */
export async function GET() {
    const employer = await requireEmployer();
    if (isResponse(employer)) return employer;
    const rows = await listInstitutes(employer._id);
    return NextResponse.json({ success: true, data: rows });
}
