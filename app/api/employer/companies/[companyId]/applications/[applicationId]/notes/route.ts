import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { isResponse, requireCompanyRole } from "@/lib/employer/access";
import { plainText } from "@/lib/employer/sanitize";
import { noteSchema, zodMessage } from "@/lib/employer/validation";
import Application from "@/models/Application";

export const runtime = "nodejs";

const MAX_NOTES = 100;
const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

/** Internal note. Notes never leave the employer APIs. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string; applicationId: string }> }) {
    try {
        const { companyId, applicationId } = await params;
        const access = await requireCompanyRole(companyId, "recruiter");
        if (isResponse(access)) return access;
        if (!mongoose.isValidObjectId(applicationId)) return fail("Application not found", 404);

        const parsed = noteSchema.safeParse(await request.json());
        if (!parsed.success) return fail(zodMessage(parsed.error), 400);

        const text = plainText(parsed.data.text);
        if (!text) return fail("Note can't be empty", 400);
        const note = { _id: new mongoose.Types.ObjectId(), authorId: access.employer._id, text, createdAt: new Date() };
        const res = await Application.updateOne(
            { _id: applicationId, companyId: access.company._id, [`notes.${MAX_NOTES - 1}`]: { $exists: false } },
            { $push: { notes: note } },
        );
        if (!res.matchedCount) {
            return (await Application.exists({ _id: applicationId, companyId: access.company._id }))
                ? fail(`Notes are limited to ${MAX_NOTES} per applicant`, 409)
                : fail("Application not found", 404);
        }
        return NextResponse.json({
            success: true,
            data: { _id: String(note._id), authorId: String(note.authorId), authorName: access.employer.name, text: note.text, createdAt: note.createdAt.toISOString() },
        }, { status: 201 });
    } catch (error) {
        console.error("[employer/application notes POST]", error);
        return fail("Unable to add note", 500);
    }
}
