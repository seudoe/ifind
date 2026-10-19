import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import Employer from "@/models/Employer";
import Company from "@/models/Company";
import PlatformInternship from "@/models/PlatformInternship";
import BanEvent from "@/models/BanEvent";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Full employer record: profile, companies they belong to, internships they posted, ban history. */
export async function GET(_req: NextRequest, { params }: Ctx) {
    try {
        const session = await getModSession();
        if (!session || !session.isVerified) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
        const { id } = await params;
        if (!isValidObjectId(id)) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

        await connectDB();
        const employer = await Employer.findById(id).lean();
        if (!employer) return NextResponse.json({ success: false, error: "Employer not found" }, { status: 404 });

        const [companies, internships, banHistory] = await Promise.all([
            Company.find({ "members.employerId": id })
                .select("name slug industry size headquarters.city verification.status isActive members")
                .lean(),
            PlatformInternship.find({ postedBy: id }).select("name status createdAt").sort({ createdAt: -1 }).limit(50).lean(),
            BanEvent.find({ userId: id, targetType: "employer" }).sort({ at: -1 }).limit(50).lean(),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                employer,
                companies: companies.map((c) => ({
                    _id: c._id,
                    name: c.name,
                    slug: c.slug,
                    industry: c.industry,
                    size: c.size,
                    city: c.headquarters?.city,
                    verification: c.verification?.status,
                    isActive: c.isActive,
                    role: c.members.find((m) => String(m.employerId) === id)?.role,
                })),
                internships,
                banHistory,
            },
        });
    } catch (error) {
        console.error("[moderator/employers/[id] GET]", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

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

        if (action !== "ban" && action !== "unban") {
            return NextResponse.json({ success: false, error: 'Action must be "ban" or "unban".' }, { status: 400 });
        }
        if (action === "ban" && !reason) {
            return NextResponse.json({ success: false, error: "A non-empty reason is required when banning." }, { status: 400 });
        }

        await connectDB();
        const now = new Date();
        const set =
            action === "ban"
                ? { isBanned: true, bannedReason: reason, bannedBy: session.moderatorId, bannedAt: now }
                : { isBanned: false, bannedReason: null, bannedBy: null, bannedAt: null };
        const result = await Employer.updateOne({ _id: id }, { $set: set });
        if (!result.matchedCount) return NextResponse.json({ success: false, error: "Employer not found" }, { status: 404 });

        try {
            await BanEvent.create({
                userId: id,
                targetType: "employer",
                action,
                reason: reason || null,
                moderatorId: session.moderatorId,
                moderatorName: session.name,
                at: now,
            });
        } catch (e) {
            console.error("[moderator/employers/[id] PATCH] could not write ban history", e);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[moderator/employers/[id] PATCH]", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
