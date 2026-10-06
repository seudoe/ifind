import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireCompanyRole, type CompanyAccess } from "@/lib/employer/access";
import { notify } from "@/lib/employer/notify";
import { memberSchema, zodMessage } from "@/lib/employer/validation";
import Employer from "@/models/Employer";
import { MEMBER_ROLES, ROLE_RANK } from "@/types/employer";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ companyId: string }> };

const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });
const ownerCount = (a: CompanyAccess) => a.company.members.filter((m) => m.role === "owner").length;
const canManage = (a: CompanyAccess) => ROLE_RANK[a.role] >= ROLE_RANK.admin;

export async function GET(_req: NextRequest, { params }: Ctx) {
    const access = await requireCompanyRole((await params).companyId, "recruiter");
    if (isResponse(access)) return access;
    const people = await Employer.find({ _id: { $in: access.company.members.map((m) => m.employerId) } }).select("name email profilePicture").lean();
    const data = access.company.members.map((m) => {
        const p = people.find((e) => String(e._id) === String(m.employerId));
        return {
            employerId: String(m.employerId),
            role: m.role,
            addedAt: m.addedAt.toISOString(),
            name: p?.name ?? "Unknown",
            email: p?.email ?? "",
            profilePicture: p?.profilePicture ?? null,
        };
    });
    return NextResponse.json({ success: true, data, myRole: access.role, myId: String(access.employer._id) });
}

/** Add an existing employer by email. admin+; only owners can add owners. */
export async function POST(request: NextRequest, { params }: Ctx) {
    try {
        const access = await requireCompanyRole((await params).companyId, "admin");
        if (isResponse(access)) return access;

        const parsed = memberSchema.safeParse(await request.json());
        if (!parsed.success) return fail(zodMessage(parsed.error), 400);
        const { email, role } = parsed.data;
        if (role === "owner" && access.role !== "owner") return fail("Only owners can add owners", 403);

        const target = await Employer.findOne({ email, isBanned: false, "deleteDetails.deleted": { $ne: true } });
        if (!target) return fail("No employer account with that email. Ask them to register first.", 404);
        if (access.company.members.some((m) => m.employerId.equals(target._id))) return fail("Already a member of this company", 409);

        access.company.members.push({ employerId: target._id, role, addedBy: access.employer._id, addedAt: new Date() });
        await access.company.save();
        await notify({
            recipientType: "employer",
            recipientIds: [target._id],
            type: "company_member_added",
            title: `You were added to ${access.company.name}`,
            body: `${access.employer.name} added you as ${role}.`,
            link: `/employer/company/${String(access.company._id)}/overview`,
            companyId: access.company._id,
        });
        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        console.error("[employer/members POST]", error);
        return fail("Unable to add member", 500);
    }
}

/** Change a member's role. Body: { employerId, role }. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
    try {
        const access = await requireCompanyRole((await params).companyId, "admin");
        if (isResponse(access)) return access;

        const body = await request.json();
        const role = body.role;
        if (!MEMBER_ROLES.includes(role) || !mongoose.isValidObjectId(body.employerId)) return fail("employerId and a valid role are required", 400);

        const member = access.company.members.find((m) => m.employerId.equals(body.employerId));
        if (!member) return fail("Member not found", 404);
        if ((member.role === "owner" || role === "owner") && access.role !== "owner") return fail("Only owners can change owner roles", 403);
        if (member.role === "owner" && role !== "owner" && ownerCount(access) <= 1) return fail("A company needs at least one owner", 400);

        member.role = role;
        await access.company.save();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[employer/members PATCH]", error);
        return fail("Unable to change role", 500);
    }
}

/** Remove a member (?employerId=). Anyone may leave; removing others needs admin+, and owners need an owner. */
export async function DELETE(request: NextRequest, { params }: Ctx) {
    try {
        const access = await requireCompanyRole((await params).companyId, "recruiter");
        if (isResponse(access)) return access;

        const id = request.nextUrl.searchParams.get("employerId") ?? "";
        if (!mongoose.isValidObjectId(id)) return fail("employerId required", 400);
        const member = access.company.members.find((m) => m.employerId.equals(id));
        if (!member) return fail("Member not found", 404);

        const self = member.employerId.equals(access.employer._id);
        if (!self) {
            if (!canManage(access)) return fail("You don't have permission to do this", 403);
            if (member.role === "owner" && access.role !== "owner") return fail("Only owners can remove owners", 403);
        }
        if (member.role === "owner" && ownerCount(access) <= 1) return fail("A company needs at least one owner", 400);

        access.company.members = access.company.members.filter((m) => !m.employerId.equals(id)) as typeof access.company.members;
        await access.company.save();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[employer/members DELETE]", error);
        return fail("Unable to remove member", 500);
    }
}
