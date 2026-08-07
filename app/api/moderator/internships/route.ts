import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import Internship from "@/models/Internship";

export const runtime = "nodejs";

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

        // Optional search string
        const search = searchParams.get("search")?.trim() ?? "";

        // Build query on moderation.status
        const query: Record<string, unknown> = {
            "moderation.status": status,
        };

        // Add case-insensitive regex on name and company when search provided
        if (search) {
            const regex = new RegExp(search, "i");
            query.$or = [{ name: regex }, { company: regex }];
        }

        await connectDB();

        const skip = (page - 1) * limit;

        const [total, results] = await Promise.all([
            Internship.countDocuments(query),
            Internship.find(query)
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
