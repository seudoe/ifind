import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getModSession } from "@/lib/moderatorAuth";
import User from "@/models/User";

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

        // Build query — optionally filter by name, email, or username
        const query: Record<string, unknown> = {};

        if (search) {
            const regex = new RegExp(search, "i");
            query.$or = [
                { name: regex },
                { email: regex },
                { username: regex },
            ];
        }

        await connectDB();

        const skip = (page - 1) * limit;

        const [total, users] = await Promise.all([
            User.countDocuments(query),
            User.find(query)
                .select(
                    "name email username profilePicture createdAt appliedInternships isBanned bannedReason bannedBy bannedAt",
                )
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
        ]);

        // Transform: replace appliedInternships array with applicationCount
        const data = users.map((user) => {
            const { appliedInternships, ...rest } = user as typeof user & {
                appliedInternships?: unknown[];
            };
            return {
                ...rest,
                applicationCount: Array.isArray(appliedInternships)
                    ? appliedInternships.length
                    : 0,
            };
        });

        const totalPages = Math.ceil(total / limit);

        return NextResponse.json({
            success: true,
            data,
            total,
            page,
            limit,
            totalPages,
        });
    } catch (error) {
        console.error("[moderator/users GET]", error);
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 },
        );
    }
}
