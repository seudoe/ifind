import { NextRequest, NextResponse } from "next/server";
import { limitCampusWrite, requireCampusRole } from "@/lib/campus/access";
import { closeCampusEntity } from "@/lib/campus/deletion";
import { updateCampusProfile } from "@/lib/campus/entities";
import { campusProfileSchema } from "@/lib/campus/validation";
import { isResponse } from "@/lib/employer/access";
import { notify } from "@/lib/employer/notify";
import { stripHtml } from "@/lib/employer/sanitize";
import { checkImageUrls } from "@/lib/employer/upload";
import { zodMessage } from "@/lib/employer/validation";
import { roleAtLeast } from "@/lib/campus/access";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ entityId: string }> };

/** Viewer and up. The join code is only included for admins and owners. */
export async function GET(_req: NextRequest, { params }: Ctx) {
    const access = await requireCampusRole((await params).entityId, "viewer");
    if (isResponse(access)) return access;
    const { entity, role } = access;
    const data = JSON.parse(JSON.stringify(entity.toObject()));
    if (!roleAtLeast(role, "admin")) delete data.joinCode;
    return NextResponse.json({ success: true, data: { ...data, myRole: role } });
}

/** Edit the profile: admin and owner. College, slug, code, members and restriction are never editable here. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
    try {
        const access = await requireCampusRole((await params).entityId, "admin");
        if (isResponse(access)) return access;
        const limited = await limitCampusWrite(access.employer._id);
        if (limited) return limited;

        const parsed = campusProfileSchema.safeParse(await request.json());
        if (!parsed.success) return NextResponse.json({ success: false, error: zodMessage(parsed.error) }, { status: 400 });
        const input = stripHtml(parsed.data);
        const imgErr = checkImageUrls(input);
        if (imgErr) return NextResponse.json({ success: false, error: imgErr }, { status: 400 });

        await updateCampusProfile(access.entity, input);
        return NextResponse.json({ success: true, data: { _id: String(access.entity._id) } });
    } catch (error) {
        console.error("[employer/campus PATCH]", error);
        return NextResponse.json({ success: false, error: "Unable to update campus" }, { status: 500 });
    }
}

/** Owner of THIS campus only. Closes its internships, withdraws active applications, detaches and notifies students. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
    try {
        const access = await requireCampusRole((await params).entityId, "owner");
        if (isResponse(access)) return access;
        const limited = await limitCampusWrite(access.employer._id);
        if (limited) return limited;
        const { entity, employer } = access;
        const result = await closeCampusEntity(entity, "deleted");
        if (!result.closed) return NextResponse.json({ success: false, error: "Campus not found" }, { status: 404 });
        const others = entity.members.filter((m) => !m.employerId.equals(employer._id)).map((m) => m.employerId);
        await notify({
            recipientType: "employer", recipientIds: others, type: "campus_member_removed", priority: "normal",
            title: `${entity.name} was deleted`, body: `${employer.name} deleted the campus.`,
        });
        return NextResponse.json({ success: true, data: { students: result.students, withdrawn: result.withdrawn } });
    } catch (error) {
        console.error("[employer/campus DELETE]", error);
        return NextResponse.json({ success: false, error: "Unable to delete campus" }, { status: 500 });
    }
}
