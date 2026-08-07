import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";

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
      { projection: { password: 0, "resume.bert_vector": 0, "resume.tfidf_vector": 0 } },
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

    const projection = { bert_vector: 0, tfidf_vector: 0 };
    const [browse, linked] = await Promise.all([
      db.collection("internships").find({ isActive: true }, { projection }).sort({ datePublished: -1 }).limit(60).toArray(),
      linkedIds.length ? db.collection("internships").find({ _id: { $in: linkedIds } }, { projection }).toArray() : [],
    ]);
    const byId = new Map(linked.map((internship) => [String(internship._id), internship]));
    const byOrder = (ids: mongoose.Types.ObjectId[]) => ids.map((id) => byId.get(String(id))).filter(Boolean);

    return NextResponse.json({
      success: true,
      data: serialize({
        user,
        browse,
        saved: byOrder(savedIds),
        recommended: byOrder(recommendedIds),
        applied: byOrder(appliedIds),
      }),
    });
  } catch (error) {
    console.error("[user/dashboard]", error);
    return NextResponse.json({ success: false, error: "Unable to load student data" }, { status: 500 });
  }
}
