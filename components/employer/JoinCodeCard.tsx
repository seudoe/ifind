"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface Props {
    entityId: string;
    name: string;
    code: string;
    canRotate: boolean;
}

/** The campus join code with copy, a ready-to-send WhatsApp message and (admin+) rotate. */
export function JoinCodeCard({ entityId, name, code: initial, canRotate }: Props) {
    const router = useRouter();
    const [code, setCode] = useState(initial);
    const [confirm, setConfirm] = useState(false);
    const [busy, setBusy] = useState(false);

    const message = () =>
        `Join our official campus on iFind (${name}): ${window.location.origin}\nOpen Campus Internships, tap "Have a code?" and enter: ${code}`;

    const copy = async (text: string, ok: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success(ok);
        } catch {
            toast.error("Copy failed. Select the text and copy it manually.");
        }
    };

    const rotate = async () => {
        setBusy(true);
        const res = await fetch(`/api/employer/campus/${entityId}/code/rotate`, { method: "POST", credentials: "include" });
        const j = await res.json().catch(() => ({ success: false, error: "Unable to rotate the code" }));
        setBusy(false);
        setConfirm(false);
        if (!j.success) return toast.error(j.error);
        setCode(j.data.joinCode);
        toast.success("New code generated. The old one no longer works.");
        router.refresh();
    };

    return (
        <div className="plasma-card p-5 space-y-3 border-[var(--campus)]/40">
            <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[var(--campus)]" />
                <h2 className="font-semibold text-[var(--heading)]">Join code</h2>
            </div>
            <p className="text-sm text-[var(--text-2)]">
                Share this code with your students on WhatsApp so they join <em>your</em> campus and not a look-alike.
            </p>
            <p className="select-all font-mono text-3xl font-bold tracking-[0.25em] text-[var(--campus)]" aria-label={`Join code ${code.split("").join(" ")}`}>{code}</p>
            <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => copy(code, "Code copied")}><Copy className="h-3.5 w-3.5" /> Copy code</Button>
                <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => copy(message(), "Message copied. Paste it into WhatsApp.")}><MessageCircle className="h-3.5 w-3.5" /> Copy WhatsApp message</Button>
                {canRotate && <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setConfirm(true)}><RefreshCw className="h-3.5 w-3.5" /> Rotate</Button>}
            </div>
            <Modal open={confirm} onClose={() => setConfirm(false)} title="Rotate the join code?" size="sm">
                <p className="text-sm text-[var(--text-2)] mb-4">The current code stops working immediately. Students who already joined stay joined.</p>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
                    <Button loading={busy} onClick={rotate}>Rotate</Button>
                </div>
            </Modal>
        </div>
    );
}
