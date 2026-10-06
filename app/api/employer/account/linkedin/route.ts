import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { isResponse, requireEmployer } from "@/lib/employer/access";
import Employer from "@/models/Employer";

export const runtime = "nodejs";

/** Unlink LinkedIn. Refused if it would leave the account with no way to sign in. */
export async function DELETE() {
    try {
        const auth = await requireEmployer();
        if (isResponse(auth)) return auth;

        await connectDB();
        const employer = await Employer.findById(auth._id).select("+password");
        if (!employer?.linkedinId) {
            return NextResponse.json({ success: false, error: "LinkedIn is not linked" }, { status: 400 });
        }
        if (!employer.password) {
            return NextResponse.json({ success: false, error: "Set a password first: LinkedIn is your only way to sign in" }, { status: 400 });
        }
        await Employer.updateOne({ _id: employer._id }, { $unset: { linkedinId: "" }, $set: { linkedinDetails: null } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[employer/account/linkedin]", error);
        return NextResponse.json({ success: false, error: "Unable to unlink LinkedIn" }, { status: 500 });
    }
}
