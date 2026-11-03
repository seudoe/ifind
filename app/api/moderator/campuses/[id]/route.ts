import { NextRequest, NextResponse } from "next/server";
import { campusModerationDetail, moderateCampus, type ModAction } from "@/lib/campus/moderation";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Full record: staff, who reported it and why, history, counts. Moderators only. */
export async function GET(_req: NextRequest, { params }: Ctx) {
    try {
        const session = await getModSession();
        if (!session || !session.isVerified) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        await connectDB();
        const data = await campusModerationDetail((await params).id);
        return data ? NextResponse.json({ success: true, data }) : NextResponse.json({ success: false, error: "Campus not found" }, { status: 404 });
    } catch (error) {
        console.error("[moderator/campuses/[id] GET]", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

/** Body: { action: "restrict" | "ban" | "lift", reason }. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
    try {
        const session = await getModSession();
        if (!session || !session.isVerified) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        const body = await request.json().catch(() => null);
        const action = body?.action;
        if (!["restrict", "ban", "lift"].includes(action)) return NextResponse.json({ success: false, error: 'Action must be "restrict", "ban" or "lift".' }, { status: 400 });
        await connectDB();
        const r = await moderateCampus((await params).id, action as ModAction, typeof body.reason === "string" ? body.reason : "", { id: session.moderatorId, name: session.name });
        return r.ok
            ? NextResponse.json({ success: true, data: { status: r.status, studentsDetached: r.studentsDetached } })
            : NextResponse.json({ success: false, error: r.error, code: r.code }, { status: r.status });
    } catch (error) {
        console.error("[moderator/campuses/[id] PATCH]", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
