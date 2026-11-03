import { NextRequest, NextResponse } from "next/server";
import { createCampusEntity } from "@/lib/campus/entities";
import { campusCreateSchema } from "@/lib/campus/validation";
import { isResponse, requireEmployer } from "@/lib/employer/access";
import { stripHtml } from "@/lib/employer/sanitize";
import { checkImageUrls } from "@/lib/employer/upload";
import { zodMessage } from "@/lib/employer/validation";
import { hit, RULES, tooManyRequests } from "@/lib/rateLimit";

export const runtime = "nodejs";

/** Create a college campus. The creator becomes its sole owner and gets the join code back (shown once more in settings). */
export async function POST(request: NextRequest) {
    try {
        const employer = await requireEmployer();
        if (isResponse(employer)) return employer;
        const limited = await hit("campus:create", String(employer._id), RULES.employerWrite);
        if (!limited.ok) return tooManyRequests(limited.retryAfter);

        const parsed = campusCreateSchema.safeParse(await request.json());
        if (!parsed.success) return NextResponse.json({ success: false, error: zodMessage(parsed.error) }, { status: 400 });
        const input = stripHtml(parsed.data);
        const imgErr = checkImageUrls(input);
        if (imgErr) return NextResponse.json({ success: false, error: imgErr }, { status: 400 });

        const result = await createCampusEntity(employer._id, input);
        if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
        const { entity } = result;
        return NextResponse.json({ success: true, data: { _id: String(entity._id), slug: entity.slug, joinCode: entity.joinCode } }, { status: 201 });
    } catch (error) {
        console.error("[employer/campus POST]", error);
        return NextResponse.json({ success: false, error: "Unable to create campus" }, { status: 500 });
    }
}
