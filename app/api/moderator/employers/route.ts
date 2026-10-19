import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import Employer from "@/models/Employer";
import Company from "@/models/Company";

export const runtime = "nodejs";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function GET(request: NextRequest) {
    try {
        const session = await getModSession();
        if (!session || !session.isVerified) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        const sp = request.nextUrl.searchParams;
        const rawPage = parseInt(sp.get("page") ?? "1", 10);
        const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
        const rawLimit = parseInt(sp.get("limit") ?? "20", 10);
        const limit = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 100);
        const search = sp.get("search")?.trim() ?? "";

        const query: Record<string, unknown> = {};
        if (search) {
            const re = new RegExp(escapeRe(search), "i");
            query.$or = [{ name: re }, { email: re }, { phone: re }, { designation: re }];
        }

        await connectDB();
        const [total, employers] = await Promise.all([
            Employer.countDocuments(query),
            Employer.find(query)
                .select("name email profilePicture phone designation isEmailVerified createdAt lastLoginAt isBanned bannedReason bannedAt")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
        ]);

        const ids = employers.map((e) => e._id);
        const counts = await Company.aggregate([
            { $match: { "members.employerId": { $in: ids } } },
            { $unwind: "$members" },
            { $match: { "members.employerId": { $in: ids } } },
            { $group: { _id: "$members.employerId", n: { $sum: 1 } } },
        ]);
        const byId = new Map(counts.map((c) => [String(c._id), c.n as number]));

        return NextResponse.json({
            success: true,
            data: employers.map((e) => ({ ...e, companyCount: byId.get(String(e._id)) ?? 0 })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error("[moderator/employers GET]", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
