import mongoose from "mongoose";
import { after, NextRequest, NextResponse } from "next/server";
import { sendServerEvent } from "@/lib/analytics/measurementProtocol";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { createApplication } from "@/lib/employer/applications";
import { validateAnswers } from "@/lib/employer/screening";
import { visibleToStudentsFilter } from "@/lib/employer/visibility";
import PlatformInternship from "@/models/PlatformInternship";
import User from "@/models/User";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

/**
 * Scraped listing: records the click on the student (they apply on the source site).
 * iFind listing: creates an application the employer sees, after checking the post's requirements.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
    try {
        const session = await getSession();
        if (!session || !mongoose.isValidObjectId(session.userId)) return fail("Not authenticated", 401);
        const { id } = await params;
        if (!mongoose.isValidObjectId(id)) return fail("Internship not found", 404);

        await connectDB();
        const db = mongoose.connection.db!;
        const oid = new mongoose.Types.ObjectId(id);
        const uid = new mongoose.Types.ObjectId(session.userId);
        const record = () =>
            db.collection("users").updateOne(
                { _id: uid, "appliedInternships.internshipId": { $ne: oid } },
                { $push: { appliedInternships: { internshipId: oid, appliedAt: new Date(), status: "applied" } } } as never,
            );

        const platform = await PlatformInternship.findOne({ _id: oid, ...visibleToStudentsFilter() });
        if (!platform) {
            if (!(await db.collection("internships").countDocuments({ _id: oid, isActive: true }, { limit: 1 }))) return fail("Internship not found", 404);
            await record();
            return NextResponse.json({ success: true });
        }

        const user = await User.findById(uid);
        if (!user) return fail("Student not found", 404);
        const body = await req.json().catch(() => ({}));

        if (platform.requireResume && !user.resume?.driveViewLink && !user.resume?.parsedData) return fail("Upload your resume before applying", 400);
        const coverLetter = typeof body.coverLetter === "string" ? body.coverLetter.trim().slice(0, 5000) : "";
        if (platform.requireCoverLetter && coverLetter.length < 20) return fail("Write a short cover letter (at least 20 characters)", 400);
        const checked = validateAnswers(platform.screeningQuestions, body.answers);
        if ("error" in checked) return fail(checked.error, 400);

        try {
            await createApplication(platform, user, {
                coverLetter: coverLetter || undefined,
                answers: checked.answers.map((a) => ({ questionId: new mongoose.Types.ObjectId(a.questionId), answer: a.answer })),
            });
        } catch (err) {
            if ((err as { code?: number }).code === 11000) return fail("You have already applied", 409);
            return fail(err instanceof Error ? err.message : "Unable to apply", 409);
        }
        await record();
        after(() => sendServerEvent(req, "application_submitted", { user_type: "student" }));
        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        console.error("[internships/apply]", error);
        return fail("Unable to apply", 500);
    }
}
