"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { DangerModal } from "@/components/ui/DangerModal";
import { Modal } from "@/components/ui/Modal";
import { ACCEPTED_WITHDRAW_WARNING, JOIN_CERTAINTY, LEAVE_CERTAINTY, LEAVE_CONSEQUENCES } from "@/lib/campus/copy";
import { CAMPUS_REPORT_REASONS, type CampusReportReason } from "@/types/campus";
import type { BlockerView, CampusSummaryView } from "@/types/campusStudent";

async function call(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const j = await res.json().catch(() => ({ success: false, error: "Something went wrong" }));
    return j as { success: boolean; error?: string; code?: string; data?: unknown; applications?: BlockerView[] };
}

/** How to reach the campus on the server: by id from the list, or by the code the student typed. */
export type Target = { campus: CampusSummaryView; code?: string };
const body = (t: Target) => (t.code ? { code: t.code } : { entityId: t.campus._id });

function CampusFacts({ c }: { c: CampusSummaryView }) {
    return (
        <div className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-3 text-sm space-y-1">
            <p className="font-semibold text-[var(--text)]">{c.name}</p>
            <p className="text-[var(--text-2)]">Set up by {c.creatorName} · {c.staffCount} staff · {c.studentCount} student{c.studentCount === 1 ? "" : "s"} joined</p>
            <p className="text-[var(--text-3)]">Created {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
            <p className={c.reportCount ? "font-semibold text-[var(--danger)]" : "text-[var(--text-3)]"}>
                {c.reportCount ? `${c.reportCount} student${c.reportCount === 1 ? "" : "s"} reported this campus` : "No reports so far"}
            </p>
        </div>
    );
}

/** First join: shows who runs the campus and how many reported it, then asks the student to be certain. */
export function JoinDialog({ target, onClose, onDone }: { target: Target; onClose: () => void; onDone: () => void }) {
    const [sure, setSure] = useState(false);
    const [busy, setBusy] = useState(false);
    const c = target.campus;

    const join = async () => {
        setBusy(true);
        const j = await call("/api/user/campus/entities/join", "POST", { ...body(target), confirm: true });
        setBusy(false);
        if (!j.success) return toast.error(j.error ?? "Unable to join");
        toast.success(`You joined ${c.name}`);
        onDone();
    };

    return (
        <Modal open onClose={onClose} title={`Join ${c.name}?`} size="md">
            <div className="space-y-4">
                <CampusFacts c={c} />
                {c.reportCount > 0 && (
                    <p role="alert" className="rounded-[var(--radius-sm)] border border-[var(--danger)]/40 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
                        Students of your college reported this campus. Ask your placement coordinator whether it is the official one before you join.
                    </p>
                )}
                <p className="text-sm font-medium text-[var(--text)]">{JOIN_CERTAINTY}</p>
                <label className="flex items-start gap-2 text-sm text-[var(--text)]">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--campus)]" checked={sure} onChange={(e) => setSure(e.target.checked)} />
                    I am certain that this is the official campus of my college.
                </label>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button disabled={!sure} loading={busy} onClick={join}>Join campus</Button>
                </div>
            </div>
        </Modal>
    );
}

/**
 * The big red warning for leaving, or switching to `target` (6.4). Active applications block it: they are listed with
 * a Withdraw button each, and the confirm button stays disabled until none are left. The server enforces the same.
 */
export function LeaveSwitchDialog({ current, target, onClose, onDone }: { current: CampusSummaryView; target?: Target; onClose: () => void; onDone: () => void }) {
    const [blockers, setBlockers] = useState<BlockerView[] | null>(null);
    const [sure, setSure] = useState(false);
    const [busy, setBusy] = useState(false);
    const [confirming, setConfirming] = useState<string | null>(null); // accepted offer awaiting its extra confirmation

    const load = useCallback(async () => {
        const res = await fetch("/api/user/campus/entities/leave", { credentials: "include" });
        const j = await res.json().catch(() => null);
        setBlockers(j?.success ? j.data.blockers : []);
    }, []);
    useEffect(() => {
        let live = true;
        fetch("/api/user/campus/entities/leave", { credentials: "include" })
            .then((r) => r.json())
            .then((j) => live && setBlockers(j?.success ? j.data.blockers : []))
            .catch(() => live && setBlockers([]));
        return () => { live = false; };
    }, []);

    const withdraw = async (b: BlockerView, confirmAccepted = false) => {
        const j = await call(`/api/user/campus/applications/${b.applicationId}/withdraw`, "POST", { confirmAccepted });
        if (!j.success) return toast.error(j.error ?? "Unable to withdraw");
        setConfirming(null);
        toast.success("Application withdrawn");
        await load();
    };

    const go = async () => {
        setBusy(true);
        const j = target
            ? await call("/api/user/campus/entities/join", "POST", { ...body(target), confirm: true, confirmSwitch: true })
            : await call("/api/user/campus/entities/leave", "POST", { confirm: true });
        setBusy(false);
        if (!j.success) {
            if (j.code === "has_active_applications") await load();
            return toast.error(j.error ?? "Unable to continue");
        }
        toast.success(target ? `You switched to ${target.campus.name}` : "You left the campus");
        onDone();
    };

    const blocked = (blockers?.length ?? 0) > 0;
    return (
        <DangerModal open onClose={onClose} title={target ? `Leave ${current.name} and join ${target.campus.name}?` : `Leave ${current.name}?`}>
            <div className="space-y-4">
                <p className="text-sm font-semibold text-[var(--danger)]">If you leave this campus:</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text)]">
                    {LEAVE_CONSEQUENCES.map((t) => <li key={t}>{t}</li>)}
                </ul>

                {blockers === null ? (
                    <p className="text-sm text-[var(--text-3)]">Checking your applications…</p>
                ) : blocked ? (
                    <div className="rounded-[var(--radius-sm)] border border-[var(--danger)]/40 bg-red-50 p-3 space-y-2">
                        <p className="text-sm font-semibold text-[var(--danger)]">You can&apos;t leave while you have active applications here. Withdraw them first:</p>
                        <ul className="space-y-2">
                            {blockers.map((b) => (
                                <li key={b.applicationId} className="rounded-[var(--radius-sm)] bg-[var(--surface)] p-2 text-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="min-w-0"><span className="font-medium text-[var(--text)]">{b.company}</span><span className="text-[var(--text-2)]"> · {b.designation}</span><span className="ml-2 text-xs capitalize text-[var(--text-3)]">{b.status.replace("_", " ")}</span></span>
                                        <Button size="sm" variant="secondary" onClick={() => (b.status === "accepted" ? setConfirming(b.applicationId) : withdraw(b))}>Withdraw</Button>
                                    </div>
                                    {confirming === b.applicationId && (
                                        <div className="mt-2 rounded-[var(--radius-sm)] bg-red-50 p-2 text-xs text-[var(--danger)]">
                                            <p>{ACCEPTED_WITHDRAW_WARNING}</p>
                                            <div className="mt-2 flex gap-2">
                                                <Button size="sm" variant="danger" onClick={() => withdraw(b, true)}>Withdraw accepted offer</Button>
                                                <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>Keep it</Button>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <>
                        <p className="text-sm font-medium text-[var(--text)]">{LEAVE_CERTAINTY}</p>
                        <label className="flex items-start gap-2 text-sm text-[var(--text)]">
                            <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--danger)]" checked={sure} onChange={(e) => setSure(e.target.checked)} />
                            I understand and want to {target ? "switch campus" : "leave"}.
                        </label>
                    </>
                )}

                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button variant="danger" disabled={blockers === null || blocked || !sure} loading={busy} onClick={go}>
                        {target ? `Leave and join ${target.campus.name}` : "Leave campus"}
                    </Button>
                </div>
            </div>
        </DangerModal>
    );
}

const REASON_LABEL: Record<CampusReportReason, string> = {
    not_official: "This is not our official placement cell",
    wrong_college: "This is set up for a different college",
    scam: "This looks like a scam",
    other: "Something else",
};

/** Report (or change / retract a report of) a campus. */
export function ReportDialog({ campus, onClose, onDone }: { campus: CampusSummaryView; onClose: () => void; onDone: () => void }) {
    const [reason, setReason] = useState<CampusReportReason>(campus.myReport ?? "not_official");
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);

    const send = async () => {
        setBusy(true);
        const j = await call(`/api/user/campus/entities/${campus._id}/report`, "POST", { reason, note });
        setBusy(false);
        if (!j.success) return toast.error(j.error ?? "Unable to send the report");
        toast.success("Report sent");
        onDone();
    };
    const retract = async () => {
        setBusy(true);
        const j = await call(`/api/user/campus/entities/${campus._id}/report`, "DELETE");
        setBusy(false);
        if (!j.success) return toast.error(j.error ?? "Unable to retract");
        toast.success("Report retracted");
        onDone();
    };

    return (
        <Modal open onClose={onClose} title={`Report ${campus.name}`} size="md">
            <div className="space-y-4">
                <p className="text-sm text-[var(--text-2)]">Reports are shown to other students as a count and are reviewed by iFind. They never delete a campus by themselves.</p>
                <fieldset className="space-y-2">
                    <legend className="sr-only">Reason</legend>
                    {CAMPUS_REPORT_REASONS.map((r) => (
                        <label key={r} className="flex items-center gap-2 text-sm text-[var(--text)]">
                            <input type="radio" name="reason" className="accent-[var(--danger)]" checked={reason === r} onChange={() => setReason(r)} />
                            {REASON_LABEL[r]}
                        </label>
                    ))}
                </fieldset>
                <textarea
                    rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)"
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                <div className="flex flex-wrap justify-between gap-2">
                    {campus.myReport ? <Button variant="ghost" disabled={busy} onClick={retract}>Retract my report</Button> : <span />}
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button variant="danger" loading={busy} onClick={send}>{campus.myReport ? "Update report" : "Report"}</Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
