import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

/** POST saves, DELETE un-saves. The id may be a scraped or an iFind internship; it is stored as-is. */
async function toggle(method: "POST" | "DELETE", { params }: Ctx) {
    try {
        const session = await getSession();
        if (!session || !mongoose.isValidObjectId(session.userId)) return fail("Not authenticated", 401);
        const { id } = await params;
        if (!mongoose.isValidObjectId(id)) return fail("Internship not found", 404);

        await connectDB();
        const db = mongoose.connection.db!;
        const oid = new mongoose.Types.ObjectId(id);
        if (method === "POST") {
            const exists =
                (await db.collection("internships").countDocuments({ _id: oid }, { limit: 1 })) ||
                (await db.collection("internships.this-platform").countDocuments({ _id: oid }, { limit: 1 }));
            if (!exists) return fail("Internship not found", 404);
        }
        await db.collection("users").updateOne(
            { _id: new mongoose.Types.ObjectId(session.userId) },
            (method === "POST" ? { $addToSet: { savedInternships: oid } } : { $pull: { savedInternships: oid } }) as never,
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[internships/save]", error);
        return fail("Unable to update saved internships", 500);
    }
}

export const POST = (_req: NextRequest, ctx: Ctx) => toggle("POST", ctx);
export const DELETE = (_req: NextRequest, ctx: Ctx) => toggle("DELETE", ctx);
