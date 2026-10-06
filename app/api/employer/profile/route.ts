import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isResponse, requireEmployer } from "@/lib/employer/access";
import { zodMessage } from "@/lib/employer/validation";

export const runtime = "nodejs";

const profileSchema = z.object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: z.string().trim().max(20).nullable().optional(),
    designation: z.string().trim().max(80).nullable().optional(),
    profilePicture: z
        .string().trim().max(500).url().refine((u) => /^https?:\/\//i.test(u), "Must be an http(s) URL")
        .nullable().optional(),
});

function dto(e: { _id: unknown; name: string; email: string; phone?: string | null; designation?: string | null; profilePicture?: string | null }) {
    return { _id: String(e._id), name: e.name, email: e.email, phone: e.phone ?? null, designation: e.designation ?? null, profilePicture: e.profilePicture ?? null };
}

export async function GET() {
    const employer = await requireEmployer();
    if (isResponse(employer)) return employer;
    return NextResponse.json({ success: true, data: dto(employer) });
}

export async function PATCH(request: NextRequest) {
    try {
        const employer = await requireEmployer();
        if (isResponse(employer)) return employer;

        const parsed = profileSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ success: false, error: zodMessage(parsed.error) }, { status: 400 });
        }
        for (const [k, v] of Object.entries(parsed.data)) {
            if (v === undefined) continue;
            (employer as unknown as Record<string, unknown>)[k] = v === "" ? null : v;
        }
        await employer.save();
        return NextResponse.json({ success: true, data: dto(employer) });
    } catch (error) {
        console.error("[employer/profile PATCH]", error);
        return NextResponse.json({ success: false, error: "Unable to update profile" }, { status: 500 });
    }
}
