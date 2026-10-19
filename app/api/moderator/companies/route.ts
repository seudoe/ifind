import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import Company from "@/models/Company";
import PlatformInternship from "@/models/PlatformInternship";
import { COMPANY_RESTRICTIONS } from "@/types/employer";

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
        const status = sp.get("status") ?? "";

        const query: Record<string, unknown> = {};
        if (search) {
            const re = new RegExp(escapeRe(search), "i");
            query.$or = [{ name: re }, { legalName: re }, { contactEmail: re }, { industry: re }, { slug: re }];
        }
        if ((COMPANY_RESTRICTIONS as readonly string[]).includes(status)) {
            query["restriction.status"] = status === "none" ? { $in: ["none", null] } : status;
        }

        await connectDB();
        const [total, companies] = await Promise.all([
            Company.countDocuments(query),
            Company.find(query)
                .select("name slug logo industry size headquarters.city contactEmail verification.status restriction isActive members createdAt")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
        ]);

        const counts = await PlatformInternship.aggregate<{ _id: unknown; n: number }>([
            { $match: { companyId: { $in: companies.map((c) => c._id) } } },
            { $group: { _id: "$companyId", n: { $sum: 1 } } },
        ]);
        const byId = new Map(counts.map((c) => [String(c._id), c.n]));

        return NextResponse.json({
            success: true,
            data: companies.map(({ members, ...c }) => ({
                ...c,
                restriction: c.restriction ?? { status: "none" },
                memberCount: members?.length ?? 0,
                internshipCount: byId.get(String(c._id)) ?? 0,
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        console.error("[moderator/companies GET]", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
