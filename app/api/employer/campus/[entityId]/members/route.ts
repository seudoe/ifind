import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireCampusRole, type CampusAccess } from "@/lib/campus/access";
import { staffAddedMessage, staffRemovedMessage } from "@/lib/campus/messages";
import { notifyCollege } from "@/lib/campus/notify";
import { sendToStaff } from "@/lib/campus/outbound";
import { addMember, MAX_CAMPUS_MEMBERS, removeMember, setMemberRole, teamChangeError } from "@/lib/campus/team";
import { isResponse } from "@/lib/employer/access";
import { notify } from "@/lib/employer/notify";
import Employer from "@/models/Employer";
import { CAMPUS_ROLES } from "@/types/campus";
import { z } from "zod";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ entityId: string }> };

const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });
const link = (a: CampusAccess, tail = "overview") => `/employer/campus/${String(a.entity._id)}/${tail}`;
const addSchema = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(CAMPUS_ROLES) });

/** Everyone on the team can see it (names and emails of colleagues). */
export async function GET(_req: NextRequest, { params }: Ctx) {
    const access = await requireCampusRole((await params).entityId, "viewer");
    if (isResponse(access)) return access;
    const people = await Employer.find({ _id: { $in: access.entity.members.map((m) => m.employerId) } }).select("name email profilePicture").lean();
    const data = access.entity.members.map((m) => {
        const p = people.find((e) => String(e._id) === String(m.employerId));
        return { employerId: String(m.employerId), role: m.role, addedAt: m.addedAt.toISOString(), name: p?.name ?? "Unknown", email: p?.email ?? "", profilePicture: p?.profilePicture ?? null };
    });
    return NextResponse.json({ success: true, data, myRole: access.role, myId: String(access.employer._id) });
}

/** Add an existing employer by email. admin+; only owners can add owners. */
export async function POST(request: NextRequest, { params }: Ctx) {
    try {
        const access = await requireCampusRole((await params).entityId, "admin");
        if (isResponse(access)) return access;
        const parsed = addSchema.safeParse(await request.json());
        if (!parsed.success) return fail("A valid email and role are required", 400);
        const { email, role } = parsed.data;
        const denied = teamChangeError(access.role, null, role, false);
        if (denied) return fail(denied, 403);
        if (access.entity.members.length >= MAX_CAMPUS_MEMBERS) return fail(`A campus can have at most ${MAX_CAMPUS_MEMBERS} staff`, 400);

        const target = await Employer.findOne({ email, isBanned: false, "deleteDetails.deleted": { $ne: true } });
        if (!target) return fail("No employer account with that email. Ask them to register first.", 404);
        if (!(await addMember(access.entity._id, target._id, role, access.employer._id))) return fail("Already a member of this campus", 409);

        const name = access.entity.name;
        await notify({
            recipientType: "employer", recipientIds: [target._id], type: "campus_member_added", priority: "normal",
            title: `You were added to ${name}`, body: `${access.employer.name} added you as ${role}.`, link: link(access),
        });
        await notifyCollege({
            entityId: access.entity._id, type: "campus_member_added", title: `${target.name} joined the team`,
            body: `Added as ${role} by ${access.employer.name}.`, link: link(access, "team"),
            actor: { kind: "employer", id: access.employer._id, name: access.employer.name },
        });
        await sendToStaff([{ id: String(target._id), email: target.email, name: target.name }], () => staffAddedMessage({ entityName: name, role, link: link(access) }),
            { email: true, kind: "staff-added", refId: String(access.entity._id), version: `${target._id}:${role}`, defer: true });
        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        console.error("[employer/campus/members POST]", error);
        return fail("Unable to add member", 500);
    }
}

/** Change a member's role. Body: { employerId, role }. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
    try {
        const access = await requireCampusRole((await params).entityId, "admin");
        if (isResponse(access)) return access;
        const body = await request.json();
        if (!CAMPUS_ROLES.includes(body.role) || !mongoose.isValidObjectId(body.employerId)) return fail("employerId and a valid role are required", 400);

        const member = access.entity.members.find((m) => m.employerId.equals(body.employerId));
        if (!member) return fail("Member not found", 404);
        const self = member.employerId.equals(access.employer._id);
        const denied = teamChangeError(access.role, member.role, body.role, self);
        if (denied) return fail(denied, 403);
        if (member.role === body.role) return NextResponse.json({ success: true });
        if (!(await setMemberRole(access.entity._id, member.employerId, body.role, member.role === "owner"))) return fail("A campus needs at least one owner", 400);

        const person = await Employer.findById(body.employerId).select("name").lean();
        await notify({
            recipientType: "employer", recipientIds: [body.employerId], type: "campus_member_role", priority: "normal",
            title: `Your role at ${access.entity.name} changed`, body: `${access.employer.name} changed it from ${member.role} to ${body.role}.`, link: link(access),
        });
        await notifyCollege({
            entityId: access.entity._id, type: "campus_member_role", title: `${person?.name ?? "A teammate"} is now ${body.role}`,
            body: `Role changed from ${member.role} by ${access.employer.name}.`, link: link(access, "team"),
            actor: { kind: "employer", id: access.employer._id, name: access.employer.name },
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[employer/campus/members PATCH]", error);
        return fail("Unable to change role", 500);
    }
}

/** Remove a member (?employerId=). Anyone may leave; removing others needs admin+, and owners need an owner. */
export async function DELETE(request: NextRequest, { params }: Ctx) {
    try {
        const access = await requireCampusRole((await params).entityId, "viewer");
        if (isResponse(access)) return access;
        const id = request.nextUrl.searchParams.get("employerId") ?? "";
        if (!mongoose.isValidObjectId(id)) return fail("employerId required", 400);
        const member = access.entity.members.find((m) => m.employerId.equals(id));
        if (!member) return fail("Member not found", 404);
        const self = member.employerId.equals(access.employer._id);
        const denied = teamChangeError(access.role, member.role, null, self);
        if (denied) return fail(denied, 403);
        if (!(await removeMember(access.entity._id, id, member.role === "owner"))) return fail("A campus needs at least one owner", 400);

        const person = await Employer.findById(id).select("name email").lean();
        await notifyCollege({
            entityId: access.entity._id, type: "campus_member_removed",
            title: self ? `${person?.name ?? "A teammate"} left the team` : `${person?.name ?? "A teammate"} was removed from the team`,
            body: self ? undefined : `Removed by ${access.employer.name}.`, link: link(access, "team"),
            actor: { kind: "employer", id: access.employer._id, name: access.employer.name },
        });
        if (!self) {
            await notify({
                recipientType: "employer", recipientIds: [id], type: "campus_member_removed", priority: "normal",
                title: `You were removed from ${access.entity.name}`, body: `${access.employer.name} removed you from the team.`,
            });
            if (person?.email) {
                await sendToStaff([{ id, email: person.email, name: person.name }], () => staffRemovedMessage({ entityName: access.entity.name }),
                    { email: true, kind: "staff-removed", refId: String(access.entity._id), version: id, defer: true });
            }
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[employer/campus/members DELETE]", error);
        return fail("Unable to remove member", 500);
    }
}
