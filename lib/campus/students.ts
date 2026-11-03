import mongoose from "mongoose";
import { escapeRegex } from "./validation";
import CampusEnrollment from "@/models/CampusEnrollment";
import type { StudentRow } from "./studentRow";

export const PAGE_SIZE = 50;

/**
 * Joined students of ONE campus (entity id comes from the verified membership). Search matches name, college ID,
 * course, department, or an exact batch year. PII is returned only to staff of this campus.
 */
export async function listCampusStudents(entityId: unknown, opts: { q?: string; page?: number } = {}): Promise<{ items: StudentRow[]; total: number; page: number; pageSize: number }> {
    const q = (opts.q ?? "").trim().slice(0, 80);
    const page = Math.max(1, Math.floor(opts.page ?? 1));
    const match: Record<string, unknown> = { entityId: new mongoose.Types.ObjectId(String(entityId)) };

    const search: Record<string, unknown>[] = [];
    if (q) {
        const re = { $regex: escapeRegex(q), $options: "i" };
        search.push({ collegeUid: re }, { course: re }, { department: re }, { "u.name": re });
        if (/^\d{4}$/.test(q)) search.push({ batch: Number(q) });
    }

    const pipeline: mongoose.PipelineStage[] = [
        { $match: match },
        { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "u", pipeline: [{ $project: { name: 1, email: 1 } }] } },
        { $unwind: "$u" },
        ...(search.length ? [{ $match: { $or: search } } as mongoose.PipelineStage] : []),
        { $sort: { batch: 1, collegeUid: 1, _id: 1 } },
        { $facet: { rows: [{ $skip: (page - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE }], total: [{ $count: "n" }] } },
    ];
    const [res] = await CampusEnrollment.aggregate<{ rows: Array<Record<string, unknown>>; total: { n: number }[] }>(pipeline);
    const rows = res?.rows ?? [];

    // Duplicate college IDs within the same college, for the IDs on this page
    const keys = rows.map((r) => ({ collegeId: r.collegeId as mongoose.Types.ObjectId, collegeUid: r.collegeUid as string }));
    const dupes = keys.length
        ? await CampusEnrollment.aggregate<{ _id: { collegeId: mongoose.Types.ObjectId; collegeUid: string }; n: number }>([
            { $match: { $or: keys } },
            { $group: { _id: { collegeId: "$collegeId", collegeUid: "$collegeUid" }, n: { $sum: 1 } } },
            { $match: { n: { $gt: 1 } } },
        ])
        : [];
    const dup = new Set(dupes.map((d) => `${d._id.collegeId}:${d._id.collegeUid}`));

    const items = rows.map((r) => {
        const u = r.u as { name: string; email: string };
        return {
            userId: String(r.userId), name: u.name, email: u.email, phone: (r.phone as string | null) ?? null, collegeUid: r.collegeUid as string,
            course: r.course as string, department: r.department as string, batch: r.batch as number, cgpa: (r.cgpa as number | null) ?? null,
            activeBacklogs: (r.activeBacklogs as number | null) ?? null, joinedAt: r.joinedAt ? new Date(r.joinedAt as Date).toISOString() : null,
            duplicateUid: dup.has(`${r.collegeId}:${r.collegeUid}`),
        };
    });
    return { items, total: res?.total[0]?.n ?? 0, page, pageSize: PAGE_SIZE };
}
