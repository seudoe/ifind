import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import Company from "@/models/Company";
import Employer from "@/models/Employer";
import PlatformInternship from "@/models/PlatformInternship";
import BanEvent from "@/models/BanEvent";
import Application from "@/models/Application";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Full company record: profile, members, internships, application count, restriction history. */
export async function GET(_req: NextRequest, { params }: Ctx) {
    try {
        const session = await getModSession();
        if (!session || !session.isVerified) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
        const { id } = await params;
        if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

        await connectDB();
        const company = await Company.findById(id).lean();
        if (!company) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });

        const [employers, internships, applications, history] = await Promise.all([
            Employer.find({ _id: { $in: company.members.map((m) => m.employerId) } }).select("name email isBanned").lean(),
            PlatformInternship.find({ companyId: id })
                .select("name status isActive bannedByCompany moderation.status createdAt")
                .sort({ createdAt: -1 })
                .limit(100)
                .lean(),
            Application.countDocuments({ companyId: id }),
            BanEvent.find({ userId: id, targetType: "company" }).sort({ at: -1 }).limit(50).lean(),
        ]);

        const byId = new Map(employers.map((e) => [String(e._id), e]));
        return NextResponse.json({
            success: true,
            data: {
                company: { ...company, restriction: company.restriction ?? { status: "none" } },
                members: company.members.map((m) => ({
                    employerId: String(m.employerId),
                    role: m.role,
                    name: byId.get(String(m.employerId))?.name ?? "(deleted)",
                    email: byId.get(String(m.employerId))?.email ?? "",
                    isBanned: byId.get(String(m.employerId))?.isBanned ?? false,
                })),
                internships,
                applications,
                history,
            },
        });
    } catch (error) {
        console.error("[moderator/companies/[id] GET]", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

/**
 * action: restrict | ban | lift
 *  restrict  no new internships (create/publish blocked) until lifted; existing ones stay live
 *  ban       restrict + every live internship is pulled (isActive=false, bannedByCompany=true)
 *  lift      back to normal; internships pulled by the ban come back, others are untouched
 */
export async function PATCH(request: NextRequest, { params }: Ctx) {
    try {
        const session = await getModSession();
        if (!session || !session.isVerified) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
        const { id } = await params;
        if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

        const body = await request.json();
        const action = typeof body.action === "string" ? body.action : "";
        const reason = typeof body.reason === "string" ? body.reason.trim() : "";

        if (!["restrict", "ban", "lift"].includes(action)) {
            return NextResponse.json({ success: false, error: 'Action must be "restrict", "ban" or "lift".' }, { status: 400 });
        }
        if (action !== "lift" && !reason) {
            return NextResponse.json({ success: false, error: "A reason is required." }, { status: 400 });
        }

        await connectDB();
        const company = await Company.findById(id).select("restriction");
        if (!company) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });

        const now = new Date();
        const status = action === "lift" ? "none" : action === "ban" ? "banned" : "restricted";
        const wasBanned = company.restriction?.status === "banned";

        await Company.updateOne(
            { _id: id },
            {
                $set: {
                    restriction:
                        status === "none"
                            ? { status, reason: null, by: null, at: null }
                            : { status, reason, by: session.moderatorId, at: now },
                },
            },
            { strict: false },
        );

        let affected = 0;
        if (status === "banned") {
            const r = await PlatformInternship.updateMany(
                { companyId: id, isActive: { $ne: false } },
                { $set: { isActive: false, bannedByCompany: true } },
            );
            affected = r.modifiedCount;
        } else if (wasBanned) {
            // Leaving "banned" (lift, or downgrade to restricted): give back what the ban took.
            const r = await PlatformInternship.updateMany(
                { companyId: id, bannedByCompany: true },
                { $set: { isActive: true, bannedByCompany: false } },
            );
            affected = r.modifiedCount;
        }

        try {
            await BanEvent.create({
                userId: id,
                targetType: "company",
                action: status === "none" ? "unban" : "ban",
                reason: status === "none" ? reason || null : `[${status}] ${reason}`,
                moderatorId: session.moderatorId,
                moderatorName: session.name,
                at: now,
            });
        } catch (e) {
            console.error("[moderator/companies/[id] PATCH] could not write history", e);
        }

        return NextResponse.json({ success: true, data: { status, internshipsAffected: affected } });
    } catch (error) {
        console.error("[moderator/companies/[id] PATCH]", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
