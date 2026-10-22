import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { MOD_COOKIE_NAME, verifyModToken } from "@/lib/moderatorAuth";
import Moderator from "@/models/Moderator";

export const runtime = "nodejs";

export async function POST() {
    // Clearing the cookie only logs out this browser; bumping the session version also kills a copied or stolen token.
    try {
        const token = (await cookies()).get(MOD_COOKIE_NAME)?.value;
        const session = token ? verifyModToken(token) : null;
        if (session) {
            await connectDB();
            await Moderator.updateOne({ _id: session.moderatorId }, { $inc: { tokenVersion: 1 } });
        }
    } catch (error) {
        console.error("[moderator/auth/logout] could not revoke sessions", error);
    }
    const response = NextResponse.json({
        success: true,
        message: "Logged out",
    });
    response.cookies.set(MOD_COOKIE_NAME, "", { maxAge: 0, path: "/" });
    return response;
}
