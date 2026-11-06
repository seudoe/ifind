import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import { escapeRegex } from "@/lib/validate";
import { buildModerationFilterQuery } from "@/lib/moderatorQuery";
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

        // Optional search and targeted filters
        const search = searchParams.get("search")?.trim() ?? "";
        const nameFilter = searchParams.get("name")?.trim() ?? "";
        const companyFilter = searchParams.get("company")?.trim() ?? "";
        const scoreOp = searchParams.get("scoreOp")?.trim() ?? ""; // "lt" | "gt" | "eq"
        const scoreValRaw = searchParams.get("scoreVal")?.trim();
        const scoreVal = scoreValRaw !== undefined && scoreValRaw !== null && scoreValRaw !== "" ? Number(scoreValRaw) : null;

        // Sort configuration
        const sortBy = searchParams.get("sortBy")?.trim() ?? "scamScore"; // "deadline" | "scamScore" | "scrapedTime" | "name" | "company"
        const sortOrder = searchParams.get("sortOrder")?.toLowerCase() === "asc" ? 1 : -1;

        // Build query on moderation.status using shared filter builder
        const query = buildModerationFilterQuery({
            status,
            source: searchParams.get("source") === "employer" ? "employer" : "scraped",
            search,
            name: nameFilter,
            company: companyFilter,
            scoreOp: scoreOp as "" | "lt" | "gt" | "eq",
            scoreVal,
        });

        await connectDB();

        const skip = (page - 1) * limit;

        // Determine sort object
        let sortObj: Record<string, 1 | -1>;
        switch (sortBy) {
            case "deadline":
                sortObj = { deadlineDate: sortOrder, createdAt: -1 };
                break;
            case "scrapedTime":
                sortObj = { createdAt: sortOrder };
                break;
            case "name":
                sortObj = { name: sortOrder };
                break;
            case "company":
                sortObj = { company: sortOrder };
                break;
            case "scamScore":
            default:
                sortObj = { "moderation.score": sortOrder, createdAt: -1 };
                break;
        }

        // Employer-posted listings live in their own collection; drafts are never moderated
        if (searchParams.get("source") === "employer") {
            query.status = { $ne: "draft" };
            const [total, rows] = await Promise.all([
                PlatformInternship.countDocuments(query),
                PlatformInternship.find(query)
                    .select("name company companyId applyLink datePublished deadlineDate source moderation summary skills createdAt")
                    .sort(sortObj)
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
                deadlineDate: r.deadlineDate ?? null,
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
                    "name company applyLink datePublished deadlineDate source moderation linkVerification createdAt",
                )
                .sort(sortObj)
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
