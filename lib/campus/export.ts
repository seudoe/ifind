import mongoose from "mongoose";
import CampusApplication from "@/models/CampusApplication";
import CampusInternship from "@/models/CampusInternship";

/**
 * Applicant export for coordinators to share with real recruiters. Contains the applicant snapshot, the internship,
 * status, round results and screening answers. NEVER staff notes or ratings, and nothing about other campuses.
 */
export const EXPORT_FORMATS = ["csv", "xlsx", "json"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Spreadsheet formula injection: a cell that starts with = + - @ tab or CR is treated as a formula by Excel/Sheets. */
export function safeCell(v: unknown): string {
    if (v === null || v === undefined) return "";
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

const csvEscape = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function toCsv(header: string[], rows: string[][]): string {
    // BOM so Excel opens UTF-8 names correctly
    return "﻿" + [header, ...rows].map((r) => r.map((c) => csvEscape(safeCell(c))).join(",")).join("\r\n") + "\r\n";
}

export async function toXlsx(header: string[], rows: string[][]): Promise<Buffer> {
    const { default: writeXlsxFile } = await import("write-excel-file/node");
    const data = [header.map((h) => ({ value: h, fontWeight: "bold" as const })), ...rows.map((r) => r.map((c) => ({ value: safeCell(c) })))];
    return Buffer.from(await writeXlsxFile(data).toBuffer());
}

export interface ExportData {
    header: string[];
    rows: string[][];
    /** JSON shape: one object per applicant, keys = header. */
    records: Record<string, string>[];
}

const IST = (d?: Date | null) => (d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "");

/** Builds the table for one internship, or the whole campus. Capped so one request cannot pull unbounded data. */
export async function buildExport(entityId: unknown, internshipId?: string | null): Promise<ExportData & { count: number; capped: boolean }> {
    const eid = new mongoose.Types.ObjectId(String(entityId));
    const match: Record<string, unknown> = { entityId: eid };
    if (internshipId) match.internshipId = new mongoose.Types.ObjectId(internshipId);
    const LIMIT = 5000;
    const apps = await CampusApplication.find(match).sort({ appliedAt: 1 }).limit(LIMIT + 1).select("-notes -rating -resumeSnapshot.parsedData").lean();
    const capped = apps.length > LIMIT;
    if (capped) apps.pop();
    const internships = await CampusInternship.find({ entityId: eid, _id: { $in: [...new Set(apps.map((a) => String(a.internshipId)))] } }).lean();
    const byId = new Map(internships.map((i) => [String(i._id), i]));

    // One column per screening question when scoped to one internship; otherwise a single "Screening answers" column
    const single = internshipId ? byId.get(internshipId) : undefined;
    const qCols = single ? single.screeningQuestions.map((q) => ({ id: String(q._id), title: q.question })) : [];
    const header = [
        "Name", "Student ID (given by college)", "Course", "Department", "Batch", "CGPA", "Active backlogs", "Email", "Phone",
        "Company", "Designation", "Status", "Rounds", "Applied at (IST)",
        ...(single ? qCols.map((q) => `Q: ${q.title}`) : ["Screening answers"]),
    ];

    const rows = apps.map((a) => {
        const i = byId.get(String(a.internshipId));
        const s = a.applicantSnapshot;
        const qs = new Map((i?.screeningQuestions ?? []).map((q) => [String(q._id), q.question]));
        const ans = new Map(a.answers.map((x) => [String(x.questionId), Array.isArray(x.answer) ? x.answer.join(", ") : String(x.answer ?? "")]));
        return [
            s.name, s.uid, s.course, s.department, String(s.batch), s.cgpa == null ? "" : String(s.cgpa), s.activeBacklogs == null ? "" : String(s.activeBacklogs), s.email, s.phone ?? "",
            i?.company.name ?? "", i?.designation ?? "", a.status.replace("_", " "),
            a.rounds.map((r) => `${r.name}: ${r.result}`).join("; "), IST(a.appliedAt),
            ...(single
                ? qCols.map((q) => ans.get(q.id) ?? "")
                : [a.answers.map((x) => `${qs.get(String(x.questionId)) ?? "Question"}: ${ans.get(String(x.questionId)) ?? ""}`).join(" | ")]),
        ].map(String);
    });
    const records = rows.map((r) => Object.fromEntries(header.map((h, n) => [h, r[n]])));
    return { header, rows, records, count: rows.length, capped };
}

