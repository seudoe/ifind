import { notFound } from "next/navigation";
import { Card, COLORS, GroupedBars, HBars } from "@/components/moderator/charts";
import { APP_STATUS_LABEL } from "@/components/employer/Pills";
import { Badge } from "@/components/ui/Badge";
import { formatDuration, formatStipend } from "@/lib/utils";
import Application from "@/models/Application";
import PlatformInternship from "@/models/PlatformInternship";
import { APPLICATION_STATUSES } from "@/types/employer";

const fmt = (d?: Date | null) => (d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-");

const MOD_TEXT: Record<string, string> = {
    pending_review: "Waiting for a moderator. Students can't see this internship until it's approved.",
    auto_approved: "Approved automatically. Visible to students once published.",
    manually_approved: "Approved by a moderator. Visible to students once published.",
    auto_rejected: "Rejected by automated checks. Edit the key details and it will be reviewed again.",
    manually_rejected: "Rejected by a moderator. Edit the key details and it will be reviewed again.",
};

export default async function InternshipOverviewPage({ params }: { params: Promise<{ companyId: string; internshipId: string }> }) {
    const { companyId, internshipId } = await params;
    const i = await PlatformInternship.findOne({ _id: internshipId, companyId }).lean();
    if (!i) notFound();
    const m = i.moderation;

    // Funnel by status + applications per day (last 14 days)
    const since = new Date(Date.now() - 13 * 86_400_000);
    since.setUTCHours(0, 0, 0, 0);
    const [byStatus, byDay] = await Promise.all([
        Application.aggregate<{ _id: string; n: number }>([{ $match: { internshipId: i._id } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
        Application.aggregate<{ _id: string; n: number }>([
            { $match: { internshipId: i._id, appliedAt: { $gte: since } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$appliedAt" } }, n: { $sum: 1 } } },
        ]),
    ]);
    const funnel = APPLICATION_STATUSES.map((st) => ({ label: APP_STATUS_LABEL[st], value: byStatus.find((r) => r._id === st)?.n ?? 0 }));
    const days = Array.from({ length: 14 }, (_, k) => new Date(since.getTime() + k * 86_400_000).toISOString().slice(0, 10));
    const totalApps = funnel.reduce((a, r) => a + r.value, 0);

    const rows: [string, string][] = [
        ["Work mode", `${i.workMode}${i.city ? `, ${i.city}` : ""}`],
        ["Stipend", i.stipend ? formatStipend(i.stipend) : "-"],
        ["Duration", i.duration ? formatDuration(i.duration) : "-"],
        ["Openings", i.openings ? String(i.openings) : "-"],
        ["Published", fmt(i.datePublished)],
        ["Deadline", fmt(i.deadlineDate)],
        ["Max applications", i.maxApplications ? String(i.maxApplications) : "No limit"],
        ["Closed", fmt(i.closedAt)],
    ];

    return (
        <div className="max-w-3xl space-y-5">
            {i.status !== "draft" && (
                <div className="plasma-card p-4 space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">Moderation</p>
                    <p className="text-sm text-[var(--text)]">{MOD_TEXT[m.status]}</p>
                    {m.rejectionReason && <p className="text-sm text-[var(--danger)]">Reason: {m.rejectionReason}</p>}
                </div>
            )}

            {i.status !== "draft" && (
                <div className="grid gap-4 md:grid-cols-2">
                    <Card title={`Pipeline (${totalApps} applicant${totalApps === 1 ? "" : "s"})`}>
                        <HBars rows={funnel} color={COLORS.blue} />
                    </Card>
                    <Card title="Applications, last 14 days">
                        <GroupedBars
                            labels={days.map((d) => d.slice(5))}
                            series={[{ name: "Applications", color: COLORS.blue, values: days.map((d) => byDay.find((r) => r._id === d)?.n ?? 0) }]}
                            height={110}
                        />
                    </Card>
                </div>
            )}

            <div className="plasma-card p-5">
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {rows.map(([k, v]) => (
                        <div key={k}>
                            <dt className="text-xs text-[var(--text-3)]">{k}</dt>
                            <dd className="text-sm text-[var(--text)] capitalize">{v}</dd>
                        </div>
                    ))}
                </dl>
            </div>

            {i.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">{i.skills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}</div>
            )}
            {i.summary && <p className="text-sm text-[var(--text-2)] whitespace-pre-line">{i.summary}</p>}
        </div>
    );
}
