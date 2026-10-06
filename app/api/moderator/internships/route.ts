import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import Internship, { StagedInternship } from "@/models/Internship";
import Company from "@/models/Company";
import PlatformInternship from "@/models/PlatformInternship";

export const runtime = "nodejs";

// Approved listings leave staging (they are vectorized and moved to `internships`),
// so only these statuses are read from the live collection.
const PUBLISHED_STATUSES = ["auto_approved", "manually_approved"];

export async function GET(request: NextRequest) {
    try {
        const session = await getModSession();
        if (!session || !session.isVerified) {
            return NextResponse.json(
                { success: false, error: "Forbidden" },
                { status: 403 },
            );
        }

        const { searchParams } = request.nextUrl;

        // Validate and default status
        const status = searchParams.get("status") ?? "pending_review";

        // Validate and default page (min 1)
        const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
        const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

        // Validate and default limit (1–100, default 20)
        const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
        const limit =
            isNaN(rawLimit) || rawLimit < 1
                ? 20
                : rawLimit > 100
                  ? 100
                  : rawLimit;

        // Optional search string (escaped: it is user input going into a RegExp)
        const search = searchParams.get("search")?.trim() ?? "";

        // Build query on moderation.status
        const query: Record<string, unknown> = {
            "moderation.status": status,
        };

        // Add case-insensitive regex on name and company when search provided
        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            query.$or = [{ name: regex }, { company: regex }];
        }

        await connectDB();

        const skip = (page - 1) * limit;

        // Employer-posted listings live in their own collection; drafts are never moderated
        if (searchParams.get("source") === "employer") {
            query.status = { $ne: "draft" };
            const [total, rows] = await Promise.all([
                PlatformInternship.countDocuments(query),
                PlatformInternship.find(query)
                    .select("name company companyId applyLink datePublished source moderation summary skills createdAt")
                    .sort({ datePublished: 1 }) // oldest first: fair review order
                    .skip(skip)
                    .limit(limit)
                    .lean(),
            ]);
            const companies = await Company.find({ _id: { $in: rows.map((r) => r.companyId) } }).select("verification.status").lean();
            const data = rows.map((r) => ({
                _id: r._id,
                name: r.name,
                company: r.company,
                applyLink: r.applyLink ?? null,
                datePublished: r.datePublished,
                source: "employer",
                moderation: r.moderation,
                createdAt: r.createdAt,
                priority: 0,
                employer: {
                    companyVerified: companies.find((c) => String(c._id) === String(r.companyId))?.verification?.status === "verified",
                    summary: (r.summary ?? "").slice(0, 400),
                    skills: r.skills ?? [],
                },
            }));
            return NextResponse.json({ success: true, data, total, page, limit, totalPages: Math.ceil(total / limit) });
        }

        const Model = PUBLISHED_STATUSES.includes(status) ? Internship : StagedInternship;

        const [total, results] = await Promise.all([
            Model.countDocuments(query),
            Model.find(query)
                .select(
                    "name company applyLink datePublished source moderation linkVerification createdAt",
                )
                .sort({ "moderation.score": -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
        ]);

        const totalPages = Math.ceil(total / limit);

        return NextResponse.json({
            success: true,
            data: results,
            total,
            page,
            limit,
            totalPages,
        });
    } catch (error) {
        console.error("[moderator/internships GET]", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 },
        );
    }
}
