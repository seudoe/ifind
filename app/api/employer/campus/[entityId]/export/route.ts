import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { requireCampusRole } from "@/lib/campus/access";
import { buildExport, EXPORT_FORMATS, toCsv, toXlsx, type ExportFormat } from "@/lib/campus/export";
import { isResponse } from "@/lib/employer/access";
import { log } from "@/lib/logger";
import { hit, tooManyRequests } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MIME: Record<ExportFormat, string> = {
    csv: "text/csv; charset=utf-8",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    json: "application/json; charset=utf-8",
};

/**
 * GET ?format=csv|xlsx|json&internshipId=: applicant list for sharing with real recruiters. Coordinator and up.
 * Rate limited and logged (who, campus, internship, count, format: never the data itself). No staff notes or ratings.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ entityId: string }> }) {
    try {
        const access = await requireCampusRole((await params).entityId, "coordinator");
        if (isResponse(access)) return access;
        const limited = await hit("campus:export", String(access.employer._id), { limit: 20, windowSec: 60 * 60 });
        if (!limited.ok) return tooManyRequests(limited.retryAfter);

        const sp = request.nextUrl.searchParams;
        const format = (sp.get("format") ?? "csv") as ExportFormat;
        if (!EXPORT_FORMATS.includes(format)) return NextResponse.json({ success: false, error: "format must be csv, xlsx or json" }, { status: 400 });
        const internshipId = sp.get("internshipId");
        if (internshipId && !mongoose.isValidObjectId(internshipId)) return NextResponse.json({ success: false, error: "Invalid internship" }, { status: 400 });

        const data = await buildExport(access.entity._id, internshipId);
        log.info("campus/export", "applicants exported", {
            employer: String(access.employer._id), entity: String(access.entity._id), internship: internshipId ?? "all", count: data.count, format, capped: data.capped,
        });

        const stamp = new Date().toISOString().slice(0, 10);
        const filename = `${access.entity.slug}-applicants-${stamp}.${format}`;
        const headers = { "Content-Type": MIME[format], "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" };
        if (format === "json") return new NextResponse(JSON.stringify({ campus: access.entity.name, exportedAt: new Date().toISOString(), count: data.count, applicants: data.records }, null, 2), { headers });
        if (format === "csv") return new NextResponse(toCsv(data.header, data.rows), { headers });
        return new NextResponse(new Uint8Array(await toXlsx(data.header, data.rows)), { headers });
    } catch (error) {
        console.error("[employer/campus/export]", error);
        return NextResponse.json({ success: false, error: "Unable to build the export" }, { status: 500 });
    }
}
