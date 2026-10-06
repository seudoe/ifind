import mongoose from "mongoose";
import { notify } from "@/lib/employer/notify";
import { toStudentInternship } from "@/lib/employer/visibility";
import Application from "@/models/Application";
import Company from "@/models/Company";
import PlatformInternship from "@/models/PlatformInternship";
import { FINAL_STATUSES, type AppliedDetail } from "@/types/student-application";
import type { ApplicationStatus } from "@/types/employer";

const oid = (v: string | mongoose.Types.ObjectId) => new mongoose.Types.ObjectId(String(v));
const serialize = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * The student's applied internships (all, or just `onlyId`). iFind postings carry the application's pipeline status;
 * scraped ones are only a record that the student went to the source site.
 * Paused/closed postings are still returned: the student applied, so they keep seeing it.
 */
export async function loadApplied(userId: string, onlyId?: string): Promise<AppliedDetail[]> {
  const db = mongoose.connection.db!;
  const user = await db.collection("users").findOne({ _id: oid(userId) }, { projection: { appliedInternships: 1 } });
  let applied: { internshipId: mongoose.Types.ObjectId; appliedAt: Date }[] = Array.isArray(user?.appliedInternships) ? user.appliedInternships : [];
  if (onlyId) applied = applied.filter((a) => String(a.internshipId) === onlyId);
  if (!applied.length) return [];

  const ids = applied.map((a) => a.internshipId);
  const noVectors = { bert_vector: 0, tfidf_vector: 0, moderation: 0 };
  const [scraped, platform, apps] = await Promise.all([
    db.collection("internships").find({ _id: { $in: ids } }, { projection: noVectors }).toArray(),
    db.collection("internships.this-platform").find({ _id: { $in: ids } }, { projection: noVectors }).toArray(),
    Application.find({ studentId: oid(userId), internshipId: { $in: ids } }).lean(),
  ]);
  const companyIds = [...new Set(platform.map((p) => String(p.companyId)))].map(oid);
  const logos = new Map(
    (companyIds.length ? await Company.find({ _id: { $in: companyIds } }).select("logo").lean() : []).map((c) => [String(c._id), c.logo ?? null]),
  );
  const internships = new Map<string, { doc: Record<string, unknown>; platform: boolean }>([
    ...scraped.map((d) => [String(d._id), { doc: d as Record<string, unknown>, platform: false }] as const),
    ...platform.map((d) => [String(d._id), { doc: d as Record<string, unknown>, platform: true }] as const),
  ]);
  const appByInternship = new Map(apps.map((a) => [String(a.internshipId), a]));

  const out: AppliedDetail[] = [];
  for (const a of applied) {
    const key = String(a.internshipId);
    const found = internships.get(key);
    if (!found) continue; // posting was removed
    const app = found.platform ? appByInternship.get(key) : undefined;
    const questions = (found.doc.screeningQuestions ?? []) as { _id: unknown; question: string }[];
    out.push(serialize({
      internshipId: key,
      appliedAt: a.appliedAt as unknown as string,
      status: (app?.status ?? "applied") as ApplicationStatus,
      tracked: found.platform && !!app,
      internship: found.platform ? toStudentInternship(found.doc, logos.get(String(found.doc.companyId))) : found.doc,
      timeline: (app?.statusHistory ?? []).map((h) => ({ status: h.status, at: h.changedAt as unknown as string })),
      coverLetter: app?.coverLetter ?? null,
      answers: (app?.answers ?? []).map((x) => ({
        question: questions.find((q) => String(q._id) === String(x.questionId))?.question ?? "Question",
        answer: Array.isArray(x.answer) ? x.answer.join(", ") : String(x.answer),
      })),
      canWithdraw: !!app && !FINAL_STATUSES.includes(app.status),
    } as unknown as AppliedDetail));
  }
  return out.sort((x, y) => new Date(y.appliedAt).getTime() - new Date(x.appliedAt).getTime());
}

export type WithdrawResult = { ok: true } | { ok: false; status: number; error: string };

/** Student withdraws an iFind application (only while it is still open). Final: the unique index blocks re-applying. */
export async function withdrawApplication(userId: string, internshipId: string): Promise<WithdrawResult> {
  const res = await Application.findOneAndUpdate(
    { studentId: oid(userId), internshipId: oid(internshipId), status: { $nin: FINAL_STATUSES } },
    { $set: { status: "withdrawn" }, $push: { statusHistory: { status: "withdrawn", changedBy: null, changedAt: new Date(), note: null } } },
    { new: true },
  ).lean();
  if (!res) {
    const exists = await Application.exists({ studentId: oid(userId), internshipId: oid(internshipId) });
    return exists
      ? { ok: false, status: 409, error: "This application can no longer be withdrawn" }
      : { ok: false, status: 404, error: "Application not found" };
  }
  await mongoose.connection.db!.collection("users").updateOne(
    { _id: oid(userId), "appliedInternships.internshipId": oid(internshipId) },
    { $set: { "appliedInternships.$.status": "withdrawn" } },
  );
  const [internship, company, user] = await Promise.all([
    PlatformInternship.findById(internshipId).select("name").lean(),
    Company.findById(res.companyId).select("members").lean(),
    mongoose.connection.db!.collection("users").findOne({ _id: oid(userId) }, { projection: { name: 1 } }),
  ]);
  await notify({
    recipientType: "employer",
    recipientIds: (company?.members ?? []).map((m) => m.employerId),
    type: "application_withdrawn",
    title: `Application withdrawn for "${internship?.name ?? "an internship"}"`,
    body: `${user?.name ?? "A student"} withdrew their application.`,
    link: `/employer/company/${res.companyId}/internships/${internshipId}/applicants`,
    companyId: res.companyId,
  });
  return { ok: true };
}
