"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { CAMPUS_STATUS_LABEL, CampusApplicationPill } from "@/components/campus/CampusApplicationPill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { ACCEPTED_WITHDRAW_WARNING } from "@/lib/campus/copy";
import type { loadCampusApplication } from "@/lib/campus/studentApplications";

type Detail = NonNullable<Awaited<ReturnType<typeof loadCampusApplication>>>;
const when = (iso: string | Date | null | undefined) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : null);

async function post(url: string, body?: unknown) {
    const res = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    return (await res.json().catch(() => ({ success: false, error: "Something went wrong" }))) as { success: boolean; error?: string };
}

export default function CampusApplicationPage() {
    const { username, id } = useParams<{ username: string; id: string }>();
    const [d, setD] = useState<Detail | null>(null);
    const [missing, setMissing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState<"withdraw" | "accept" | "decline" | null>(null);

    const load = useCallback(async () => {
        const j = await fetch(`/api/user/campus/applications/${id}`, { credentials: "include" }).then((r) => r.json()).catch(() => null);
        if (j?.success) setD(j.data); else setMissing(true);
    }, [id]);
    useEffect(() => {
        let live = true;
        fetch(`/api/user/campus/applications/${id}`, { credentials: "include" }).then((r) => r.json())
            .then((j) => { if (!live) return; if (j.success) setD(j.data); else setMissing(true); })
            .catch(() => live && setMissing(true));
        return () => { live = false; };
    }, [id]);

    const run = async (kind: "withdraw" | "accept" | "decline") => {
        setBusy(true);
        const j = kind === "withdraw"
            ? await post(`/api/user/campus/applications/${id}/withdraw`, { confirmAccepted: d?.status === "accepted" })
            : await post(`/api/user/campus/applications/${id}/respond`, { decision: kind });
        setBusy(false);
        setConfirm(null);
        if (!j.success) return toast.error(j.error ?? "Failed");
        toast.success(kind === "withdraw" ? "Application withdrawn" : kind === "accept" ? "Offer accepted" : "Offer declined");
        await load();
    };

    if (missing) return <p className="text-sm text-[var(--text-2)]">We couldn&apos;t find that application.</p>;
    if (!d) return <div className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-40" /></div>;
    const offerOpen = d.status === "offered";

    return (
        <div className="max-w-2xl space-y-5">
            <Link href={`/user/${username}/campus/applied`} className="inline-flex items-center gap-1 text-xs text-[var(--text-3)] hover:text-[var(--text)]"><ChevronLeft className="h-3.5 w-3.5" /> Applied</Link>
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-[var(--heading)]">{d.internship?.company ?? "Internship"}</h2>
                <CampusApplicationPill status={d.status} />
            </div>
            {d.internship && <p className="-mt-3 text-sm text-[var(--text-2)]">{d.internship.designation}</p>}

            {d.status === "removed" && (
                <div role="alert" className="rounded-[var(--radius)] border border-[var(--danger)]/40 bg-red-50 p-3 text-sm text-[var(--danger)]">
                    The campus staff removed you from this internship{d.removalReason ? `: ${d.removalReason}` : "."} This does not stop you from applying to other internships. Ask them if you think it is a mistake.
                </div>
            )}

            {offerOpen && (
                <section className="plasma-card space-y-3 border-l-4 border-l-amber-400 p-4">
                    <h3 className="font-semibold text-[var(--heading)]">You have an offer</h3>
                    <p className="text-sm text-[var(--text-2)]">{d.offer?.acceptBy ? `Please answer by ${when(d.offer.acceptBy)}.` : "Please answer as soon as you can."}</p>
                    <div className="flex gap-2"><Button onClick={() => setConfirm("accept")}>Accept</Button><Button variant="secondary" onClick={() => setConfirm("decline")}>Decline</Button></div>
                </section>
            )}

            <section className="plasma-card p-4">
                <h3 className="label mb-2">Timeline</h3>
                <ol className="space-y-2">
                    {d.timeline.map((t, i) => (
                        <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="text-[var(--text)]">{CAMPUS_STATUS_LABEL[t.status]}{t.byYou ? " (you)" : ""}</span>
                            <span className="text-xs text-[var(--text-3)]">{when(t.at)}</span>
                        </li>
                    ))}
                </ol>
            </section>

            {d.rounds.length > 0 && (
                <section className="plasma-card p-4">
                    <h3 className="label mb-2">Rounds</h3>
                    <ul className="space-y-1 text-sm">{d.rounds.map((r) => <li key={r.name} className="flex justify-between"><span>{r.name}</span><span className="capitalize text-[var(--text-2)]">{r.result}</span></li>)}</ul>
                </section>
            )}

            {d.internship && (
                <section className="plasma-card p-4 text-sm space-y-1">
                    <h3 className="label mb-2">Key dates</h3>
                    <p>Apply by: {when(d.internship.deadlineDate) ?? "To be announced"}</p>
                    <p>Assessment: {when(d.internship.assessmentDate) ?? "To be announced"}</p>
                    <p>Interviews: {when(d.internship.interviewDate) ?? "To be announced"}</p>
                    <p>Results: {when(d.internship.resultDate) ?? "To be announced"}</p>
                </section>
            )}

            {d.canWithdraw && <div><Button variant="ghost" onClick={() => setConfirm("withdraw")}>Withdraw application</Button></div>}

            <Modal open={confirm === "withdraw"} onClose={() => setConfirm(null)} title="Withdraw this application?" size="sm">
                <p className="mb-4 text-sm text-[var(--text-2)]">{d.status === "accepted" ? ACCEPTED_WITHDRAW_WARNING : "The placement team is told. You can apply again while the internship is open."}</p>
                <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirm(null)}>Keep it</Button><Button variant="danger" loading={busy} onClick={() => run("withdraw")}>Withdraw</Button></div>
            </Modal>
            <Modal open={confirm === "accept" || confirm === "decline"} onClose={() => setConfirm(null)} title={confirm === "accept" ? "Accept this offer?" : "Decline this offer?"} size="sm">
                <p className="mb-4 text-sm text-[var(--text-2)]">{confirm === "accept" ? "The placement team is told. Your campus may allow only one offer per student." : "This can't be undone."}</p>
                <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button><Button loading={busy} onClick={() => confirm && run(confirm === "accept" ? "accept" : "decline")}>{confirm === "accept" ? "Accept" : "Decline"}</Button></div>
            </Modal>
        </div>
    );
}
