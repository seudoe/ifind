import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { toStudentInternship, visibleToStudentsFilter } from "@/lib/employer/visibility";

export const runtime = "nodejs";

const serialize = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !mongoose.Types.ObjectId.isValid(session.userId)) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    await connectDB();
    const db = mongoose.connection.db;
    if (!db) throw new Error("MongoDB not connected");

    const user = await db.collection("users").findOne(
      { _id: new mongoose.Types.ObjectId(session.userId) },
      { projection: { password: 0, failedLoginAttempts: 0, "resume.bert_vector": 0, "resume.tfidf_vector": 0 } },
    );
    if (!user) return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });

    const toIds = (values: unknown[]) => values
      .map((value) => String(value))
      .filter((value) => mongoose.Types.ObjectId.isValid(value))
      .map((value) => new mongoose.Types.ObjectId(value));
    const savedIds = toIds(Array.isArray(user.savedInternships) ? user.savedInternships : []);
    const recList = user.recommendedInternships?.recommendedList || (Array.isArray(user.recommendedInternships) ? user.recommendedInternships : []);
    const recommendedIds = toIds(Array.isArray(recList) ? recList : []);
    const appliedIds = toIds(Array.isArray(user.appliedInternships) ? user.appliedInternships.map((item: { internshipId?: unknown }) => item.internshipId) : []);
    const linkedIds = [...savedIds, ...recommendedIds, ...appliedIds];

    const projection = { bert_vector: 0, tfidf_vector: 0, moderation: 0 };
    const visible = visibleToStudentsFilter() as Record<string, unknown>;
    const [scraped, platform, linkedScraped, linkedPlatform] = await Promise.all([
      db.collection("internships").find({ isActive: true }, { projection: { bert_vector: 0, tfidf_vector: 0 } }).sort({ datePublished: -1 }).limit(300).toArray(),
      db.collection("internships.this-platform").find(visible, { projection }).sort({ datePublished: -1 }).limit(200).toArray(),
      linkedIds.length ? db.collection("internships").find({ _id: { $in: linkedIds } }, { projection: { bert_vector: 0, tfidf_vector: 0 } }).toArray() : [],
      linkedIds.length ? db.collection("internships.this-platform").find({ _id: { $in: linkedIds }, "moderation.status": { $in: ["auto_approved", "manually_approved"] } }, { projection }).toArray() : [],
    ]);
    const companyIds = [...new Set([...platform, ...linkedPlatform].map((i) => String(i.companyId)))].map((id) => new mongoose.Types.ObjectId(id));
    const logos = new Map(
      (companyIds.length ? await db.collection("companies").find({ _id: { $in: companyIds } }, { projection: { logo: 1 } }).toArray() : [])
        .map((c) => [String(c._id), c.logo as string | null]),
    );
    const shape = (i: Record<string, unknown>) => toStudentInternship(i, logos.get(String(i.companyId)));
    const time = (i: Record<string, unknown>) => new Date(String(i.datePublished ?? 0)).getTime() || 0;
    const browse = [...platform.map(shape), ...scraped].sort((x, y) => time(y) - time(x));
    const linked = [...linkedScraped, ...linkedPlatform.map(shape)];
    const byId = new Map(linked.map((internship) => [String(internship._id), internship]));
    const byOrder = (ids: mongoose.Types.ObjectId[]) => ids.map((id) => byId.get(String(id))).filter(Boolean);

    return NextResponse.json({
      success: true,
      data: serialize({
        user,
        browse,
        saved: byOrder(savedIds),
        // a recommended employer post may have been paused or closed since the list was built
        recommended: byOrder(recommendedIds).filter((i) => (i as { source?: string }).source !== "ifind" || (i as { status?: string }).status === "published"),
        applied: byOrder(appliedIds),
      }),
    });
  } catch (error) {
    console.error("[user/dashboard]", error);
    return NextResponse.json({ success: false, error: "Unable to load student data" }, { status: 500 });
  }
}
