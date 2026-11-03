import { NextRequest, NextResponse } from "next/server";
import { requireStudent } from "@/lib/campus/studentAuth";
import { loadCampusApplication } from "@/lib/campus/studentApplications";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const me = await requireStudent();
    if (me instanceof NextResponse) return me;
    const data = await loadCampusApplication(me.userId, (await params).id);
    return data ? NextResponse.json({ success: true, data }) : NextResponse.json({ success: false, error: "Application not found" }, { status: 404 });
}
