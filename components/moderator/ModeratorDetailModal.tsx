"use client";

import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import type { ModeratorSummary } from "@/types/moderator";

const when = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <dt className="text-xs text-[var(--text-3)]">{label}</dt>
            <dd className="text-sm text-[var(--text)] break-words">{value || "—"}</dd>
        </div>
    );
}

/** Everything the moderators list already carries; names of verifier / banner are resolved from the same list. */
export function ModeratorDetailModal({
    moderator: m,
    all,
    onClose,
}: {
    moderator: ModeratorSummary | null;
    all: ModeratorSummary[];
    onClose: () => void;
}) {
    const nameOf = (v: unknown) => {
        if (!v) return null;
        if (typeof v === "object" && v && "name" in v) return String((v as { name: unknown }).name);
        return all.find((x) => x._id === String(v))?.name ?? String(v);
    };

    return (
        <Modal open={!!m} onClose={onClose} size="lg" title={m?.name} description={m?.email}>
            {m && (
                <>
                    <div className="flex flex-wrap items-center gap-2 mb-5">
                        {m.isBanned ? <Badge variant="danger">Banned</Badge> : <Badge variant="success">Active</Badge>}
                        {m.isVerified ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">Unverified</Badge>}
                        <Badge variant="default">Priority {m.priority ?? "—"}</Badge>
                    </div>

                    {m.isBanned && (
                        <p className="mb-5 text-sm text-[var(--danger)]">
                            Banned {when(m.bannedAt)} by {nameOf(m.bannedBy) ?? "unknown"}
                            {m.bannedReason ? ` — ${m.bannedReason}` : ""}
                        </p>
                    )}

                    <dl className="grid grid-cols-2 gap-3">
                        <Field label="Name" value={m.name} />
                        <Field label="Email" value={m.email} />
                        <Field label="Joined" value={when(m.createdAt)} />
                        <Field label="Priority" value={m.priority} />
                        <Field label="Verified by" value={m.isVerified ? nameOf(m.verifiedBy) ?? "—" : "—"} />
                        <Field label="Verified at" value={when(m.verifiedAt)} />
                        <Field label="ID" value={<code className="text-xs">{m._id}</code>} />
                    </dl>
                </>
            )}
        </Modal>
    );
}
